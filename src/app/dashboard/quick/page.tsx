'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateISO } from '@/lib/utils';
import { logAction } from '@/lib/auditLog';
import { fetchCurrentStreak } from '@/lib/streak';
import { parseVoiceInput } from '@/lib/voiceParse';
import {
  Mic,
  Send,
  Check,
  Edit2,
  X,
  Flame,
  Bot as BotIcon,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import AddToHomeButton from '@/components/AddToHomeButton';

// ---------- Types ----------

type Draft = {
  amount: number | null;
  description: string;
  category: string | null;
  bank: string | null;
  date: string; // YYYY-MM-DD
};

type BotText   = { id: string; role: 'bot';  kind: 'text';    text: string;    ts: number };
type BotError  = { id: string; role: 'bot';  kind: 'error';   text: string;    ts: number };
type BotSaved  = { id: string; role: 'bot';  kind: 'saved';   draft: Draft;    ts: number };
type BotPreview = {
  id: string;
  role: 'bot';
  kind: 'preview';
  draft: Draft;
  missing: string[];
  ts: number;
  status: 'active' | 'confirmed' | 'cancelled';
  editing: boolean;
};
type UserText  = { id: string; role: 'user'; kind: 'text';    text: string;    ts: number };
type UserVoice = { id: string; role: 'user'; kind: 'voice';   transcript: string; ts: number };

type ChatMessage = BotText | BotError | BotSaved | BotPreview | UserText | UserVoice;

// ---------- Helpers ----------

const now = () => Date.now();
const rid = () => Math.random().toString(36).slice(2, 10);

const emptyDraft = (): Draft => ({
  amount: null,
  description: '',
  category: null,
  bank: null,
  date: formatDateISO(new Date()),
});

// Chat persistence — key is scoped by user id so if another account signs in
// on the same browser they don't see this user's chat. Version prefix lets us
// bump the schema later without reading incompatible payloads.
const CHAT_STORAGE_VERSION = 1;
const CHAT_MAX_MESSAGES = 300;
const chatKey = (uid: string) => `pft_chat_v${CHAT_STORAGE_VERSION}_${uid}`;

function loadChatHistory(uid: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(chatKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // Restored preview cards from an earlier session can't be confirmed —
    // their in-memory state (banks/categories the parse matched against) is
    // gone. Show them as historical "cancelled" entries with no buttons.
    // Also force editing:false so a card left open in edit mode last time
    // doesn't come back with a live form.
    return parsed.map((m: any) => {
      if (m?.role === 'bot' && m?.kind === 'preview') {
        return {
          ...m,
          editing: false,
          status: m.status === 'active' ? 'cancelled' : m.status,
        };
      }
      return m;
    }) as ChatMessage[];
  } catch {
    return null;
  }
}

function fmtClock(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDatePretty(iso: string): string {
  const today = formatDateISO(new Date());
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = formatDateISO(y);
  if (iso === today) return 'Today';
  if (iso === yesterday) return 'Yesterday';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ---------- Component ----------

export default function QuickChatPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);

  // The bot loads the user's actual categories + banks so the parser can
  // match against them and the edit form can offer them as dropdowns.
  const [bankNames, setBankNames] = useState<string[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'unsupported'>('idle');
  const recognitionRef = useRef<any>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---------- Boot ----------

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/');
        return;
      }
      setUserId(user.id);
      setAuthChecked(true);

      // Fetch banks + categories in parallel so the parser has real names
      // to match against right from the first message.
      const [banksRes, catsRes] = await Promise.all([
        supabase.from('banks').select('bank_name').eq('is_active', true),
        supabase.from('categories').select('name').eq('type', 'expense'),
      ]);
      setBankNames((banksRes.data || []).map((b: any) => b.bank_name).filter(Boolean));
      setCategoryNames((catsRes.data || []).map((c: any) => c.name).filter(Boolean));

      fetchCurrentStreak().then(setStreak);

      // Restore chat history if we have any — otherwise post the greeting so
      // first-time users see the intro. Returning users just pick up their
      // conversation where they left off.
      const restored = loadChatHistory(user.id);
      if (restored && restored.length > 0) {
        setMessages(restored);
      } else {
        setMessages([
          {
            id: rid(),
            role: 'bot',
            kind: 'text',
            text: "Hi 👋 I'm your expense buddy. Text or 🎙 tap the mic and tell me what you spent — English or Hinglish both work.\n\nTry:\n• Paid 500 for lunch yesterday from HDFC\n• Do hazaar for petrol on Saturday from ICICI\n• 99 rupees for chai from cash",
            ts: now(),
          },
        ]);
      }
    });
  }, [router]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Persist chat to localStorage whenever it changes. Trimmed to the last
  // CHAT_MAX_MESSAGES to keep the payload well under quota — chats older than
  // ~300 messages fall off the top (they were history-only anyway).
  useEffect(() => {
    if (!userId || messages.length === 0) return;
    try {
      const trimmed =
        messages.length > CHAT_MAX_MESSAGES
          ? messages.slice(-CHAT_MAX_MESSAGES)
          : messages;
      localStorage.setItem(chatKey(userId), JSON.stringify(trimmed));
    } catch {
      // Quota exceeded or storage disabled — silent, chat still works
      // in-memory for this session.
    }
  }, [messages, userId]);

  // ---------- Message helpers ----------

  const push = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);

  const pushBotText = (text: string) =>
    push({ id: rid(), role: 'bot', kind: 'text', text, ts: now() });

  const pushBotError = (text: string) =>
    push({ id: rid(), role: 'bot', kind: 'error', text, ts: now() });

  // ---------- Send handlers ----------

  const handleSendText = () => {
    const t = inputText.trim();
    if (!t) return;
    setInputText('');
    push({ id: rid(), role: 'user', kind: 'text', text: t, ts: now() });
    parseAndPreview(t);
  };

  const parseAndPreview = (text: string) => {
    const parsed = parseVoiceInput(text, bankNames, categoryNames);
    const draft: Draft = {
      amount: parsed.amount,
      description: parsed.description || '',
      category: parsed.category,
      bank: parsed.bank,
      date: parsed.date,
    };
    push({
      id: rid(),
      role: 'bot',
      kind: 'preview',
      draft,
      missing: parsed.missing,
      status: 'active',
      editing: false,
      ts: now(),
    });
  };

  // ---------- Voice ----------

  const handleMic = () => {
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
      pushBotError("Voice input isn't supported in this browser. Try Chrome (desktop or Android) or Safari 14.5+.");
      return;
    }

    const recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      // Pick the alternate with the best parse (fewest missing fields).
      const alts: string[] = [];
      const first = event.results[0];
      for (let i = 0; i < first.length; i++) {
        const t = (first[i]?.transcript || '').trim();
        if (t) alts.push(t);
      }
      if (alts.length === 0) return;

      let bestParsed = parseVoiceInput(alts[0], bankNames, categoryNames);
      let bestT = alts[0];
      for (let i = 1; i < alts.length; i++) {
        const p = parseVoiceInput(alts[i], bankNames, categoryNames);
        if (p.missing.length < bestParsed.missing.length) {
          bestParsed = p;
          bestT = alts[i];
        }
      }

      push({ id: rid(), role: 'user', kind: 'voice', transcript: bestT, ts: now() });
      const draft: Draft = {
        amount: bestParsed.amount,
        description: bestParsed.description || '',
        category: bestParsed.category,
        bank: bestParsed.bank,
        date: bestParsed.date,
      };
      push({
        id: rid(),
        role: 'bot',
        kind: 'preview',
        draft,
        missing: bestParsed.missing,
        status: 'active',
        editing: false,
        ts: now(),
      });
    };
    recognition.onerror = (event: any) => {
      setVoiceState('idle');
      const kind = event?.error || 'error';
      const friendly =
        kind === 'not-allowed' || kind === 'service-not-allowed'
          ? 'Mic permission blocked. Allow microphone access for this site.'
          : kind === 'no-speech'
          ? "Didn't catch that — try again."
          : `Voice input failed (${kind}).`;
      pushBotError(friendly);
    };
    recognition.onend = () => setVoiceState('idle');

    setVoiceState('listening');
    try {
      recognition.start();
    } catch {
      setVoiceState('idle');
    }
  };

  // ---------- Preview actions ----------

  const setPreview = (id: string, patch: Partial<BotPreview>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id && m.role === 'bot' && m.kind === 'preview' ? { ...m, ...patch } : m))
    );
  };

  const startEdit = (id: string) => {
    setPreview(id, { editing: true });
  };

  const cancelEdit = (id: string) => {
    setPreview(id, { editing: false });
  };

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id || m.role !== 'bot' || m.kind !== 'preview') return m;
        const nextDraft = { ...m.draft, ...patch };
        // Recompute missing on the fly so the Confirm button enables as soon
        // as required fields are filled.
        const missing: string[] = [];
        if (nextDraft.amount === null || isNaN(nextDraft.amount) || nextDraft.amount <= 0) missing.push('amount');
        if (!nextDraft.category) missing.push('category');
        if (!nextDraft.bank) missing.push('bank');
        return { ...m, draft: nextDraft, missing };
      })
    );
  };

  const dismissPreview = (id: string) => {
    setPreview(id, { status: 'cancelled', editing: false });
    pushBotText('Cancelled. Tell me the next one whenever you\'re ready.');
  };

  const confirmPreview = async (msg: BotPreview) => {
    const { draft } = msg;
    if (!userId) return;
    if (draft.amount === null || draft.amount <= 0 || !draft.category || !draft.bank) {
      pushBotError('Missing required fields — hit Edit and fill them in first.');
      return;
    }

    setPreview(msg.id, { status: 'confirmed', editing: false });

    try {
      // Resolve / create the category.
      const { data: cats, error: catsErr } = await supabase
        .from('categories')
        .select('id, name')
        .eq('type', 'expense');
      if (catsErr) throw catsErr;
      let category = (cats || []).find(
        (c) => c.name.toLowerCase() === draft.category!.toLowerCase()
      );
      let createdCategory = false;
      if (!category) {
        const { data: newCat, error: createErr } = await supabase
          .from('categories')
          .upsert(
            { type: 'expense', name: draft.category!.trim(), is_default: false, user_id: userId },
            { onConflict: 'user_id,type,name' }
          )
          .select('id, name')
          .single();
        if (createErr) throw createErr;
        category = newCat;
        createdCategory = true;
        setCategoryNames((prev) => (prev.includes(category!.name) ? prev : [...prev, category!.name]));
      }

      // Resolve the bank (must match one of the user's existing banks).
      const { data: banks, error: banksErr } = await supabase
        .from('banks')
        .select('id, bank_name')
        .eq('is_active', true);
      if (banksErr) throw banksErr;
      const kw = draft.bank!.toLowerCase();
      const matches = (banks || []).filter((b) => b.bank_name.toLowerCase().includes(kw));
      if (matches.length === 0) {
        // Roll back to active so user can edit.
        setPreview(msg.id, { status: 'active' });
        pushBotError(
          `No bank matches "${draft.bank}". Options: ${(banks || []).map((b) => b.bank_name).join(', ') || '(none yet — add one in Settings)'}`
        );
        return;
      }
      if (matches.length > 1) {
        setPreview(msg.id, { status: 'active' });
        pushBotError(
          `"${draft.bank}" matches multiple banks: ${matches.map((b) => b.bank_name).join(', ')}. Be more specific.`
        );
        return;
      }
      const bank = matches[0];

      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .insert({
          transaction_type: 'expense',
          bank_id: bank.id,
          category_id: category.id,
          description: draft.description || category.name,
          amount: draft.amount,
          transaction_date: draft.date,
          notes: 'via quick chat',
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
        description: `Quick chat: ${formatCurrency(draft.amount)} · ${draft.description || category.name} · ${category.name} / ${bank.bank_name}`,
        new_values: {
          amount: draft.amount,
          description: draft.description || category.name,
          category: category.name,
          bank: bank.bank_name,
        },
      });

      push({
        id: rid(),
        role: 'bot',
        kind: 'saved',
        draft: { ...draft, category: category.name, bank: bank.bank_name },
        ts: now(),
      });
      if (createdCategory) pushBotText(`Also created a new category: ${category.name}`);
      pushBotText('Anything else?');
      fetchCurrentStreak().then(setStreak);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (err: any) {
      setPreview(msg.id, { status: 'active' });
      pushBotError(err.message || 'Something went wrong while saving.');
    }
  };

  // ---------- Render ----------

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  return (
    // 100dvh so mobile keyboards shrink the chat area instead of scrolling it.
    // Tighter height on phones (smaller top bar area) than on md+.
    <div className="flex flex-col h-[calc(100dvh-88px)] md:h-[calc(100dvh-120px)]">
      {/* ----- Chat header ----- */}
      <div className="flex items-center gap-2 mb-2 md:mb-3 pb-2 md:pb-3 border-b border-18-border">
        <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-18-orange flex items-center justify-center shadow-[0_0_18px_-4px_rgba(243,115,53,0.7)] shrink-0">
          <BotIcon size={16} className="text-white md:!size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm md:text-base font-bold text-white leading-tight truncate">Expense Buddy</h1>
          <p className="text-[10px] md:text-[11px] text-white/50 leading-tight truncate">Chat to log a spend</p>
        </div>
        {streak > 0 && (
          <div className="inline-flex items-center gap-1 text-xs font-bold text-18-orange shrink-0">
            <Flame size={13} /> {streak}d
          </div>
        )}
        <AddToHomeButton />
      </div>

      {/* ----- Chat scroll area ----- */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2"
        style={{ overscrollBehavior: 'contain' }}
      >
        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            msg={msg}
            bankNames={bankNames}
            categoryNames={categoryNames}
            onEdit={startEdit}
            onCancelEdit={cancelEdit}
            onDismiss={dismissPreview}
            onConfirm={confirmPreview}
            onUpdate={updateDraft}
          />
        ))}
      </div>

      {/* ----- Composer ----- */}
      <div
        className="pt-2 md:pt-3 border-t border-18-border"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.25rem)' }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              // On desktop, Enter sends. On phones, Enter should insert a newline
              // (the send button is right there). Detect touch as a proxy for phone.
              const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
              if (e.key === 'Enter' && !e.shiftKey && !isTouch) {
                e.preventDefault();
                handleSendText();
              }
            }}
            placeholder="Type or 🎙 speak an expense…"
            rows={1}
            className="flex-1 min-w-0 resize-none bg-18-surface border border-18-border rounded-2xl px-3.5 md:px-4 py-2.5 md:py-3 text-[15px] md:text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-18-orange transition-colors max-h-32"
          />
          {inputText.trim().length > 0 ? (
            <button
              type="button"
              onClick={handleSendText}
              className="h-11 w-11 rounded-full bg-18-orange flex items-center justify-center shadow-[0_0_18px_-4px_rgba(243,115,53,0.7)] hover:brightness-110 active:scale-95 transition-all shrink-0"
              aria-label="Send"
            >
              <Send size={18} className="text-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMic}
              disabled={voiceState === 'unsupported'}
              className={`relative h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                voiceState === 'listening'
                  ? 'bg-red-500 shadow-[0_0_18px_-2px_rgba(239,68,68,0.9)]'
                  : 'bg-18-orange shadow-[0_0_18px_-4px_rgba(243,115,53,0.7)] hover:brightness-110 active:scale-95'
              }`}
              aria-label={voiceState === 'listening' ? 'Stop recording' : 'Record voice'}
            >
              {voiceState === 'listening' && (
                <span
                  className="absolute inset-0 rounded-full bg-red-500/60 animate-ping"
                  aria-hidden
                />
              )}
              <Mic size={18} className="text-white relative" />
            </button>
          )}
        </div>
        <p className="mt-1 md:mt-1.5 text-[10px] text-white/40 text-center">
          {voiceState === 'listening'
            ? 'Listening… tap the mic again to stop'
            : /* Different hint text based on desktop vs touch */ ''}
          <span className="hidden md:inline">
            {voiceState !== 'listening' && 'Enter to send · Shift+Enter for a new line'}
          </span>
          <span className="md:hidden">
            {voiceState !== 'listening' && 'Type or tap 🎙 to speak'}
          </span>
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Message row — thin wrapper so we can render each message type cleanly.
// =============================================================================

function MessageRow(props: {
  msg: ChatMessage;
  bankNames: string[];
  categoryNames: string[];
  onEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onDismiss: (id: string) => void;
  onConfirm: (msg: BotPreview) => void;
  onUpdate: (id: string, patch: Partial<Draft>) => void;
}) {
  const { msg } = props;

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-18-orange/15 border border-18-orange/30 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm text-white shadow-sm">
          {msg.kind === 'voice' && (
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-18-orange/90 mb-1">
              <Mic size={10} /> Voice note
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">
            {msg.kind === 'voice' ? msg.transcript : msg.text}
          </p>
          <p className="text-[10px] text-white/40 text-right mt-1">{fmtClock(msg.ts)}</p>
        </div>
      </div>
    );
  }

  // Bot messages
  if (msg.kind === 'text') {
    return (
      <BotBubble ts={msg.ts}>
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
      </BotBubble>
    );
  }

  if (msg.kind === 'error') {
    return (
      <BotBubble ts={msg.ts} tone="error">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-300" />
          <p className="whitespace-pre-wrap break-words text-red-100">{msg.text}</p>
        </div>
      </BotBubble>
    );
  }

  if (msg.kind === 'saved') {
    const { draft } = msg;
    return (
      <BotBubble ts={msg.ts} tone="success">
        <div className="flex items-start gap-2">
          <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-0.5">
            <Check size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-green-100">
              Saved {formatCurrency(draft.amount || 0)}
            </p>
            <p className="text-xs text-green-100/80 mt-0.5">
              {draft.description || draft.category} · {draft.category} / {draft.bank} · {fmtDatePretty(draft.date)}
            </p>
            <Link
              href="/dashboard/expenses"
              className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-green-200 hover:text-white transition-colors"
            >
              View in Expenses <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </BotBubble>
    );
  }

  // Preview card
  const p = msg as BotPreview;
  return (
    <BotBubble ts={msg.ts}>
      {p.editing ? (
        <EditForm
          draft={p.draft}
          bankNames={props.bankNames}
          categoryNames={props.categoryNames}
          onCancel={() => props.onCancelEdit(p.id)}
          onChange={(patch) => props.onUpdate(p.id, patch)}
          onDone={() => props.onCancelEdit(p.id)}
        />
      ) : (
        <PreviewCard
          draft={p.draft}
          missing={p.missing}
          status={p.status}
          onConfirm={() => props.onConfirm(p)}
          onEdit={() => props.onEdit(p.id)}
          onCancel={() => props.onDismiss(p.id)}
        />
      )}
    </BotBubble>
  );
}

function BotBubble({
  children,
  ts,
  tone = 'default',
}: {
  children: React.ReactNode;
  ts: number;
  tone?: 'default' | 'error' | 'success';
}) {
  const toneClass =
    tone === 'error'
      ? 'bg-red-950/40 border-red-800/50'
      : tone === 'success'
      ? 'bg-green-950/40 border-green-800/50'
      : 'bg-18-surface border-18-border';
  return (
    <div className="flex justify-start">
      <div className={`max-w-[85%] ${toneClass} border rounded-2xl rounded-tl-md px-4 py-2.5 text-sm text-white shadow-sm`}>
        {children}
        <p className="text-[10px] text-white/40 mt-1">{fmtClock(ts)}</p>
      </div>
    </div>
  );
}

// ---------- Preview card ----------

function PreviewCard(props: {
  draft: Draft;
  missing: string[];
  status: 'active' | 'confirmed' | 'cancelled';
  onConfirm: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { draft, missing, status } = props;
  const missingSet = new Set(missing);
  const badge = (label: string, value: string | null, key: string) => {
    const isMissing = missingSet.has(key) || !value;
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-white/40 w-16 shrink-0">
          {label}
        </span>
        <span className={`text-sm ${isMissing ? 'text-red-300 italic' : 'text-white font-semibold'}`}>
          {value || '— not caught —'}
        </span>
      </div>
    );
  };

  return (
    <div>
      <p className="text-xs text-white/70 mb-2">
        {status === 'confirmed' ? 'Saving…' : status === 'cancelled' ? 'Cancelled.' : 'Here\'s what I heard:'}
      </p>
      <div className="bg-18-bg/60 border border-18-border rounded-xl p-3 space-y-0.5">
        {badge('Amount',   draft.amount !== null ? formatCurrency(draft.amount) : null, 'amount')}
        {badge('For',      draft.description || null, 'description')}
        {badge('Category', draft.category, 'category')}
        {badge('Bank',     draft.bank, 'bank')}
        {badge('Date',     fmtDatePretty(draft.date), 'date')}
      </div>

      {status === 'active' && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={props.onConfirm}
            disabled={missing.length > 0}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-18-orange text-white rounded-full px-3.5 py-2 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_6px_18px_-6px_rgba(243,115,53,0.6)]"
          >
            <Check size={13} /> Confirm & Save
          </button>
          <button
            type="button"
            onClick={props.onEdit}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-18-surface border border-18-border text-white/80 rounded-full px-3.5 py-2 hover:text-white hover:border-white/30 transition-colors"
          >
            <Edit2 size={13} /> Edit
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-red-300 rounded-full px-2.5 py-2 transition-colors"
          >
            <X size={13} /> Discard
          </button>
        </div>
      )}
      {missing.length > 0 && status === 'active' && (
        <p className="text-[11px] text-yellow-300/80 mt-2">
          Missing: <strong>{missing.join(', ')}</strong> — tap Edit to fill in.
        </p>
      )}
    </div>
  );
}

// ---------- Edit form ----------

function EditForm(props: {
  draft: Draft;
  bankNames: string[];
  categoryNames: string[];
  onCancel: () => void;
  onChange: (patch: Partial<Draft>) => void;
  onDone: () => void;
}) {
  const { draft, bankNames, categoryNames } = props;
  return (
    <div>
      <p className="text-xs text-white/70 mb-2">Edit the details, then hit Done:</p>
      <div className="bg-18-bg/60 border border-18-border rounded-xl p-3 space-y-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Amount (₹)</span>
          <input
            type="text"
            inputMode="decimal"
            className="form-input mt-1"
            placeholder="0.00"
            value={draft.amount === null ? '' : String(draft.amount)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                props.onChange({ amount: null });
                return;
              }
              if (/^\d*\.?\d*$/.test(raw)) {
                const n = parseFloat(raw);
                props.onChange({ amount: isNaN(n) ? null : n });
              }
            }}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Description</span>
          <input
            type="text"
            className="form-input mt-1"
            placeholder="What was it for?"
            value={draft.description}
            onChange={(e) => props.onChange({ description: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Category</span>
          <input
            type="text"
            className="form-input mt-1"
            placeholder="Food, Transport, …"
            list="quickchat-categories"
            value={draft.category || ''}
            onChange={(e) => props.onChange({ category: e.target.value || null })}
          />
          <datalist id="quickchat-categories">
            {categoryNames.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Bank / Card</span>
          <select
            className="form-input mt-1"
            value={draft.bank || ''}
            onChange={(e) => props.onChange({ bank: e.target.value || null })}
          >
            <option value="">— select —</option>
            {bankNames.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Date</span>
          <input
            type="date"
            max={formatDateISO(new Date())}
            className="form-input mt-1"
            value={draft.date}
            onChange={(e) => props.onChange({ date: e.target.value })}
          />
        </label>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={props.onDone}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-18-orange text-white rounded-full px-3.5 py-2 hover:brightness-110 transition-all"
        >
          <Check size={13} /> Done
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
