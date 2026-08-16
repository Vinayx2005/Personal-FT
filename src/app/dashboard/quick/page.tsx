'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDateISO } from '@/lib/utils';
import { logAction } from '@/lib/auditLog';
import { fetchCurrentStreak } from '@/lib/streak';
import { parseExpense } from '@/lib/aiParse';
import { VoiceRecorder, parseAudioExpense } from '@/lib/aiAudio';
import { UNEXPECTED_AI_ERROR } from '@/lib/aiError';
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
  ChevronDown,
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
// Voice notes carry the recorded audio's blob URL (transient — lives only
// for the current tab) + duration. On history restore we won't have the URL
// so playback disables; the bubble still renders as a "voice note" chip.
type UserVoice = {
  id: string;
  role: 'user';
  kind: 'voice';
  audioUrl?: string;
  durationMs: number;
  ts: number;
};

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
// Bumped to 2 when voice notes moved from text-transcript to audio-blob
// storage — old v1 payloads with a `transcript` string on voice messages
// no longer render correctly, so we discard them on the schema bump.
const CHAT_STORAGE_VERSION = 2;
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
      // Voice bubbles saved from a previous session no longer have a valid
      // blob URL (the browser garbage-collects them on unload). Strip it so
      // the render shows a "playback expired" state instead of a dead audio
      // element that just spins.
      if (m?.role === 'user' && m?.kind === 'voice' && m?.audioUrl) {
        const { audioUrl, ...rest } = m;
        return rest;
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

function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
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

  // 'listening' = currently recording; 'processing' = uploading + waiting on
  // Gemini; 'unsupported' = MediaRecorder / getUserMedia not available.
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing' | 'unsupported'>('idle');
  const recorderRef = useRef<VoiceRecorder | null>(null);

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

  // Clean up on unmount:
  //  1. Revoke every voice-note blob URL still in the message list —
  //     URL.createObjectURL holds the blob in memory until the URL is
  //     revoked, so a long session logging voice notes would keep growing.
  //  2. Cancel any in-flight recording so the mic doesn't stay hot when
  //     the user navigates away mid-record.
  // Note: this is a mount-only effect (empty deps). It closes over the
  // component's messages/recorder refs via the DOM at teardown time — the
  // messages array is read live via the closure below.
  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.cancel();
      } catch { /* ignore */ }
      // Best-effort revoke — walking the current messages state via a fresh
      // read is fiddly in a cleanup, so instead we track voice URLs in a ref
      // and revoke there. Keep this simple by just letting the effect below
      // do it. (See voiceUrlsRef effect.)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track every blob URL we mint so we can revoke on unmount + when the
  // history is trimmed off the top of the message list.
  const voiceUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // Register any newly-arrived voice URLs.
    const alive = new Set<string>();
    for (const m of messages) {
      if (m.role === 'user' && m.kind === 'voice' && m.audioUrl) {
        alive.add(m.audioUrl);
        voiceUrlsRef.current.add(m.audioUrl);
      }
    }
    // Anything in the ref that's not in the current message list has fallen
    // off (trimmed by CHAT_MAX_MESSAGES) — revoke it now.
    for (const url of Array.from(voiceUrlsRef.current)) {
      if (!alive.has(url)) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        voiceUrlsRef.current.delete(url);
      }
    }
  }, [messages]);
  useEffect(() => {
    // Final revoke sweep on unmount. Separated from the mount-only effect
    // above so this one can access voiceUrlsRef in its own closure.
    return () => {
      for (const url of voiceUrlsRef.current) {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      voiceUrlsRef.current.clear();
    };
  }, []);

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

  const parseAndPreview = async (text: string) => {
    // Show a "thinking" bot text bubble while Gemini works — it usually
    // returns in <2s but a slow phone network can stretch it out.
    const thinkingId = rid();
    push({ id: thinkingId, role: 'bot', kind: 'text', text: 'Thinking…', ts: now() });

    const parsed = await parseExpense(text, bankNames, categoryNames);
    // Swap the "Thinking…" bubble out for the preview card.
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== thinkingId);
      const draft: Draft = {
        amount: parsed.amount,
        description: parsed.description || '',
        category: parsed.category,
        bank: parsed.bank,
        date: parsed.date,
      };
      next.push({
        id: rid(),
        role: 'bot',
        kind: 'preview',
        draft,
        missing: parsed.missing,
        status: 'active',
        editing: false,
        ts: now(),
      });
      return next;
    });
  };

  // ---------- Voice ----------

  const handleMic = async () => {
    // Tap while recording → stop, upload, hand off to Gemini for audio
    // transcription + expense extraction in one call.
    if (voiceState === 'listening' && recorderRef.current) {
      // Take ownership of the recorder ref + flip state to 'processing'
      // BEFORE awaiting stop, so a second rapid tap during the async stop
      // sees state !== 'listening' + ref === null and short-circuits.
      // Otherwise both taps would race for the same stop(), overwriting the
      // MediaRecorder's onstop handler and hanging the first promise forever.
      const rec = recorderRef.current;
      recorderRef.current = null;
      setVoiceState('processing');

      let stopped: { blob: Blob; durationMs: number };
      try {
        stopped = await rec.stop();
      } catch (err: any) {
        setVoiceState('idle');
        pushBotError(`Recording error: ${err?.message || 'unknown'}`);
        return;
      }
      if (stopped.durationMs < 400) {
        // Tap-to-cancel: too short to be a real voice note.
        setVoiceState('idle');
        return;
      }

      const audioUrl = URL.createObjectURL(stopped.blob);
      push({
        id: rid(),
        role: 'user',
        kind: 'voice',
        audioUrl,
        durationMs: stopped.durationMs,
        ts: now(),
      });

      const thinkingId = rid();
      push({ id: thinkingId, role: 'bot', kind: 'text', text: 'Listening & parsing…', ts: now() });
      // voiceState was already flipped to 'processing' at the top of this
      // branch (before await stop) — no re-set needed here.

      try {
        const parsed = await parseAudioExpense(stopped.blob, bankNames, categoryNames);
        setMessages((prev) => {
          const next = prev.filter((m) => m.id !== thinkingId);
          const draft: Draft = {
            amount: parsed.amount,
            description: parsed.description || '',
            category: parsed.category,
            bank: parsed.bank,
            date: parsed.date,
          };
          next.push({
            id: rid(),
            role: 'bot',
            kind: 'preview',
            draft,
            missing: parsed.missing,
            status: 'active',
            editing: false,
            ts: now(),
          });
          return next;
        });
      } catch (err: any) {
        setMessages((prev) => prev.filter((m) => m.id !== thinkingId));
        // parseAudioExpense already funnels API failures through the shared
        // UNEXPECTED_AI_ERROR string; the || fallback catches any other
        // throw path so the user never sees a stack trace.
        pushBotError(err?.message || UNEXPECTED_AI_ERROR);
      } finally {
        setVoiceState('idle');
      }
      return;
    }

    // Tap when idle → start recording.
    const rec = new VoiceRecorder();
    if (!rec.isSupported()) {
      setVoiceState('unsupported');
      pushBotError("Voice notes aren't supported in this browser. Try Chrome, Edge, or Safari 14.5+.");
      return;
    }
    try {
      await rec.start();
      recorderRef.current = rec;
      setVoiceState('listening');
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Mic permission blocked. Allow microphone access for this site and try again.'
        : `Couldn't start recording: ${err?.message || err}`;
      pushBotError(msg);
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

    // Atomic check-and-mark: if a second click arrives before React re-renders
    // and hides the buttons, we'd otherwise insert the same transaction twice.
    // Using setMessages' callback form lets us read the LATEST state (not the
    // stale one captured in `msg`) and abort if the preview is already being
    // processed.
    let alreadySubmitting = false;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msg.id || m.role !== 'bot' || m.kind !== 'preview') return m;
        if (m.status !== 'active') {
          alreadySubmitting = true;
          return m;
        }
        return { ...m, status: 'confirmed', editing: false };
      })
    );
    if (alreadySubmitting) return;

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
      // Exact match wins over substring match — otherwise picking "SBI" from
      // the chip selector fails as "ambiguous" when the user also has
      // "SBI Credit Card". The user's intent is the literal chip they tapped.
      const banksList = banks || [];
      const exact = banksList.find((b) => b.bank_name.toLowerCase() === kw);
      const matches = exact
        ? [exact]
        : banksList.filter((b) => b.bank_name.toLowerCase().includes(kw));
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
    //
    // The dashboard <main> reserves pb-24 (96 px) as a floor of clearance
    // for the fixed BottomNav — a sensible default for scrollable pages so
    // their last row doesn't hide under the nav. But this page owns its
    // own scroll: the composer is pinned to the bottom of the container
    // and should sit *right above* the nav, with no dead gap.
    //
    // BottomNav is min-h-[56 px] PLUS an outer paddingBottom of
    // env(safe-area-inset-bottom) — on iOS notched devices that adds
    // ~34 px, so the true nav height is ~90 px, not 56 px. Failing to
    // subtract the safe-area inset would push the composer behind the
    // home-indicator strip on iPhone.
    //
    // The fix: reclaim main's pb-24 reservation with -mb-24 on mobile,
    // then size the container to 100dvh − pt-4 (16) − nav content (56)
    // − safe-area-inset-bottom. Desktop still just subtracts the 48 px
    // of main padding.
    <div className="flex flex-col h-[calc(100dvh-72px-env(safe-area-inset-bottom))] -mb-24 md:h-[calc(100dvh-48px)] md:mb-0">
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
          {inputText.trim().length > 0 && voiceState !== 'listening' && voiceState !== 'processing' ? (
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
              disabled={voiceState === 'unsupported' || voiceState === 'processing'}
              className={`relative h-11 w-11 rounded-full flex items-center justify-center shrink-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                voiceState === 'listening'
                  ? 'bg-red-500 shadow-[0_0_18px_-2px_rgba(239,68,68,0.9)]'
                  : 'bg-18-orange shadow-[0_0_18px_-4px_rgba(243,115,53,0.7)] hover:brightness-110 active:scale-95'
              }`}
              aria-label={
                voiceState === 'listening'
                  ? 'Stop recording'
                  : voiceState === 'processing'
                  ? 'Processing voice note'
                  : 'Record voice note'
              }
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
          {voiceState === 'listening' ? (
            'Recording… tap the mic again to send'
          ) : voiceState === 'processing' ? (
            'Transcribing & parsing your voice note…'
          ) : (
            <>
              <span className="hidden md:inline">Enter to send · Shift+Enter for a new line · 🎙 for a voice note</span>
              <span className="md:hidden">Type, or tap 🎙 to send a voice note</span>
            </>
          )}
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
    if (msg.kind === 'voice') {
      // Voice bubble: audio player only, no transcript text. If the audio
      // URL is missing (restored from persisted history — blob URLs die on
      // reload), show a disabled placeholder.
      return (
        <div className="flex justify-end">
          <div className="max-w-[80%] bg-18-orange/15 border border-18-orange/30 rounded-2xl rounded-tr-md px-3 py-2 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <Mic size={12} className="text-18-orange shrink-0" />
              {msg.audioUrl ? (
                <audio
                  controls
                  preload="metadata"
                  src={msg.audioUrl}
                  className="max-w-[220px] h-8"
                />
              ) : (
                <span className="text-xs text-white/60 italic">
                  Voice note ({fmtDuration(msg.durationMs)}) · playback expired
                </span>
              )}
            </div>
            <p className="text-[10px] text-white/40 text-right mt-1">{fmtClock(msg.ts)}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-18-orange/15 border border-18-orange/30 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm text-white shadow-sm">
          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
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
  // Track the raw text separately from the parsed number so typing "1." or
  // "1.50" doesn't get canonicalised back to "1" or "1.5" by parseFloat
  // round-tripping through draft.amount.
  const [amountRaw, setAmountRaw] = useState<string>(
    draft.amount === null ? '' : String(draft.amount)
  );
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
            value={amountRaw}
            onChange={(e) => {
              const raw = e.target.value;
              // Allow empty OR a valid partial decimal ("", "1", "1.", "1.5").
              if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
              setAmountRaw(raw);
              if (raw === '') {
                props.onChange({ amount: null });
              } else {
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
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Category</span>
          <Dropdown
            label="Category"
            options={categoryNames}
            value={draft.category}
            onChange={(v) => props.onChange({ category: v })}
            placeholder="Pick a category…"
            allowCustom
            customLabel="+ New category…"
            customPlaceholder="Type a new category name"
          />
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">Bank / Card</span>
          <ChipSelect
            options={bankNames}
            value={draft.bank}
            onChange={(v) => props.onChange({ bank: v })}
            emptyText="No banks set up yet — add one in Settings."
          />
        </div>
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

// ---------- Chip-based select ----------
// Big-tap-target chips replace <select>/datalist for Category and Bank so the
// edit form stays fast on mobile without a native picker (which is
// inconsistent across iOS/Android and impossible to style).

function ChipSelect(props: {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  allowCustom?: boolean;
  customLabel?: string;
  customPlaceholder?: string;
  emptyText?: string;
}) {
  const { options, value, onChange, allowCustom, customLabel, customPlaceholder, emptyText } = props;

  // `value` is "custom" when it's set but doesn't match any option.
  const matchedOption = value
    ? options.find((o) => o.toLowerCase() === value.toLowerCase()) || null
    : null;
  const valueIsCustom = !!value && !matchedOption;

  // Explicit toggle so the user can enter custom mode even with no value yet
  // (or after picking a chip they can go back to custom without clearing first).
  const [customOpen, setCustomOpen] = useState(false);
  const showCustom = allowCustom && (customOpen || valueIsCustom);

  return (
    <div className="mt-1.5">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const selected = matchedOption?.toLowerCase() === opt.toLowerCase();
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setCustomOpen(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                  selected
                    ? 'bg-18-orange text-white shadow-[0_6px_16px_-8px_rgba(243,115,53,0.7)]'
                    : 'bg-18-bg border border-18-border text-white/75 hover:text-white hover:border-white/30'
                }`}
              >
                {opt}
              </button>
            );
          })}
          {allowCustom && !showCustom && (
            <button
              type="button"
              onClick={() => setCustomOpen(true)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-18-orange/50 text-18-orange hover:bg-18-orange/10 active:scale-95 transition-all"
            >
              {customLabel || '+ New'}
            </button>
          )}
        </div>
      )}

      {showCustom && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            className="form-input flex-1"
            placeholder={customPlaceholder || 'Type new value…'}
            value={valueIsCustom ? (value || '') : ''}
            autoFocus
            onChange={(e) => onChange(e.target.value || null)}
          />
          <button
            type="button"
            onClick={() => {
              setCustomOpen(false);
              if (valueIsCustom) onChange(null);
            }}
            className="p-2 text-white/50 hover:text-white transition-colors"
            aria-label="Cancel custom entry"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {options.length === 0 && !showCustom && (
        <p className="text-xs text-white/40 italic mt-1">{emptyText || 'No options available.'}</p>
      )}
    </div>
  );
}

// ---------- Bottom-sheet dropdown ----------
// The native <select> picker on mobile is inconsistent and can't match the
// dark theme. This is a styled trigger that opens a bottom sheet on phones
// (centered modal on desktop) with big tap-target rows, a checkmark on the
// selected option, and an optional "+ New" row at the bottom that reveals
// an inline text input for a custom value.

function Dropdown(props: {
  label?: string;
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  allowCustom?: boolean;
  customLabel?: string;
  customPlaceholder?: string;
  emptyText?: string;
}) {
  const { label, options, value, onChange, placeholder, allowCustom, customLabel, customPlaceholder, emptyText } = props;

  const matchedOption = value
    ? options.find((o) => o.toLowerCase() === value.toLowerCase()) || null
    : null;
  const valueIsCustom = !!value && !matchedOption;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const showCustom = allowCustom && (customOpen || valueIsCustom);

  const displayValue = matchedOption || (valueIsCustom ? value : null);
  const isPlaceholder = !displayValue && !showCustom;

  // Close sheet on Escape and lock body scroll while open.
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [sheetOpen]);

  return (
    <div className="mt-1.5 space-y-2">
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full flex items-center justify-between gap-2 bg-18-bg border border-18-border rounded-lg px-3 py-2.5 text-sm text-left focus:outline-none focus:border-18-orange hover:border-white/25 transition-colors cursor-pointer"
      >
        <span className={isPlaceholder ? 'text-white/40' : 'text-white truncate'}>
          {displayValue || placeholder || '— select —'}
        </span>
        <ChevronDown size={16} className="text-white/60 shrink-0" aria-hidden />
      </button>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center animate-[fade-in_0.15s_ease-out]"
          style={{ animation: 'fade-in 0.15s ease-out' }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />

          {/* Sheet — slides up from bottom on phones, centered card on desktop */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label ? `Select ${label}` : 'Select an option'}
            className="relative w-full md:max-w-sm bg-18-surface border-t md:border border-18-border rounded-t-2xl md:rounded-2xl max-h-[75vh] md:max-h-[70vh] overflow-hidden flex flex-col shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.9)] md:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
          >
            {/* Grabber (mobile only — visual affordance for the sheet metaphor) */}
            <div className="md:hidden pt-2.5 pb-1 flex justify-center">
              <span className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-2 md:pt-4 pb-3 border-b border-18-border/60">
              <h3 className="text-sm font-bold text-white">
                {label ? `Choose ${label.toLowerCase()}` : 'Choose an option'}
              </h3>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="p-1 -mr-1 text-white/60 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Options */}
            <div className="overflow-y-auto flex-1">
              {options.length === 0 ? (
                <p className="p-4 text-sm text-white/40 italic">
                  {emptyText || 'No options available.'}
                </p>
              ) : (
                <ul>
                  {options.map((o) => {
                    const selected =
                      matchedOption?.toLowerCase() === o.toLowerCase();
                    return (
                      <li key={o}>
                        <button
                          type="button"
                          onClick={() => {
                            onChange(o);
                            setCustomOpen(false);
                            setSheetOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 text-[15px] text-left transition-colors active:bg-white/10 ${
                            selected
                              ? 'text-white bg-18-orange/10'
                              : 'text-white/85 hover:bg-white/5'
                          }`}
                        >
                          <span className="truncate">{o}</span>
                          {selected && (
                            <Check
                              size={18}
                              className="text-18-orange shrink-0"
                              aria-label="selected"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {allowCustom && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomOpen(true);
                    setSheetOpen(false);
                    if (!valueIsCustom) onChange(null);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3.5 text-[15px] text-left text-18-orange font-semibold border-t border-18-border/60 hover:bg-18-orange/5 active:bg-18-orange/10 transition-colors"
                >
                  {customLabel || '+ New'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCustom && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="form-input flex-1"
            placeholder={customPlaceholder || 'Type new value…'}
            value={valueIsCustom ? (value || '') : ''}
            autoFocus
            onChange={(e) => onChange(e.target.value || null)}
          />
          <button
            type="button"
            onClick={() => {
              setCustomOpen(false);
              if (valueIsCustom) onChange(null);
            }}
            className="p-2 text-white/50 hover:text-white transition-colors"
            aria-label="Cancel custom entry"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {options.length === 0 && !showCustom && emptyText && (
        <p className="text-xs text-white/40 italic mt-1">{emptyText}</p>
      )}
    </div>
  );
}
