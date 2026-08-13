// Voice-note recording + upload. Uses MediaRecorder (raw audio, not the
// on-device Web Speech transcript) so Gemini can transcribe + parse in one
// pass. No local regex fallback — audio can't be regex-parsed, so if the
// API fails the caller must surface an error bubble.

import { supabase } from './supabase';
import { ParsedVoice } from './voiceParse';
import { formatDateISO } from './utils';
import { UNEXPECTED_AI_ERROR } from './aiError';

// Pick the best MIME the browser supports. Chrome/Firefox → webm/opus,
// Safari → mp4/aac. `''` lets the browser choose its default.
function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;

  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  async start(): Promise<void> {
    if (!this.isSupported()) throw new Error('MediaRecorder not supported in this browser.');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // If the MediaRecorder ctor OR .start() throws after getUserMedia succeeded,
    // we must stop the mic tracks — otherwise the mic light stays on
    // indefinitely with no way for the user to turn it off from the UI.
    try {
      const mimeType = pickMimeType();
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      this.startedAt = Date.now();
      // Use a modest timeslice so we get periodic chunks — helps if the tab
      // is backgrounded and MediaRecorder is throttled.
      this.recorder.start(1_000);
    } catch (err) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      this.recorder = null;
      throw err;
    }
  }

  /** Stop recording and return the recorded audio blob + duration in ms. */
  async stop(): Promise<{ blob: Blob; durationMs: number }> {
    if (!this.recorder) throw new Error('Not recording.');
    const rec = this.recorder;
    const stream = this.stream;
    const startedAt = this.startedAt;
    return new Promise((resolve, reject) => {
      rec.onstop = () => {
        try {
          const type = rec.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type });
          stream?.getTracks().forEach((t) => t.stop());
          this.recorder = null;
          this.stream = null;
          this.chunks = [];
          resolve({ blob, durationMs: Date.now() - startedAt });
        } catch (err) {
          reject(err);
        }
      };
      try {
        rec.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  cancel(): void {
    try {
      this.recorder?.stop();
    } catch {
      /* ignore */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
  }
}

/**
 * Upload a recorded audio blob to /api/parse-expense/audio and return the
 * parsed expense fields. Throws on any failure — caller shows an error
 * bubble. No regex fallback (audio can't be regex-parsed).
 */
export async function parseAudioExpense(
  audio: Blob,
  banks: string[],
  categories: string[]
): Promise<ParsedVoice & { source: 'gemini-audio' }> {
  // Reject empty / degenerate blobs before eating a network round-trip and
  // an API quota unit. MediaRecorder occasionally hands back zero-byte blobs
  // if the recorder was aborted before any dataavailable event fired.
  if (!audio || audio.size === 0) {
    throw new Error('The recording came back empty. Try again a bit longer.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token;
  // "signed in" is user-actionable — keep the specific message.
  if (!jwt) throw new Error('You need to be signed in.');

  const tzOffsetMin = -new Date().getTimezoneOffset(); // minutes-ahead-of-UTC

  // Match the upload filename's extension to the actual container. Safari
  // MediaRecorder emits audio/mp4; Chrome/Firefox emit audio/webm; Ogg is
  // theoretically possible. Falls back to .webm which is the common case.
  const rawType = audio.type || '';
  const containerExt = rawType.startsWith('audio/mp4')
    ? 'mp4'
    : rawType.startsWith('audio/ogg')
    ? 'ogg'
    : 'webm';

  const form = new FormData();
  form.append('audio', audio, `voice-${Date.now()}.${containerExt}`);
  form.append('banks', JSON.stringify(banks));
  form.append('categories', JSON.stringify(categories));

  let res: Response;
  try {
    res = await fetch('/api/parse-expense/audio', {
      method: 'POST',
      body: form,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-TZ-Offset-Min': String(tzOffsetMin),
      },
    });
  } catch (err) {
    // Network failure — user can't do anything about it themselves.
    console.warn('[aiAudio] network error hitting /api/parse-expense/audio:', err);
    throw new Error(UNEXPECTED_AI_ERROR);
  }

  if (!res.ok) {
    // Log the raw Gemini detail so devs can debug 4xx/5xx from browser
    // devtools; user sees a calm generic message with the support email.
    const errBody = await res.json().catch(() => ({}));
    console.warn(
      `[aiAudio] parse-expense returned ${res.status}:`,
      errBody?.error || '',
      errBody?.detail || ''
    );
    throw new Error(UNEXPECTED_AI_ERROR);
  }

  const body = await res.json();

  // Recompute missing[] locally so the Confirm-Save button stays authoritative.
  const missing: string[] = [];
  if (body.amount === null || typeof body.amount !== 'number' || body.amount <= 0) missing.push('amount');
  if (!body.category) missing.push('category');
  if (!body.bank) missing.push('bank');

  return {
    amount: body.amount,
    description: body.description || '',
    category: body.category,
    bank: body.bank,
    date: body.date || formatDateISO(new Date()),
    transcript: body.transcript || '',
    missing,
    source: 'gemini-audio',
  };
}
