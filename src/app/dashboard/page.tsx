'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bank, Transaction } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import DateRangePicker from '@/components/DateRangePicker';
import { DateRange, defaultRange } from '@/lib/dateRanges';

interface DashboardData {
  banks: Bank[];
  totalCash: number;
  totalIncome: number;
  totalExpenses: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    banks: [],
    totalCash: 0,
    totalIncome: 0,
    totalExpenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>(defaultRange());

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: banksData } = await supabase.from('banks').select('*').eq('is_active', true);

        const { data: categoriesData } = await supabase.from('categories').select('id, name');
        const catNameById = new Map<number, string>();
        (categoriesData || []).forEach((c: { id: number; name: string }) =>
          catNameById.set(c.id, (c.name || '').toLowerCase())
        );

        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('*')
          .gte('transaction_date', range.from)
          .lte('transaction_date', range.to)
          .eq('status', 'posted');

        let totalIncome = 0;
        let totalExpenses = 0;

        transactionsData?.forEach((t: Transaction) => {
          const catName = catNameById.get(t.category_id) || '';
          // Self-transfers cancel out; refunds aren't real income — exclude both from totals.
          const isTransfer =
            !!t.transfer_group_id ||
            catName.includes('self transfer') ||
            catName.includes('self-transfer');
          const isRefund = catName === 'refund' || catName === 'refunds';
          if (t.transaction_type === 'income') {
            if (!isTransfer && !isRefund) totalIncome += t.amount;
          } else {
            if (!isTransfer) totalExpenses += t.amount;
          }
        });

        const totalCash = (banksData || []).reduce(
          (sum, b: Bank & { opening_balance?: number }) => sum + (b.opening_balance || 0),
          0
        );

        setData({
          banks: banksData || [],
          totalCash,
          totalIncome,
          totalExpenses,
        });

        setLoading(false);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-18-dark-text">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const profit = data.totalIncome - data.totalExpenses;
  const currentBalance = data.totalCash + profit;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-18-charcoal mb-2">Dashboard</h1>
          <p className="text-18-dark-text">Real-time financial overview</p>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <p className="text-18-dark-text text-sm font-bold uppercase mb-2">Current Balance</p>
          <h3 className="text-xl font-bold text-18-charcoal mb-2">{formatCurrency(currentBalance)}</h3>
          <p className="text-xs text-18-dark-text">
            Opening: {formatCurrency(data.totalCash)}
          </p>
        </div>

        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-green-600" size={16} />
            <p className="text-green-700 text-sm font-bold uppercase">Income</p>
          </div>
          <h3 className="text-xl font-bold text-green-700">{formatCurrency(data.totalIncome)}</h3>
          <p className="text-xs text-green-600 mt-2">Selected range</p>
        </div>

        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="text-red-600" size={16} />
            <p className="text-red-700 text-sm font-bold uppercase">Expenses</p>
          </div>
          <h3 className="text-xl font-bold text-red-700">{formatCurrency(data.totalExpenses)}</h3>
          <p className="text-xs text-red-600 mt-2">Selected range</p>
        </div>

        <div className="card !bg-18-yellow !border-18-yellow">
          <p className="text-sm font-bold uppercase mb-2 text-18-charcoal">Net</p>
          <h3 className={`text-xl font-bold ${profit >= 0 ? 'text-18-charcoal' : 'text-red-700'}`}>
            {formatCurrency(profit)}
          </h3>
          <p className="text-xs mt-2 text-18-charcoal/70">Income − Expenses</p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold text-18-charcoal mb-6">Banks</h2>
        {data.banks.length > 0 ? (
          <div className="space-y-4">
            {data.banks.map((bank) => (
              <div key={bank.id} className="flex justify-between items-center pb-4 border-b border-18-border">
                <div>
                  <p className="font-bold text-18-charcoal">{bank.bank_name}</p>
                  <p className="text-sm text-18-dark-text">{bank.account_number}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-18-charcoal">
                    {formatCurrency((bank as Bank & { opening_balance?: number }).opening_balance || 0)}
                  </p>
                  <p className="text-xs text-18-dark-text">Opening balance</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-18-dark-text">No banks configured</p>
        )}
      </div>
    </div>
  );
}
