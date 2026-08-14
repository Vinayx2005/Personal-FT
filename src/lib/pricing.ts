// ─────────────────────────────────────────────────────────────────────────
// ⚠️  TEST MODE  ⚠️
// Lifetime access is temporarily priced at ₹1 for live-payment testing.
// REVERT to 499 before opening the app to real customers.
// ─────────────────────────────────────────────────────────────────────────
//
// This is the single source of truth for the Razorpay charge amount.
// Both /api/razorpay/create-order (what the customer is charged) and
// /api/razorpay/verify (what gets recorded in subscriptions.amount) read
// from here, so they can't drift.
//
// The webhook route (/api/razorpay/webhook) does NOT read from here —
// it uses the actual paid amount off the payment.captured event, which
// is always correct regardless of what we charged.

export const LIFETIME_PRICE_INR = 1;
export const LIFETIME_PRICE_PAISE = LIFETIME_PRICE_INR * 100;
