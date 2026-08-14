import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata = {
  title: 'Refund Policy · Personal FT',
  description:
    'How refunds work for Personal FT — 7-day no-questions-asked window.',
};

export default function RefundPage() {
  return (
    <LegalPageLayout title="Refund Policy" updatedOn="14 August 2026">
      <p>
        Personal FT is a one-time <strong>₹499 lifetime</strong> purchase after
        a 7-day free trial. This page explains how refunds work if you change
        your mind.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>You get a <strong>7-day free trial</strong> before we ever ask for money — that&apos;s your first refund window</li>
        <li>After you pay, you have <strong>7 more days</strong> to request a full refund — no questions asked</li>
        <li>Just email <a href="mailto:vinayteja23@gmail.com">vinayteja23@gmail.com</a> from the account&apos;s email address and we&apos;ll refund your ₹499 back to the same payment method within 5–7 business days</li>
      </ul>

      <h2>1. The free trial comes first</h2>
      <p>
        Every new account gets full access to Personal FT for 7 days without
        payment. This is deliberately generous — the goal is that you try the
        app thoroughly and only pay if you know you want to keep using it. If
        you don&apos;t pay by day 8, the app switches to a paywall but your
        data stays on our servers indefinitely.
      </p>

      <h2>2. The 7-day post-purchase refund window</h2>
      <p>
        We understand that some things you can only tell after using the paid
        version. So if you pay for lifetime access and change your mind
        within <strong>7 calendar days from the payment date</strong>, we
        will refund your ₹499 in full, no questions asked.
      </p>
      <p>
        After day 7, the purchase is considered final and we&apos;re not able
        to offer a refund — please make full use of the trial before paying.
      </p>

      <h2>3. How to request a refund</h2>
      <ol>
        <li>
          Email <a href="mailto:vinayteja23@gmail.com">vinayteja23@gmail.com</a>
          {' '}from the same email address that&apos;s on your Personal FT
          account
        </li>
        <li>
          Subject line: <strong>Refund request</strong>
        </li>
        <li>Include your Razorpay payment ID if you have it (found in the payment confirmation email; it starts with <code className="bg-18-surface-2 px-1.5 py-0.5 rounded text-xs">pay_</code>)</li>
        <li>Tell us briefly what didn&apos;t work for you — this helps us fix things, but it&apos;s not required for the refund</li>
      </ol>
      <p>
        We&apos;ll confirm your request within one business day and initiate
        the refund with Razorpay. From that point:
      </p>
      <ul>
        <li><strong>UPI, wallet, netbanking:</strong> money is usually back in your account within 3–5 business days</li>
        <li><strong>Credit / debit card:</strong> allow 5–7 business days for it to appear on your statement</li>
      </ul>

      <h2>4. What happens to your account after a refund</h2>
      <p>
        Once we process your refund, your access to Personal FT is downgraded
        back to trial-expired state. You&apos;ll still be able to sign in and
        export your data as CSV for the next 30 days so you don&apos;t lose
        anything. After that, the account is deleted.
      </p>
      <p>
        You&apos;re welcome to sign up again later if you change your mind —
        but note that the free trial only applies to first-time paying users,
        so a re-signup after a refund goes straight to the paywall.
      </p>

      <h2>5. Exceptions</h2>
      <p>We can&apos;t offer refunds in the following cases:</p>
      <ul>
        <li>More than 7 days have passed since payment</li>
        <li>The account has been suspended or terminated for violating our <a href="/terms">Terms &amp; Conditions</a></li>
        <li>The payment shows signs of fraud (stolen card, chargeback in progress, etc.)</li>
      </ul>

      <h2>6. If something is our fault</h2>
      <p>
        If Personal FT is inaccessible for more than 48 continuous hours due
        to an outage on our side (not on the user&apos;s connection or a
        third-party provider&apos;s side), we&apos;ll refund you in full even
        if the 7-day window has passed. Just email us and mention the outage
        dates you experienced.
      </p>

      <h2>7. Contact</h2>
      <p>
        Any questions about this policy or the refund process, email{' '}
        <a href="mailto:vinayteja23@gmail.com">vinayteja23@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
