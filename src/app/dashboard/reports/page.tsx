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

  // Category palette — all readable on the dark #0A0A0A background
  const COLORS = [
    '#F37335', // brand orange
    '#FFF392', // brand yellow
    '#A78BFA', // purple
    '#22D3EE', // cyan
    '#4ADE80', // green
    '#F472B6', // pink
    '#60A5FA', // blue
    '#FB7185', // rose
  ];

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

  const exportPDF = async () => {
    // Build a proper structured PDF instead of dumping the browser page.
    // Print-safe light theme with the brand orange as the only accent — easy
    // on the eyes, easy on ink.
    const { default: JsPDF } = await import('jspdf');
    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    const contentW = pageW - margin * 2;

    // jsPDF's built-in helvetica is Windows-1252 encoded — no ₹, →, − etc.
    // Swap them for ASCII substitutes at write time so the report renders
    // cleanly in every viewer.
    const pdfSafe = (s: string): string =>
      s
        .replace(/₹\s*/g, 'Rs ')
        .replace(/→/g, 'to')
        .replace(/[−–—]/g, '-')
        .replace(/·/g, '-');
    const money = (n: number): string => pdfSafe(formatCurrency(n));

    // Palette (print-friendly)
    const orange: [number, number, number] = [243, 115, 53];
    const green:  [number, number, number] = [17, 138, 96];
    const red:    [number, number, number] = [204, 51, 51];
    const ink:    [number, number, number] = [26, 26, 26];
    const muted:  [number, number, number] = [110, 110, 110];
    const line:   [number, number, number] = [220, 220, 220];
    const stripe: [number, number, number] = [248, 248, 248];

    // ------- HEADER (page 1) -------
    // Logo mark
    doc.setFillColor(...orange);
    doc.roundedRect(margin, margin, 26, 26, 6, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PFT', margin + 13, margin + 17, { align: 'center' });

    // Wordmark
    doc.setTextColor(...ink);
    doc.setFontSize(13);
    doc.text('Personal FT', margin + 36, margin + 17);

    // Report title (top right)
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.text('MONTHLY REPORT', pageW - margin, margin + 10, { align: 'right' });
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.text(new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }), pageW - margin, margin + 24, { align: 'right' });

    // Title block
    let y = margin + 70;
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ink);
    doc.text('Reports & Analytics', margin, y);
    y += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.text(
      `Period: ${formatDate(range.from)}   to   ${formatDate(range.to)}      -      ${pnlData.length} month${pnlData.length === 1 ? '' : 's'}`,
      margin,
      y
    );
    y += 26;
    // Divider
    doc.setDrawColor(...line);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 22;

    // ------- SUMMARY BOXES -------
    const boxH = 68;
    const boxGap = 12;
    const boxW = (contentW - boxGap * 2) / 3;
    const boxes: { label: string; value: string; color: [number, number, number]; hint: string }[] = [
      { label: 'TOTAL REVENUE',  value: money(totalRevenue),  color: green,  hint: 'Income (excl. transfers)' },
      { label: 'TOTAL EXPENSES', value: money(totalExpenses), color: red,    hint: 'Across all categories' },
      { label: 'NET',            value: money(totalProfit),   color: totalProfit >= 0 ? orange : red, hint: 'Revenue - Expenses' },
    ];
    boxes.forEach((b, i) => {
      const x = margin + i * (boxW + boxGap);
      // Card
      doc.setDrawColor(...line);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, boxW, boxH, 8, 8, 'FD');
      // Accent bar on the left
      doc.setFillColor(...b.color);
      doc.roundedRect(x, y, 4, boxH, 2, 2, 'F');
      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(b.label, x + 14, y + 18);
      // Value
      doc.setFontSize(18);
      doc.setTextColor(...b.color);
      doc.text(b.value, x + 14, y + 42);
      // Hint
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(b.hint, x + 14, y + 58);
    });
    y += boxH + 32;

    // ------- MONTHLY PnL TABLE -------
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...ink);
    doc.text('Monthly PnL', margin, y);
    y += 14;

    // Column layout
    const cMonth   = margin + 12;
    const cRev     = margin + contentW * 0.42;
    const cExp     = margin + contentW * 0.62;
    const cNet     = margin + contentW * 0.82;
    const rowH     = 20;

    const drawTableHeader = (label1: string, l1x: number, cols: { label: string; x: number }[]) => {
      doc.setFillColor(...ink);
      doc.roundedRect(margin, y, contentW, 24, 4, 4, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(label1, l1x, y + 15);
      cols.forEach((c) => doc.text(c.label, c.x, y + 15, { align: 'right' }));
      y += 24;
    };

    drawTableHeader('MONTH', cMonth, [
      { label: 'REVENUE',  x: cRev },
      { label: 'EXPENSES', x: cExp },
      { label: 'NET',      x: cNet },
    ]);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    pnlData.forEach((row, i) => {
      // Page break if needed
      if (y + rowH > pageH - 60) {
        doc.addPage();
        y = margin;
      }
      // Row stripe
      if (i % 2 === 0) {
        doc.setFillColor(...stripe);
        doc.rect(margin, y, contentW, rowH, 'F');
      }
      doc.setTextColor(...ink);
      doc.text(row.month, cMonth, y + 14);
      doc.setTextColor(...green);
      doc.text(money(row.revenue),  cRev, y + 14, { align: 'right' });
      doc.setTextColor(...red);
      doc.text(money(row.expenses), cExp, y + 14, { align: 'right' });
      const netColor = row.profit >= 0 ? ink : red;
      doc.setTextColor(...netColor);
      doc.setFont('helvetica', 'bold');
      doc.text(money(row.profit),   cNet, y + 14, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += rowH;
    });

    // Total row
    doc.setDrawColor(...ink);
    doc.setLineWidth(1);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
    doc.setFillColor(...ink);
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', cMonth, y + 14);
    doc.text(money(totalRevenue),  cRev, y + 14, { align: 'right' });
    doc.text(money(totalExpenses), cExp, y + 14, { align: 'right' });
    doc.text(money(totalProfit),   cNet, y + 14, { align: 'right' });
    y += rowH + 30;

    // ------- CATEGORY BREAKDOWN -------
    // Ensure enough space for header + a couple of rows; else new page
    if (y + 100 > pageH - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...ink);
    doc.text('Expense Breakdown by Category', margin, y);
    y += 14;

    const cCat = margin + 12;
    const cAmt = margin + contentW * 0.62;
    const cPct = margin + contentW * 0.82;
    const cBar = margin + contentW * 0.40; // right edge of the progress bar

    drawTableHeader('CATEGORY', cCat, [
      { label: 'AMOUNT', x: cAmt },
      { label: 'SHARE',  x: cPct },
    ]);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    categoryBreakdown.forEach((cat, i) => {
      if (y + rowH > pageH - 60) {
        doc.addPage();
        y = margin;
      }
      const pct = totalExpenses > 0 ? (cat.value / totalExpenses) * 100 : 0;
      // Stripe
      if (i % 2 === 0) {
        doc.setFillColor(...stripe);
        doc.rect(margin, y, contentW, rowH, 'F');
      }
      // Name
      doc.setTextColor(...ink);
      doc.text(pdfSafe(cat.name), cCat, y + 14);
      // Mini bar (right-aligned inside the name column area)
      const barMaxW = 80;
      const barX = cCat + 130;
      const barY = y + 8;
      const barH = 5;
      doc.setFillColor(...line);
      doc.roundedRect(barX, barY, barMaxW, barH, 2, 2, 'F');
      doc.setFillColor(...orange);
      const fillW = Math.max(2, Math.min(barMaxW, (pct / 100) * barMaxW));
      doc.roundedRect(barX, barY, fillW, barH, 2, 2, 'F');
      // Amount
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...ink);
      doc.text(money(cat.value), cAmt, y + 14, { align: 'right' });
      // %
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...muted);
      doc.text(`${pct.toFixed(1)}%`, cPct, y + 14, { align: 'right' });
      y += rowH;
    });

    // ------- FOOTER on every page -------
    // @ts-expect-error jsPDF's pages count is offset by 1 (index 0 unused)
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setDrawColor(...line);
      doc.setLineWidth(0.5);
      doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text('Personal FT · personal-ft.vercel.app', margin, pageH - 24);
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 24, { align: 'right' });
    }

    doc.save(`Personal-FT_Report_${range.from}_to_${range.to}.pdf`);

    logAction({
      action: 'export',
      table_name: 'reports',
      description: `Generated PnL report (PDF) for ${range.from} → ${range.to}`,
      new_values: { format: 'pdf', from: range.from, to: range.to },
    });
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
        <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPDF} className="btn btn-outline flex items-center gap-2">
            <Download size={18} />
            Download Report
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
        <label className="form-label !mb-0">Range:</label>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-green-900/20 border-green-800/40">
          <p className="text-green-300 text-sm font-bold uppercase mb-2">Total Revenue</p>
          <h3 className="text-xl font-bold text-green-300">{formatCurrency(totalRevenue)}</h3>
          <p className="text-xs text-green-400 mt-2">{pnlData.length} months</p>
        </div>
        <div className="card bg-red-900/20 border-red-800/40">
          <p className="text-red-300 text-sm font-bold uppercase mb-2">Total Expenses</p>
          <h3 className="text-xl font-bold text-red-300">{formatCurrency(totalExpenses)}</h3>
          <p className="text-xs text-red-400 mt-2">Across all categories</p>
        </div>
        <div className="card !bg-18-orange/15 !border-18-orange/40">
          <p className="text-sm font-bold uppercase mb-2 text-white">Net</p>
          <h3 className={`text-xl font-bold ${totalProfit >= 0 ? 'text-white' : 'text-red-300'}`}>
            {formatCurrency(totalProfit)}
          </h3>
          <p className="text-xs mt-2 text-white/70">Income − Expenses</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-bold text-white mb-4">Monthly PnL Trend</h2>
          {pnlData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={pnlData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="month" stroke="#B0B0B0" style={{ fontSize: '12px' }} />
                <YAxis stroke="#B0B0B0" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                  itemStyle={{ color: '#e5e5e5' }}
                  cursor={{ stroke: '#2A2A2A', strokeWidth: 1 }}
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
          <h2 className="text-xl font-bold text-white mb-4">Monthly Comparison</h2>
          {monthlyComparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="month" stroke="#B0B0B0" style={{ fontSize: '12px' }} />
                <YAxis stroke="#B0B0B0" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#141414',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                  itemStyle={{ color: '#e5e5e5' }}
                  cursor={{ stroke: '#2A2A2A', strokeWidth: 1 }}
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
        <h2 className="text-xl font-bold text-white mb-6">Expense Breakdown by Category</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {categoryBreakdown.length > 0 ? (
            <>
              <div className="flex justify-center items-center">
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart margin={{ top: 40, right: 100, bottom: 40, left: 100 }}>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      // Bent L-shaped leader line — from slice edge → out
                      // radially to an "elbow" → horizontal to the label.
                      // Keeps labels far from the pie so they can breathe.
                      labelLine={(props: any) => {
                        const { cx, cy, midAngle, outerRadius, percent } = props;
                        if (percent < 0.03) return null;
                        const RADIAN = Math.PI / 180;
                        const sin = Math.sin(-midAngle * RADIAN);
                        const cos = Math.cos(-midAngle * RADIAN);
                        const sx = cx + outerRadius * cos;         // start (slice edge)
                        const sy = cy + outerRadius * sin;
                        const mx = cx + (outerRadius + 16) * cos;  // elbow
                        const my = cy + (outerRadius + 16) * sin;
                        const ex = cx + (outerRadius + 42) * cos + (cos >= 0 ? 12 : -12);
                        const ey = my;                             // horizontal segment
                        return (
                          <polyline
                            points={`${sx},${sy} ${mx},${my} ${ex},${ey}`}
                            stroke="#5a5a5a"
                            strokeDasharray="2 3"
                            strokeWidth={1}
                            fill="none"
                          />
                        );
                      }}
                      // Label rendered at the end of the bent line.
                      // Slices under 3% get no label (they'd overlap) — the
                      // Category Details list beside the chart shows them all.
                      label={({ name, value, percent, cx, cy, midAngle, outerRadius }: any) => {
                        if (percent < 0.03) return null;
                        const RADIAN = Math.PI / 180;
                        const cos = Math.cos(-midAngle * RADIAN);
                        const sin = Math.sin(-midAngle * RADIAN);
                        // Same elbow math as labelLine — label sits just past it
                        const ex = cx + (outerRadius + 42) * cos + (cos >= 0 ? 16 : -16);
                        const ey = cy + (outerRadius + 16) * sin;
                        const anchor = cos >= 0 ? 'start' : 'end';
                        return (
                          <text
                            x={ex}
                            y={ey}
                            fill="#e5e5e5"
                            textAnchor={anchor}
                            dominantBaseline="central"
                            fontSize={11}
                            fontWeight={600}
                          >
                            <tspan x={ex} dy="-0.4em">{name}</tspan>
                            <tspan x={ex} dy="1.1em" fill="#999" fontWeight={400}>
                              {formatCurrency(value as number)} · {(percent * 100).toFixed(0)}%
                            </tspan>
                          </text>
                        );
                      }}
                      // Donut style — modern & leaves room in the middle
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      fill="#F37335"
                      dataKey="value"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                          stroke="#141414"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#141414',
                        border: '1px solid #2A2A2A',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                      itemStyle={{ color: '#e5e5e5' }}
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="font-bold text-white mb-4">Category Details</h3>
                <div className="space-y-3">
                  {categoryBreakdown.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setDrillCategory(cat.name)}
                      className="w-full flex justify-between items-center pb-3 border-b border-18-border text-left hover:bg-18-orange/10 rounded-md p-2 -m-2 transition-colors"
                      title="View transactions in this category"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        ></div>
                        <span className="font-semibold text-white">{cat.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{formatCurrency(cat.value)}</p>
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
            <div className="card bg-18-surface w-full max-w-3xl my-8 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{drillCategory}</h3>
                  <p className="text-sm text-18-dark-text">
                    {txsInCat.length} transaction{txsInCat.length !== 1 ? 's' : ''} · {formatCurrency(total)}
                    {' · '}{range.from} → {range.to}
                  </p>
                </div>
                <button
                  onClick={() => setDrillCategory(null)}
                  className="text-white hover:text-18-orange"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-18-charcoal text-white uppercase text-xs">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txsInCat.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-18-dark-text">
                          No transactions in this category for the selected range.
                        </td>
                      </tr>
                    ) : (
                      txsInCat.map((t) => (
                        <tr key={t.id} className="border-b border-18-border">
                          <td className="px-3 py-2 text-18-dark-text whitespace-nowrap">{formatDate(t.transaction_date)}</td>
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
