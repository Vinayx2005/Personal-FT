// Single source of truth for the Razorpay charge amount.
// Both /api/razorpay/create-order (what the customer is charged) and
// /api/razorpay/verify (what gets recorded in subscriptions.amount) read
// from here, so they can't drift.
//
// The webhook route (/api/razorpay/webhook) does NOT read from here —
// it uses the actual paid amount off the payment.captured event, which
// is always correct regardless of what we charged.
//
// To temporarily drop the price for a live-payment smoke test, change
// LIFETIME_PRICE_INR to 1 and redeploy. Revert to 499 when done.

export const LIFETIME_PRICE_INR = 499;
export const LIFETIME_PRICE_PAISE = LIFETIME_PRICE_INR * 100;
