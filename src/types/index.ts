export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Bank {
  id: number;
  bank_name: string;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type InvestmentType = 'fd' | 'smallcase' | 'stocks' | 'mutual_fund' | 'others';

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  fd: 'Fixed Deposit',
  smallcase: 'Smallcase',
  stocks: 'Stocks',
  mutual_fund: 'Mutual Fund',
  others: 'Others',
};

export interface Investment {
  id: number;
  name: string;
  type: InvestmentType;
  amount: number;
  source_bank_id: number | null;
  start_date: string | null;
  maturity_date: string | null;
  interest_rate: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SipFrequency = 'monthly' | 'weekly' | 'quarterly';

export const SIP_FREQUENCY_LABELS: Record<SipFrequency, string> = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  quarterly: 'Quarterly',
};

export interface Sip {
  id: number;
  user_id: string;
  investment_id: number | null;
  name: string;
  amount: number;
  frequency: SipFrequency;
  debit_day: number;
  source_bank_id: number;
  category_id: number | null;
  start_date: string;
  end_date: string | null;
  next_debit_date: string;
  is_active: boolean;
  last_debited_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankBalanceHistory {
  id: number;
  bank_id: number;
  previous_balance: number | null;
  new_balance: number;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  type: 'income' | 'expense';
  name: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Transaction {
  id: number;
  transaction_type: 'income' | 'expense';
  bank_id: number;
  category_id: number;
  description: string;
  amount: number;
  transaction_date: string;
  transfer_group_id: string | null;
  status: 'posted' | 'draft' | 'reconciled';
  notes: string;
  receipt_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyBalance {
  id: number;
  bank_id: number;
  financial_month: string;
  opening_balance: number;
  closing_balance: number;
  created_at: string;
  updated_at: string;
}

export interface BankReconciliation {
  id: number;
  bank_id: number;
  reconciliation_date: string;
  opening_balance: number;
  closing_balance: number;
  bank_balance: number;
  reconciled_amount: number;
  difference: number;
  notes: string;
  status: 'pending' | 'reconciled';
  reconciled_by: string;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: number | null;
  description: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}

export interface MonthlySummary {
  month: string;
  transaction_type: 'income' | 'expense';
  bank_id: number;
  bank_name: string;
  total_income: number;
  total_expense: number;
  net_change: number;
}

export interface Budget {
  id: number;
  user_id: string;
  category_id: number;
  // First day of the month (YYYY-MM-01) the budget applies to.
  month: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface PnLData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}
