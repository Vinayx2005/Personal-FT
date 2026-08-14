import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata = {
  title: 'Refund Policy · Personal FT',
  description: 'All Personal FT purchases are final. The 7-day free trial is our refund window.',
};

export default function RefundPage() {
  return (
    <LegalPageLayout title="Refund Policy" updatedOn="14 August 2026">
      <p>
        Personal FT is a one-time <strong>₹499 lifetime</strong> purchase
        after a 7-day free trial. This page explains our refund position.
      </p>

      {/* Prominent stance so nobody has to hunt for it */}
      <div className="not-prose mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5">
        <p className="text-base font-semibold text-white leading-relaxed !my-0">
          All purchases are final — we do not offer refunds after payment.
        </p>
        <p className="text-sm text-white/70 mt-2 !my-0">
          That&apos;s why every new account gets a <strong>full 7-day free
          trial</strong> with every feature unlocked, and no card required
          to start. Please make full use of the trial to decide whether the
          app is right for you before you pay.
        </p>
      </div>

      <h2>1. The free trial is your evaluation window</h2>
      <p>
        Every new account gets 7 days of full access to Personal FT without
        paying anything. Log expenses, add banks, try voice notes, set
        budgets, run reports — every feature is on. If you don&apos;t pay
        by day 8, the app switches to a paywall but your data stays on our
        servers indefinitely, so you can always come back.
      </p>
      <p>
        Because the trial is generous and gives you the same product a
        paying user gets, we treat the purchase itself as a final decision.
      </p>

      <h2>2. When we do issue a refund</h2>
      <p>The only situations where we&apos;ll refund you:</p>
      <ul>
        <li>
          <strong>Duplicate charge:</strong> if Razorpay accidentally charges
          you twice for the same account, we&apos;ll refund the duplicate in
          full.
        </li>
        <li>
          <strong>Extended outage on our side:</strong> if the app is
          inaccessible for more than 48 continuous hours because of a
          failure on our infrastructure (not on your network or a
          third-party&apos;s side), we&apos;ll refund your ₹499 in full.
        </li>
        <li>
          <strong>We shut the service down within your first year of
          purchase:</strong> if Personal FT is discontinued within 12
          months of the day you paid, we&apos;ll refund you in full.
        </li>
      </ul>

      <h2>3. How to request a refund in those cases</h2>
      <ol>
        <li>
          Email <a href="mailto:vinayteja23@gmail.com">vinayteja23@gmail.com</a>
          {' '}from the account&apos;s email address
        </li>
        <li>Subject line: <strong>Refund request</strong></li>
        <li>Include your Razorpay payment ID (starts with <code className="bg-18-surface-2 px-1.5 py-0.5 rounded text-xs">pay_</code>) from the payment confirmation email</li>
        <li>Briefly explain which situation applies (duplicate, outage, service shutdown)</li>
      </ol>
      <p>
        We&apos;ll confirm within one business day and, if the request is
        valid, initiate the refund with Razorpay. From there:
      </p>
      <ul>
        <li><strong>UPI / wallet / netbanking:</strong> 3–5 business days back in your account</li>
        <li><strong>Credit / debit card:</strong> 5–7 business days to appear on your statement</li>
      </ul>

      <h2>4. Cases we can&apos;t refund</h2>
      <ul>
        <li>Change of mind after the trial ended and you paid anyway</li>
        <li>&ldquo;I didn&apos;t use it enough&rdquo; after purchase</li>
        <li>Accounts suspended for violating our <a href="/terms">Terms &amp; Conditions</a></li>
        <li>Payments flagged for fraud (stolen card, chargeback in progress, etc.)</li>
      </ul>

      <h2>5. Contact</h2>
      <p>
        Questions about this policy, email{' '}
        <a href="mailto:vinayteja23@gmail.com">vinayteja23@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
