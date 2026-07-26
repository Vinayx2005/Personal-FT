'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { logAction } from '@/lib/auditLog';
import { fetchCurrentStreak } from '@/lib/streak';
import { parseVoiceInput, toQuickAddText } from '@/lib/voiceParse';
import { Flame, Zap, Check, AlertCircle, Mic, Loader2 } from 'lucide-react';

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
        const { data: newCat, error: createErr } = await supabase
          .from('categories')
          .insert({ type: 'expense', name: categoryName.trim(), is_default: false, user_id: userId })
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
        text: `Saved ${formatCurrency(amount)} · ${category.name} / ${bank.bank_name}${
          createdCategory ? ` (new category created)` : ''
        }`,
      });
      setText('');
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
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript || '';
      const parsed = parseVoiceInput(transcript, banks, categories);
      const nextText = toQuickAddText(parsed);
      setText(nextText);
      setVoiceTranscript(transcript);
      setVoiceMissing(parsed.missing);
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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-white tracking-tight">Quick Add</h1>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-18-orange/15 border border-18-orange/40 rounded-full px-3 py-1 text-xs font-bold text-18-orange shadow-[0_0_20px_-5px_rgba(243,115,53,0.5)]">
                <Flame size={12} /> {streak}-day streak
              </span>
            )}
          </div>
          <p className="text-sm text-white/50">
            Log an expense in one shot — 4 lines, done.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry area */}
        <div className="lg:col-span-2 relative overflow-hidden bg-18-surface border border-18-border rounded-2xl p-6 shadow-[inset_0_0_120px_-40px_rgba(243,115,53,0.15)]">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-18-orange/15 border border-18-orange/40 flex items-center justify-center">
                <Zap className="text-18-orange" size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">4-line format</p>
                <p className="text-xs text-white/50">amount / description / category / bank</p>
              </div>
            </div>

            {/* Voice input */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={voiceState === 'unsupported'}
              title={
                voiceState === 'listening'
                  ? 'Stop listening'
                  : 'Speak to fill — e.g. "Paid 500 for noodles from SBI today"'
              }
              className={`relative h-11 w-11 rounded-full flex items-center justify-center transition-all shrink-0 ${
                voiceState === 'listening'
                  ? 'bg-18-orange text-white shadow-[0_0_30px_rgba(243,115,53,0.75)]'
                  : 'bg-18-orange/15 border border-18-orange/40 text-18-orange hover:bg-18-orange/25'
              }`}
              aria-label="Voice input"
            >
              {voiceState === 'listening' ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="absolute inset-0 rounded-full bg-18-orange/40 animate-ping" />
                </>
              ) : (
                <Mic size={18} />
              )}
            </button>
          </div>

          {voiceState === 'listening' && (
            <div className="mb-3 flex items-center gap-2 text-xs text-18-orange font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-18-orange animate-pulse" />
              Listening… speak now
            </div>
          )}

          {voiceTranscript && (
            <div className="mb-3 p-3 rounded-xl bg-18-bg border border-18-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-1">
                Heard
              </p>
              <p className="text-sm text-white italic">&ldquo;{voiceTranscript}&rdquo;</p>
              {voiceMissing.length > 0 && (
                <p className="text-xs text-yellow-300/80 mt-2">
                  Couldn&apos;t catch: <strong>{voiceMissing.join(', ')}</strong> — fill in above.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (feedback) setFeedback(null);
              }}
              placeholder={'500\nGroceries at DMart\nFood & Groceries\nHDFC'}
              rows={7}
              className="w-full min-h-[200px] p-4 bg-18-bg border border-18-border rounded-xl text-base font-mono text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-18-orange transition-colors"
              autoCapitalize="sentences"
              autoCorrect="on"
              spellCheck={false}
            />

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
