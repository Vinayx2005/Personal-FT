'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { logAction } from '@/lib/auditLog';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

export default function QuickAddPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/');
      } else {
        setAuthChecked(true);
        // Autofocus the input so users can start typing immediately
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length < 4) {
        setFeedback({
          type: 'error',
          text: 'Need 4 lines: amount / description / category / bank',
        });
        return;
      }

      const [amountStr, description, categoryName, bankKeyword] = lines;

      const amount = parseFloat(amountStr.replace(/[,₹\s]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        setFeedback({
          type: 'error',
          text: `Line 1 must be a positive number. Got: "${amountStr}"`,
        });
        return;
      }

      const { data: cats, error: catsErr } = await supabase
        .from('categories')
        .select('id, name')
        .eq('type', 'expense');
      if (catsErr) throw catsErr;
      let category = (cats || []).find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      let createdCategory = false;
      if (!category) {
        // Auto-create the category as an expense category. Case-insensitive
        // uniqueness is enforced by the code (existing lookup above) — the
        // DB uses UNIQUE(type, name), so retype in the same casing is safe.
        const { data: newCat, error: createErr } = await supabase
          .from('categories')
          .insert({ type: 'expense', name: categoryName.trim(), is_default: false })
          .select('id, name')
          .single();
        if (createErr) throw createErr;
        category = newCat;
        createdCategory = true;
      }

      const { data: banks, error: banksErr } = await supabase
        .from('banks')
        .select('id, bank_name')
        .eq('is_active', true);
      if (banksErr) throw banksErr;
      const kw = bankKeyword.toLowerCase();
      const matches = (banks || []).filter((b) =>
        b.bank_name.toLowerCase().includes(kw)
      );
      if (matches.length === 0) {
        const options = (banks || []).map((b) => b.bank_name).join(', ');
        setFeedback({
          type: 'error',
          text: `No bank matches "${bankKeyword}"\n\nOptions: ${options || '(none set up yet)'}`,
        });
        return;
      }
      if (matches.length > 1) {
        const options = matches.map((b) => b.bank_name).join(', ');
        setFeedback({
          type: 'error',
          text: `"${bankKeyword}" matches multiple banks: ${options}\n\nBe more specific.`,
        });
        return;
      }
      const bank = matches[0];

      const today = new Date().toISOString().slice(0, 10);
      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .insert({
          transaction_type: 'expense',
          bank_id: bank.id,
          category_id: category.id,
          description,
          amount,
          transaction_date: today,
          payee_name: '',
          notes: 'via quick add',
          status: 'posted',
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      logAction({
        action: 'create',
        table_name: 'transactions',
        record_id: inserted?.id,
        description: `Quick add: ${formatCurrency(amount)} · ${description} · ${category.name} / ${bank.bank_name}`,
        new_values: {
          amount,
          description,
          category: category.name,
          bank: bank.bank_name,
        },
      });

      setFeedback({
        type: 'success',
        text: `Saved ${formatCurrency(amount)} · ${category.name} / ${bank.bank_name}${
          createdCategory ? ` (new category created)` : ''
        }`,
      });
      setText('');
      // Refocus for next entry
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Something went wrong.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-18-bg">
        <div className="spinner w-12 h-12"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-18-bg flex flex-col">
      {/* Compact header */}
      <header className="px-4 py-3 border-b border-18-border bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-18-charcoal">Quick Add</h1>
          <p className="text-xs text-18-dark-text">Log an expense in one shot</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-18-orange hover:underline"
        >
          Dashboard →
        </Link>
      </header>

      {/* Main entry area */}
      <main className="flex-1 flex flex-col px-4 py-4 gap-3 max-w-lg w-full mx-auto">
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-3">
          <label className="text-xs font-bold uppercase text-18-dark-text tracking-wide">
            4-line format
          </label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (feedback) setFeedback(null);
            }}
            placeholder={'500\nGroceries at DMart\nFood & Groceries\nHDFC'}
            rows={8}
            className="w-full flex-1 min-h-[180px] p-4 border-2 border-18-border rounded-18-md text-base font-mono resize-none focus:outline-none focus:border-18-orange bg-white"
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck={false}
          />

          {feedback && (
            <div
              className={`p-3 rounded-18-sm text-sm whitespace-pre-wrap ${
                feedback.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {feedback.type === 'success' ? '✓ ' : '✗ '}
              {feedback.text}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || text.trim().length === 0}
            className="btn btn-primary text-base py-3 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Save Expense'}
          </button>
        </form>

        {/* Format reminder */}
        <div className="text-xs text-18-dark-text bg-white border border-18-border rounded-18-sm p-3 leading-relaxed">
          <p className="font-bold uppercase text-[10px] tracking-wide mb-1">Format</p>
          <p>Line 1: <strong>amount</strong> (e.g. 500)</p>
          <p>Line 2: <strong>description</strong></p>
          <p>Line 3: <strong>category</strong> (auto-created if new)</p>
          <p>Line 4: <strong>bank</strong> (keyword, e.g. &quot;HDFC&quot;)</p>
        </div>
      </main>
    </div>
  );
}
