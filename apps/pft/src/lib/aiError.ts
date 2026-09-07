// Shared friendly error string for AI-parse failures. Anything the user can't
// act on themselves (Gemini quota, 5xx, network hiccups, key misconfig) gets
// funnelled through this — the raw detail is still console.warn'd so devs can
// debug, but the bubble the user sees stays calm and gives them somewhere to
// turn if it keeps happening.

export const SUPPORT_EMAIL = 'vinayteja23@gmail.com';

export const UNEXPECTED_AI_ERROR =
  `There is some unexpected error. Please contact support at ${SUPPORT_EMAIL}.`;
