'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Transaction, Category } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, X } from 'lucide-react';
import { logAction } from '@/lib/auditLog';
import DateRangePicker from '@/components/DateRangePicker';
import { DateRange, rangeFor } from '@/lib/dateRanges';

interface PnLData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function ReportsPage() {
  const [pnlData, setPnLData] = useState<PnLData[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [rawTxs, setRawTxs] = useState<Transaction[]>([]);
  const [catById, setCatById] = useState<Record<number, Category>>({});
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(rangeFor('current_fy'));

  const COLORS = ['#F37335', '#FFF392', '#1A1A1A', '#494949'];

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('*')
          .gte('transaction_date', range.from)
          .lte('transaction_date', range.to)
          .eq('status', 'posted');

        const { data: categoriesData } = await supabase.from('categories').select('*');

        // Self-transfers and refunds are not real revenue/spending — exclude from PnL.
        const isExcluded = (t: Transaction): boolean => {
          if (t.transfer_group_id) return true;
          const cat = categoriesData?.find((c) => c.id === t.category_id);
          const n = (cat?.name || '').toLowerCase();
          return (
            n.includes('self transfer') ||
            n.includes('self-transfer') ||
            n === 'refund' ||
            n === 'refunds'
          );
        };

        const monthlyData: {
          [key: string]: { revenue: number; expenses: number };
        } = {};

        transactionsData?.forEach((t: Transaction) => {
          if (isExcluded(t)) return;
          const date = new Date(t.transaction_date);
          const monthKey = `${date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { revenue: 0, expenses: 0 };
          }

          if (t.transaction_type === 'income') {
            monthlyData[monthKey].revenue += t.amount;
          } else {
            monthlyData[monthKey].expenses += t.amount;
          }
        });

        const pnl: PnLData[] = Object.entries(monthlyData).map(([month, data]) => ({
          month,
          revenue: data.revenue,
          expenses: data.expenses,
          profit: data.revenue - data.expenses,
        }));

        const categorySpend: { [key: string]: number } = {};
        transactionsData?.forEach((t: Transaction) => {
          if (t.transaction_type === 'expense' && !isExcluded(t)) {
            const cat = categoriesData?.find((c) => c.id === t.category_id);
            const catName = cat?.name || 'Others';
            categorySpend[catName] = (categorySpend[catName] || 0) + t.amount;
          }
        });

        const categoryBreakdownData = Object.entries(categorySpend)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);

        setPnLData(pnl);
        setCategoryBreakdown(categoryBreakdownData);
        setMonthlyComparison(pnl);
        setRawTxs((transactionsData || []) as Transaction[]);
        const catMap: Record<number, Category> = {};
        (categoriesData || []).forEach((c) => {
          catMap[c.id] = c as Category;
        });
        setCatById(catMap);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching reports:', err);
        setLoading(false);
      }
    };

    fetchReportData();
  }, [range]);

  const exportPDF = () => {
    logAction({
      action: 'export',
      table_name: 'reports',
      description: `Generated PnL report (PDF) for ${range.from} → ${range.to}`,
      new_values: { format: 'pdf', from: range.from, to: range.to },
    });
    window.print();
  };

  const exportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const fileSaverMod: any = await import('file-saver');
      const saveAs = fileSaverMod.saveAs || fileSaverMod.default?.saveAs || fileSaverMod.default;
      if (typeof saveAs !== 'function') throw new Error('file-saver saveAs not available');
      const wb = new ExcelJS.Workbook();

      const ws1 = wb.addWorksheet('Monthly PnL');
      ws1.addRow(['Month', 'Revenue', 'Expenses', 'Net']);
      ws1.getRow(1).font = { bold: true };
      pnlData.forEach((d) => {
        ws1.addRow([d.month, d.revenue, d.expenses, d.profit]);
      });
      ws1.addRow([]);
      ws1.addRow(['Total', totalRevenue, totalExpenses, totalProfit])
        .font = { bold: true };
      [2, 3, 4].forEach((c) => (ws1.getColumn(c).numFmt = '#,##0.00;(#,##0.00);-'));
      ws1.getColumn(1).width = 14;
      [2, 3, 4].forEach((c) => (ws1.getColumn(c).width = 16));

      const ws2 = wb.addWorksheet('Category Breakdown');
      ws2.addRow(['Category', 'Amount', '% of Expenses']);
      ws2.getRow(1).font = { bold: true };
      categoryBreakdown.forEach((c) => {
        const pct = totalExpenses ? (c.value / totalExpenses) * 100 : 0;
        ws2.addRow([c.name, c.value, pct / 100]);
      });
      ws2.getColumn(1).width = 30;
      ws2.getColumn(2).width = 18;
      ws2.getColumn(2).numFmt = '#,##0.00;(#,##0.00);-';
      ws2.getColumn(3).numFmt = '0.0%';

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `PnL_Report_${range.from}_to_${range.to}.xlsx`);

      logAction({
        action: 'export',
        table_name: 'reports',
        description: `Generated PnL report (Excel) for ${range.from} → ${range.to}`,
        new_values: { format: 'excel', from: range.from, to: range.to },
      });
    } catch (err: any) {
      alert(`Excel export failed: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  const totalRevenue = pnlData.reduce((sum, d) => sum + d.revenue, 0);
  const totalExpenses = pnlData.reduce((sum, d) => sum + d.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-18-charcoal">Reports & Analytics</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPDF} className="btn btn-outline flex items-center gap-2">
            <Download size={18} />
            PDF
          </button>
          <button onClick={exportExcel} className="btn btn-outline flex items-center gap-2">
            <Download size={18} />
            Excel
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
        <label className="form-label !mb-0">Range:</label>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-green-50 border-green-200">
          <p className="text-green-700 text-sm font-bold uppercase mb-2">Total Revenue</p>
          <h3 className="text-xl font-bold text-green-700">{formatCurrency(totalRevenue)}</h3>
          <p className="text-xs text-green-600 mt-2">{pnlData.length} months</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-700 text-sm font-bold uppercase mb-2">Total Expenses</p>
          <h3 className="text-xl font-bold text-red-700">{formatCurrency(totalExpenses)}</h3>
          <p className="text-xs text-red-600 mt-2">Across all categories</p>
        </div>
        <div className="card !bg-18-yellow !border-18-yellow">
          <p className="text-sm font-bold uppercase mb-2 text-18-charcoal">Net</p>
          <h3 className={`text-xl font-bold ${totalProfit >= 0 ? 'text-18-charcoal' : 'text-red-700'}`}>
            {formatCurrency(totalProfit)}
          </h3>
          <p className="text-xs mt-2 text-18-charcoal/70">Income − Expenses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-bold text-18-charcoal mb-4">Monthly PnL Trend</h2>
          {pnlData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pnlData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                <XAxis dataKey="month" stroke="#494949" style={{ fontSize: '12px' }} />
                <YAxis stroke="#494949" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '1px solid #E8E8E8',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#00A86B"
                  strokeWidth={2}
                  name="Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#DC143C"
                  strokeWidth={2}
                  name="Expenses"
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#F37335"
                  strokeWidth={2}
                  name="Profit"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-18-dark-text text-center py-12">No data available</p>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-18-charcoal mb-4">Monthly Comparison</h2>
          {monthlyComparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" />
                <XAxis dataKey="month" stroke="#494949" style={{ fontSize: '12px' }} />
                <YAxis stroke="#494949" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFF',
                    border: '1px solid #E8E8E8',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#00A86B" name="Revenue" />
                <Bar dataKey="expenses" fill="#DC143C" name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-18-dark-text text-center py-12">No data available</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold text-18-charcoal mb-6">Expense Breakdown by Category</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {categoryBreakdown.length > 0 ? (
            <>
              <div className="flex justify-center items-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ₹${(value / 100000).toFixed(1)}L`}
                      outerRadius={80}
                      fill="#F37335"
                      dataKey="value"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="font-bold text-18-charcoal mb-4">Category Details</h3>
                <div className="space-y-3">
                  {categoryBreakdown.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setDrillCategory(cat.name)}
                      className="w-full flex justify-between items-center pb-3 border-b border-18-border text-left hover:bg-orange-50 rounded-md p-2 -m-2 transition-colors"
                      title="View transactions in this category"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        ></div>
                        <span className="font-semibold text-18-charcoal">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-18-charcoal">{formatCurrency(cat.value)}</p>
                        <p className="text-xs text-18-dark-text">
                          {((cat.value / totalExpenses) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-18-dark-text col-span-2 text-center py-12">No expense data available</p>
          )}
        </div>
      </div>

      {drillCategory && (() => {
        const txsInCat = rawTxs.filter((t) => {
          if (t.transaction_type !== 'expense') return false;
          const name = catById[t.category_id]?.name || 'Others';
          return name === drillCategory;
        }).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
        const total = txsInCat.reduce((s, t) => s + t.amount, 0);
        return (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setDrillCategory(null); }}
          >
            <div className="card bg-white w-full max-w-3xl my-8 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-18-charcoal">{drillCategory}</h3>
                  <p className="text-sm text-18-dark-text">
                    {txsInCat.length} transaction{txsInCat.length !== 1 ? 's' : ''} · {formatCurrency(total)}
                    {' · '}{range.from} → {range.to}
                  </p>
                </div>
                <button
                  onClick={() => setDrillCategory(null)}
                  className="text-18-charcoal hover:text-18-orange"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-18-charcoal text-white uppercase text-xs">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Payee</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txsInCat.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-18-dark-text">
                          No transactions in this category for the selected range.
                        </td>
                      </tr>
                    ) : (
                      txsInCat.map((t) => (
                        <tr key={t.id} className="border-b border-18-border">
                          <td className="px-3 py-2 text-18-dark-text whitespace-nowrap">{formatDate(t.transaction_date)}</td>
                          <td className="px-3 py-2">{t.payee_name || '—'}</td>
                          <td className="px-3 py-2 text-18-dark-text">{t.description || '—'}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(t.amount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
