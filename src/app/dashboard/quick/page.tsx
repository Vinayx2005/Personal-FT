'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateISO } from '@/lib/utils';
import { logAction } from '@/lib/auditLog';
import { fetchCurrentStreak } from '@/lib/streak';
import { parseVoiceInput, toQuickAddText } from '@/lib/voiceParse';
import { Flame, Check, AlertCircle, Mic } from 'lucide-react';
import AddToHomeButton from '@/components/AddToHomeButton';

interface Feedback {
  type: 'success' | 'error';
  text: string;
}

export default function QuickAddPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [spendDate, setSpendDate] = useState<string>(() => formatDateISO(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  // Voice input state
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'unsupported'>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [voiceMissing, setVoiceMissing] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/');
      } else {
        setUserId(user.id);
        setAuthChecked(true);
        fetchCurrentStreak().then(setStreak);
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
        // Upsert — if another tab created this same category between our
        // SELECT and INSERT, we still get its id back instead of a UNIQUE
        // violation that would fail the whole quick-add.
        const { data: newCat, error: createErr } = await supabase
          .from('categories')
          .upsert(
            { type: 'expense', name: categoryName.trim(), is_default: false, user_id: userId },
            { onConflict: 'user_id,type,name' }
          )
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

      // Fall back to today if the date input got cleared somehow.
      const useDate = spendDate || formatDateISO(new Date());
      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .insert({
          transaction_type: 'expense',
          bank_id: bank.id,
          category_id: category.id,
          description,
          amount,
          transaction_date: useDate,
          notes: 'via quick add',
          status: 'posted',
          created_by: userId,
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
        text: `Saved ${formatCurrency(amount)} on ${useDate} · ${category.name} / ${bank.bank_name}${
          createdCategory ? ` (new category created)` : ''
        }`,
      });
      setText('');
      setSpendDate(formatDateISO(new Date()));
      setVoiceTranscript(null);
      setVoiceMissing([]);
      fetchCurrentStreak().then(setStreak);
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

  // ---------- Voice input ----------

  const handleMicClick = async () => {
    // If already listening, stop.
    if (voiceState === 'listening') {
      recognitionRef.current?.stop();
      return;
    }

    const SR: any =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (!SR) {
      setVoiceState('unsupported');
      setFeedback({
        type: 'error',
        text: 'Voice input isn’t supported in this browser. Try Chrome (desktop or Android) or Safari 14.5+.',
      });
      return;
    }

    // Pull user's actual banks + categories so the parser can match against them
    const [banksRes, catsRes] = await Promise.all([
      supabase.from('banks').select('bank_name').eq('is_active', true),
      supabase.from('categories').select('name').eq('type', 'expense'),
    ]);
    const banks: string[] = (banksRes.data || []).map((b: any) => b.bank_name).filter(Boolean);
    const categories: string[] = (catsRes.data || []).map((c: any) => c.name).filter(Boolean);

    const recognition = new SR();
    // en-IN handles Indian English + common Hinglish words. The parser also
    // understands sau/hazaar/lakh and aaj/kal/parso when they slip through.
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    // Multiple candidates so we can retry the parse against alternates if the
    // top result comes back missing key fields.
    recognition.maxAlternatives = 3;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      // Try each alternate; pick the parse with the fewest missing fields.
      // Ties go to the top (highest-confidence) result.
      const alts: string[] = [];
      const first = event.results[0];
      for (let i = 0; i < first.length; i++) {
        const t = (first[i]?.transcript || '').trim();
        if (t) alts.push(t);
      }
      if (alts.length === 0) return;

      let bestParsed = parseVoiceInput(alts[0], banks, categories);
      let bestTranscript = alts[0];
      for (let i = 1; i < alts.length; i++) {
        const p = parseVoiceInput(alts[i], banks, categories);
        if (p.missing.length < bestParsed.missing.length) {
          bestParsed = p;
          bestTranscript = alts[i];
        }
      }

      const nextText = toQuickAddText(bestParsed);
      setText(nextText);
      setSpendDate(bestParsed.date);
      setVoiceTranscript(bestTranscript);
      setVoiceMissing(bestParsed.missing);
      // Highlight in the textarea for quick edits
      setTimeout(() => textareaRef.current?.focus(), 50);
    };
    recognition.onerror = (event: any) => {
      setVoiceState('idle');
      const kind = event?.error || 'error';
      const friendly =
        kind === 'not-allowed' || kind === 'service-not-allowed'
          ? 'Mic permission blocked. Allow microphone access for this site.'
          : kind === 'no-speech'
          ? 'Didn’t catch that — try again.'
          : `Voice input failed (${kind}).`;
      setFeedback({ type: 'error', text: friendly });
    };
    recognition.onend = () => {
      setVoiceState('idle');
    };

    setFeedback(null);
    setVoiceTranscript(null);
    setVoiceMissing([]);
    setVoiceState('listening');
    try {
      recognition.start();
    } catch {
      setVoiceState('idle');
    }
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header — mirrors dashboard style */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">Quick Add</h1>
          <p className="text-sm text-white/50">
            Log an expense in one shot — 4 lines, done.
          </p>
        </div>
        <AddToHomeButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry area — voice-first */}
        <div className="lg:col-span-2 relative overflow-hidden bg-18-surface border border-18-border rounded-2xl p-6 shadow-[inset_0_0_120px_-40px_rgba(243,115,53,0.15)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
              Voice Add
            </p>
            {streak > 0 && <Flame size={14} className="text-18-orange" />}
          </div>

          {/* Big pulsing mic — the centrepiece */}
          <div className="flex flex-col items-center py-8">
            <div className="relative flex items-center justify-center w-24 h-24 md:w-28 md:h-28">
              {voiceState === 'listening' && (
                <>
                  <span
                    className="absolute inset-0 rounded-full bg-18-orange/50 animate-ping"
                    aria-hidden
                  />
                  <span
                    className="absolute inset-2 rounded-full bg-18-orange/30 animate-ping"
                    style={{ animationDelay: '0.5s' }}
                    aria-hidden
                  />
                </>
              )}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={voiceState === 'unsupported'}
                title={
                  voiceState === 'listening'
                    ? 'Tap to stop'
                    : 'Tap and speak — e.g. "Paid 500 for groceries from HDFC"'
                }
                className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all shadow-[0_0_60px_-5px_rgba(243,115,53,0.7)] disabled:opacity-40 disabled:cursor-not-allowed ${
                  voiceState === 'listening'
                    ? 'bg-18-orange scale-105'
                    : 'bg-18-orange hover:scale-105 active:scale-95'
                }`}
                aria-label={voiceState === 'listening' ? 'Stop listening' : 'Start voice input'}
              >
                <Mic className="text-white" size={36} />
              </button>
            </div>
            <p className="mt-5 text-[10px] uppercase tracking-[0.2em] font-bold text-white/50">
              {voiceState === 'listening'
                ? 'Listening…'
                : voiceState === 'unsupported'
                ? 'Voice not supported'
                : 'Tap to speak'}
            </p>
            {voiceState === 'idle' && !voiceTranscript && (
              <div className="mt-2 text-xs text-white/40 max-w-sm text-center space-y-1">
                <p className="italic">&ldquo;Paid 500 for groceries yesterday from HDFC&rdquo;</p>
                <p className="italic">&ldquo;Do hazaar for petrol on Saturday from ICICI&rdquo;</p>
              </div>
            )}
          </div>

          {voiceTranscript && (
            <div className="mb-5 p-4 rounded-xl bg-18-bg border border-18-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                You said
              </p>
              <p className="text-sm text-white italic">&ldquo;{voiceTranscript}&rdquo;</p>
              {voiceMissing.length > 0 && (
                <p className="text-xs text-yellow-300/80 mt-2">
                  Couldn&apos;t catch: <strong>{voiceMissing.join(', ')}</strong> — edit below.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                {voiceTranscript ? 'Parsed · edit if needed' : 'Or type it manually'}
              </p>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (feedback) setFeedback(null);
                }}
                placeholder={'500\nGroceries at DMart\nFood & Groceries\nHDFC'}
                rows={7}
                className="w-full min-h-[180px] p-4 bg-18-bg border border-18-border rounded-xl text-base font-mono text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-18-orange transition-colors"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck={false}
              />
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                Date of spend
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={spendDate}
                  max={formatDateISO(new Date())}
                  onChange={(e) => setSpendDate(e.target.value)}
                  className="flex-1 min-w-0 p-3 bg-18-bg border border-18-border rounded-xl text-sm text-white focus:outline-none focus:border-18-orange transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setSpendDate(formatDateISO(new Date()))}
                  className="px-3 py-2 text-xs font-semibold bg-18-bg border border-18-border rounded-lg text-white/70 hover:text-white hover:border-white/30 transition-colors"
                  title="Set to today"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setSpendDate(formatDateISO(d));
                  }}
                  className="px-3 py-2 text-xs font-semibold bg-18-bg border border-18-border rounded-lg text-white/70 hover:text-white hover:border-white/30 transition-colors"
                  title="Set to yesterday"
                >
                  Yesterday
                </button>
              </div>
            </div>

            {feedback && (
              <div
                className={`p-4 rounded-xl text-sm whitespace-pre-wrap flex items-start gap-3 ${
                  feedback.type === 'success'
                    ? 'bg-green-900/30 border border-green-800/40 text-green-300'
                    : 'bg-red-900/30 border border-red-800/40 text-red-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <Check size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                <span className="flex-1">{feedback.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || text.trim().length === 0}
              className="w-full py-3 bg-18-orange text-white font-semibold rounded-xl hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_10px_30px_-5px_rgba(243,115,53,0.5)]"
            >
              {submitting ? 'Saving…' : 'Save Expense'}
            </button>
          </form>
        </div>

        {/* Format reminder + tips */}
        <div className="space-y-4">
          <div className="bg-18-surface border border-18-border rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-4">
              Format
            </p>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-18-orange/15 border border-18-orange/40 text-18-orange text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <p className="text-white font-semibold">Amount</p>
                  <p className="text-xs text-white/50">Number only, e.g. 500</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-18-orange/15 border border-18-orange/40 text-18-orange text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <p className="text-white font-semibold">Description</p>
                  <p className="text-xs text-white/50">What was it for?</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-18-orange/15 border border-18-orange/40 text-18-orange text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <p className="text-white font-semibold">Category</p>
                  <p className="text-xs text-white/50">Auto-created if new</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-18-orange/15 border border-18-orange/40 text-18-orange text-xs font-bold flex items-center justify-center shrink-0">4</span>
                <div>
                  <p className="text-white font-semibold">Bank</p>
                  <p className="text-xs text-white/50">Keyword match (e.g. &quot;HDFC&quot;)</p>
                </div>
              </li>
            </ol>
          </div>

          <div className="bg-18-surface border border-18-border rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
              Say the date
            </p>
            <ul className="space-y-1.5 text-xs text-white/70">
              <li><span className="text-white font-mono">today</span> / <span className="text-white font-mono">aaj</span></li>
              <li><span className="text-white font-mono">yesterday</span> / <span className="text-white font-mono">kal</span></li>
              <li><span className="text-white font-mono">day before yesterday</span> / <span className="text-white font-mono">parso</span></li>
              <li><span className="text-white font-mono">last Saturday</span>, <span className="text-white font-mono">on Friday</span></li>
              <li><span className="text-white font-mono">3 days ago</span></li>
              <li><span className="text-white font-mono">15 Dec</span>, <span className="text-white font-mono">15/12</span></li>
            </ul>
          </div>

          <div className="bg-18-surface border border-18-border rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
              Say the amount
            </p>
            <ul className="space-y-1.5 text-xs text-white/70">
              <li><span className="text-white font-mono">500 rupees</span></li>
              <li><span className="text-white font-mono">paanch sau</span> = 500</li>
              <li><span className="text-white font-mono">do hazaar</span> = 2000</li>
              <li><span className="text-white font-mono">2 lakh</span> = 200000</li>
              <li><span className="text-white font-mono">99 rupees 50 paise</span> = 99.50</li>
            </ul>
          </div>

          <div className="bg-18-orange/5 border border-18-orange/30 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-18-orange mb-2">
              💡 Pro tip
            </p>
            <p className="text-sm text-white/80 leading-relaxed">
              Add this app to your home screen — then tap the icon and log a
              spend in <strong className="text-white">under 10 seconds</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
