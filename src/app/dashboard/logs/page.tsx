'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AuditLog, Bank, Category, User } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Download,
  UserMinus,
  UserPlus,
  CheckCircle,
  Activity,
} from 'lucide-react';

const ACTION_COLORS: Record<string, string> = {
  create:     'text-green-300 bg-green-900/40 border border-green-800/50',
  update:     'text-blue-300  bg-blue-900/40  border border-blue-800/50',
  delete:     'text-red-300   bg-red-900/40   border border-red-800/50',
  import:     'text-purple-300 bg-purple-900/40 border border-purple-800/50',
  export:     'text-yellow-200 bg-yellow-900/40 border border-yellow-800/50',
  deactivate: 'text-red-300   bg-red-900/40   border border-red-800/50',
  reactivate: 'text-green-300 bg-green-900/40 border border-green-800/50',
  mark_paid:  'text-green-300 bg-green-900/40 border border-green-800/50',
};

const actionIcon = (a: string) => {
  switch (a) {
    case 'create':
      return <Plus size={14} />;
    case 'update':
      return <Pencil size={14} />;
    case 'delete':
      return <Trash2 size={14} />;
    case 'import':
      return <Upload size={14} />;
    case 'export':
      return <Download size={14} />;
    case 'deactivate':
      return <UserMinus size={14} />;
    case 'reactivate':
      return <UserPlus size={14} />;
    case 'mark_paid':
      return <CheckCircle size={14} />;
    default:
      return <Activity size={14} />;
  }
};

const TABLE_LABELS: Record<string, string> = {
  transactions: 'Transactions',
  banks: 'Banks',
  categories: 'Categories',
  users: 'Team Members',
  reports: 'Reports',
};

const FIELD_LABELS: Record<string, string> = {
  amount: 'Amount',
  description: 'Description',
  transaction_date: 'Date',
  category_id: 'Category',
  bank_id: 'Bank',
  notes: 'Notes',
  status: 'Status',
  opening_balance: 'Opening Balance',
  previous_balance: 'Previous Balance',
  new_balance: 'New Balance',
  reason: 'Reason',
  bank_name: 'Bank Name',
  is_active: 'Active',
  full_name: 'Name',
  email: 'Email',
  name: 'Name',
  type: 'Type',
  count: 'Rows imported',
  skipped: 'Rows skipped',
  format: 'Format',
  financial_year: 'Financial Year',
};

// Fields to hide from the diff — noise or already implicit in the description.
const HIDDEN_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'created_by',
  'changed_by',
  'updated_by',
  'transaction_type',
  'is_default',
]);

const STATUS_LABELS: Record<string, string> = {
  posted: 'Posted',
  draft: 'Draft',
  reconciled: 'Reconciled',
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${dd}-${mm}-${yyyy} ${time}`;
};

const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (isEmpty(a) && isEmpty(b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

interface LookupCtx {
  banks: Map<number, Bank>;
  categories: Map<number, Category>;
}

const formatFieldValue = (field: string, value: unknown, ctx: LookupCtx): string => {
  if (isEmpty(value)) return '—';
  if (
    field === 'amount' ||
    field.endsWith('_amount') ||
    field === 'opening_balance' ||
    field === 'previous_balance' ||
    field === 'new_balance'
  ) {
    return formatCurrency(Number(value));
  }
  if (field.endsWith('_date')) {
    return formatDate(String(value));
  }
  if (field === 'bank_id') {
    return ctx.banks.get(Number(value))?.bank_name || `Bank #${value}`;
  }
  if (field === 'category_id') {
    return ctx.categories.get(Number(value))?.name || `Category #${value}`;
  }
  if (field === 'is_active') {
    return value ? 'Active' : 'Inactive';
  }
  if (field === 'status') {
    return STATUS_LABELS[String(value)] || String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const relevantEntries = (
  obj: Record<string, unknown> | null | undefined
): [string, unknown][] => {
  if (!obj) return [];
  return Object.entries(obj).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && !isEmpty(v));
};

interface Change {
  field: string;
  old: unknown;
  new: unknown;
}

const computeChanges = (
  oldV: Record<string, unknown> | null | undefined,
  newV: Record<string, unknown> | null | undefined
): Change[] => {
  const keys = new Set<string>([
    ...Object.keys(oldV || {}),
    ...Object.keys(newV || {}),
  ]);
  const changes: Change[] = [];
  keys.forEach((k) => {
    if (HIDDEN_FIELDS.has(k)) return;
    const a = oldV?.[k];
    const b = newV?.[k];
    if (deepEqual(a, b)) return;
    changes.push({ field: k, old: a, new: b });
  });
  // Nice reading order: put money & description first.
  const priority = ['description', 'amount', 'transaction_date', 'due_date'];
  changes.sort((x, y) => {
    const px = priority.indexOf(x.field);
    const py = priority.indexOf(y.field);
    if (px === -1 && py === -1) return x.field.localeCompare(y.field);
    if (px === -1) return 1;
    if (py === -1) return -1;
    return px - py;
  });
  return changes;
};

const LogDetails = ({ log, ctx }: { log: AuditLog; ctx: LookupCtx }) => {
  const label = (field: string) => FIELD_LABELS[field] || field.replace(/_/g, ' ');

  if (log.action === 'update') {
    const changes = computeChanges(log.old_values, log.new_values);
    if (changes.length === 0) {
      return <p className="text-sm text-18-dark-text italic mt-2">No visible field changed.</p>;
    }
    return (
      <ul className="mt-2 space-y-1 text-sm">
        {changes.map((c) => (
          <li key={c.field}>
            <span className="font-semibold text-white">{label(c.field)}:</span>{' '}
            <span className="text-red-400 line-through">
              {formatFieldValue(c.field, c.old, ctx)}
            </span>{' '}
            <span className="text-18-dark-text">→</span>{' '}
            <span className="text-green-300 font-semibold">
              {formatFieldValue(c.field, c.new, ctx)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const heading =
    log.action === 'create'
      ? 'Added'
      : log.action === 'delete'
      ? 'Removed'
      : log.action === 'import'
      ? 'Import summary'
      : log.action === 'export'
      ? 'Export details'
      : 'Details';
  const source = log.action === 'delete' ? log.old_values : log.new_values;
  const rows = relevantEntries(source);
  if (rows.length === 0) return null;

  return (
    <div className="mt-2 text-sm">
      <p className="text-xs uppercase font-bold text-18-dark-text mb-1">{heading}</p>
      <ul className="space-y-1">
        {rows.map(([k, v]) => (
          <li key={k}>
            <span className="font-semibold text-white">{label(k)}:</span>{' '}
            {formatFieldValue(k, v, ctx)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: logsData, error }, { data: usersData }, { data: banksData }, { data: catData }] =
          await Promise.all([
            supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(500),
            supabase.from('users').select('id, email, full_name'),
            supabase.from('banks').select('*'),
            supabase.from('categories').select('*'),
          ]);
        if (error) throw error;
        setLogs(logsData || []);
        setUsers((usersData as User[]) || []);
        setBanks((banksData as Bank[]) || []);
        setCategories((catData as Category[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const userById = useMemo(() => {
    const m = new Map<string, User>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  const ctx: LookupCtx = useMemo(() => {
    const b = new Map<number, Bank>();
    banks.forEach((x) => b.set(x.id, x));
    const c = new Map<number, Category>();
    categories.forEach((x) => c.set(x.id, x));
    return { banks: b, categories: c };
  }, [banks, categories]);

  const entities = useMemo(
    () => Array.from(new Set(logs.map((l) => l.table_name))).sort(),
    [logs]
  );
  const actions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action))).sort(),
    [logs]
  );

  const q = searchQuery.trim().toLowerCase();
  const filtered = logs.filter((l) => {
    if (entityFilter !== 'all' && l.table_name !== entityFilter) return false;
    if (actionFilter !== 'all' && l.action !== actionFilter) return false;
    if (!q) return true;
    const user = l.user_id ? userById.get(l.user_id) : null;
    const haystack = [
      l.description,
      l.action,
      l.table_name,
      user?.full_name,
      user?.email,
      l.old_values ? JSON.stringify(l.old_values) : '',
      l.new_values ? JSON.stringify(l.new_values) : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Activity Log</h1>
        <p className="text-sm text-18-dark-text mt-1">
          Every add, update, delete, import and export is recorded here.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="w-full sm:flex-1 sm:min-w-[240px]">
          <label className="form-label">Search</label>
          <input
            type="text"
            className="form-input"
            placeholder="Search description, user, values…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="form-label">Module</label>
          <select
            className="form-select w-full sm:w-auto sm:min-w-[180px]"
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
          >
            <option value="all">All modules</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {TABLE_LABELS[e] || e}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="form-label">Action</label>
          <select
            className="form-select w-full sm:w-auto sm:min-w-[160px]"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <p className="text-xs uppercase font-bold text-18-dark-text">Total events</p>
          <h3 className="text-xl font-bold text-white">{logs.length}</h3>
        </div>
        <div className="card">
          <p className="text-xs uppercase font-bold text-18-dark-text">Showing</p>
          <h3 className="text-xl font-bold text-white">{filtered.length}</h3>
        </div>
        <div className="card">
          <p className="text-xs uppercase font-bold text-18-dark-text">Modules</p>
          <h3 className="text-xl font-bold text-white">{entities.length}</h3>
        </div>
        <div className="card">
          <p className="text-xs uppercase font-bold text-18-dark-text">Last event</p>
          <h3 className="text-sm font-bold text-white">
            {logs[0] ? formatTime(logs[0].created_at) : '—'}
          </h3>
        </div>
      </div>

      {/* List */}
      <div className="card">
        {filtered.length === 0 ? (
          <p className="text-18-dark-text text-center py-12">No log entries match the filters.</p>
        ) : (
          <ul className="divide-y divide-18-border">
            {filtered.map((log) => {
              const user = log.user_id ? userById.get(log.user_id) : null;
              const isOpen = expandedId === log.id;
              const hasDetails = !!(log.old_values || log.new_values);
              return (
                <li key={log.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        ACTION_COLORS[log.action] || 'text-18-dark-text bg-18-bg'
                      }`}
                    >
                      {actionIcon(log.action)}
                      {log.action.replace('_', ' ')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        {log.description || `${log.action} on ${log.table_name}`}
                      </p>
                      <p className="text-xs text-18-dark-text mt-1">
                        {TABLE_LABELS[log.table_name] || log.table_name}
                        {' · '}
                        {user ? user.full_name || user.email : 'system'}
                        {' · '}
                        {formatTime(log.created_at)}
                      </p>
                      {isOpen && hasDetails && <LogDetails log={log} ctx={ctx} />}
                    </div>
                    {hasDetails && (
                      <button
                        onClick={() => setExpandedId(isOpen ? null : log.id)}
                        className="text-xs text-18-orange hover:underline whitespace-nowrap"
                      >
                        {isOpen ? 'Hide' : 'Details'}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
