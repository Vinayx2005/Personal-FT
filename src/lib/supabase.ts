import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Browser-safe client (anon key only).
//
// Auth options are set EXPLICITLY (instead of relying on library defaults)
// because the PWA install on iOS runs in a separate WebKit storage jar and
// implicit defaults have historically flaked between @supabase/supabase-js
// releases. Pinning them makes cold-start recovery predictable:
//   - persistSession:      write the session to localStorage so PWA cold
//                          starts pick it up
//   - autoRefreshToken:    refresh access tokens in the background before
//                          they expire (default 1h)
//   - detectSessionInUrl:  parse #access_token=... after OAuth callbacks
//   - storageKey:          named, so we can also inspect / clear it from
//                          the DevTools Application panel by name
//   - flowType:            'pkce' — no client secret leaks in the URL,
//                          works properly in installed PWAs
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'pft-auth-session',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
  },
});

// NOTE: supabaseAdmin is created on the server only (see server actions)