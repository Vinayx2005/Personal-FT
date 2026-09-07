'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Search, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface Result {
  key: string;
  label: string;
  sub: string;
  module: string;
  href: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    transactions: any[];
    banks: any[];
    categories: any[];
    users: any[];
  }>({ transactions: [], banks: [], categories: [], users: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (!data.transactions.length && !loading) {
        loadAll();
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tx, banks, cats, users] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, transaction_type, description, amount, transaction_date, notes')
          .order('transaction_date', { ascending: false })
          .limit(500),
        supabase.from('banks').select('id, bank_name').limit(200),
        supabase.from('categories').select('id, type, name').limit(500),
        supabase.from('users').select('id, full_name, email').limit(200),
      ]);
      setData({
        transactions: tx.data || [],
        banks: banks.data || [],
        categories: cats.data || [],
        users: users.data || [],
      });
    } finally {
      setLoading(false);
    }
  };

  const results: Result[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = (s: string | null | undefined) =>
      !!s && s.toLowerCase().includes(q);

    const out: Result[] = [];

    for (const t of data.transactions) {
      if (
        matches(t.description) ||
        matches(t.notes) ||
        String(t.amount).includes(q)
      ) {
        const kind = t.transaction_type === 'income' ? 'Income' : 'Expense';
        out.push({
          key: `tx-${t.id}`,
          label: `${kind}: ${t.description || '(no description)'}`,
          sub: `${formatCurrency(t.amount)} · ${formatDate(t.transaction_date)}`,
          module: kind,
          href:
            (t.transaction_type === 'income' ? '/dashboard/income' : '/dashboard/expenses') +
            `#row-tx-${t.id}`,
        });
      }
    }
    for (const b of data.banks) {
      if (matches(b.bank_name)) {
        out.push({
          key: `bank-${b.id}`,
          label: `Bank: ${b.bank_name}`,
          sub: 'Bank / Card',
          module: 'Settings',
          href: '/dashboard/settings',
        });
      }
    }
    for (const c of data.categories) {
      if (matches(c.name)) {
        out.push({
          key: `cat-${c.id}`,
          label: `Category: ${c.name}`,
          sub: `${c.type}`,
          module: 'Settings',
          href: '/dashboard/settings',
        });
      }
    }
    for (const u of data.users) {
      if (matches(u.full_name) || matches(u.email)) {
        out.push({
          key: `user-${u.id}`,
          label: `Team member: ${u.full_name || u.email}`,
          sub: u.email,
          module: 'Settings',
          href: '/dashboard/settings',
        });
      }
    }
    return out.slice(0, 60);
  }, [query, data]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-18-sm border border-18-border bg-18-surface hover:border-18-orange transition-colors text-sm text-18-dark-text w-full sm:w-72 md:w-96"
        title="Search (Ctrl+K)"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search…</span>
        <span className="hidden md:inline text-xs text-18-dark-text px-1.5 py-0.5 rounded border border-18-border">
          Ctrl+K
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center pt-12 sm:pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-18-surface rounded-18-md shadow-xl w-full max-w-2xl mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 p-3 border-b border-18-border">
              <Search size={18} className="text-18-dark-text" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search transactions, banks, categories, team…"
                className="flex-1 outline-none text-sm bg-transparent"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                onClick={() => setOpen(false)}
                className="text-18-dark-text hover:text-white"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {loading && (
                <p className="text-center text-sm text-18-dark-text py-8">Loading data…</p>
              )}
              {!loading && !query && (
                <p className="text-center text-sm text-18-dark-text py-8">
                  Type to search across every module.
                </p>
              )}
              {!loading && query && results.length === 0 && (
                <p className="text-center text-sm text-18-dark-text py-8">No matches for &quot;{query}&quot;.</p>
              )}
              {results.length > 0 && (
                <ul className="divide-y divide-18-border">
                  {results.map((r) => (
                    <li key={r.key}>
                      <Link
                        href={r.href}
                        onClick={() => setOpen(false)}
                        className="flex items-start justify-between gap-3 px-4 py-2 hover:bg-18-surface-2"
                      >
                        <div>
                          <p className="text-sm text-white font-semibold">{r.label}</p>
                          <p className="text-xs text-18-dark-text">{r.sub}</p>
                        </div>
                        <span className="text-xs text-18-orange font-semibold whitespace-nowrap">
                          {r.module}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
