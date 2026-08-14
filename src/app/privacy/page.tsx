import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata = {
  title: 'Privacy Policy · Personal FT',
  description:
    'How Personal FT handles your personal and financial information.',
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updatedOn="14 August 2026">
      <p>
        This Privacy Policy explains what information Personal FT (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;) collects when you use our app at{' '}
        <strong>personal-ft-liard.vercel.app</strong>, why we collect it, and
        what your rights are. We&apos;ve tried to keep it in plain English.
      </p>

      {/* Prominent promise the user asked to see up-front */}
      <div className="not-prose mt-6 rounded-2xl border border-18-orange/40 bg-18-orange/10 p-5">
        <p className="text-base font-semibold text-white leading-relaxed !my-0">
          🔒 Your data is safe with us — and you can delete it whenever you
          want.
        </p>
        <p className="text-sm text-white/70 mt-2 !my-0">
          Every transaction, bank, category and voice note you enter is
          protected by row-level security so only you can see it. You can wipe
          your entire account &mdash; along with every row we hold about you
          &mdash; from{' '}
          <strong>Settings &rarr; Danger zone &rarr; Delete my account</strong>{' '}
          in a single click, no questions asked.
        </p>
      </div>

      <h2>1. What we collect</h2>

      <h3>Account information</h3>
      <p>When you sign up we store:</p>
      <ul>
        <li>Your email address (from email/password signup or Google OAuth)</li>
        <li>Your display name (if provided by Google, or the part before @ in your email)</li>
        <li>A hashed version of your password (email/password only — we never see the plaintext)</li>
      </ul>

      <h3>Financial data you enter</h3>
      <p>
        The app is a personal finance tracker, so you willingly give us the data
        you want to track: bank/card names, opening balances, expense and income
        transactions, categories, budgets, investments, and SIPs. We do not
        access your actual bank accounts and we never see your card numbers,
        CVVs, or bank credentials — you type in the amounts yourself.
      </p>

      <h3>Voice notes (Quick Add)</h3>
      <p>
        When you send a voice note in Quick Chat, the audio is uploaded to
        Google Gemini for transcription and parsing. Google may retain and
        use this audio to improve their models when we&apos;re on their free
        tier. We do not store your voice notes on our own servers.
      </p>

      <h3>Payment information</h3>
      <p>
        Payments for lifetime access are processed by <strong>Razorpay</strong>.
        We do not see or store your card, UPI, or bank details — Razorpay
        handles the entire payment flow. What we store is the payment id
        Razorpay returns after a successful charge, along with the amount and
        date, so we can confirm your lifetime access.
      </p>

      <h3>Cookies &amp; local storage</h3>
      <p>
        We use browser storage to keep you signed in (session token in
        localStorage) and to remember your Quick Chat conversation history
        for convenience. We do not use analytics cookies, ad-tracking cookies,
        or third-party tracking pixels.
      </p>

      <h2>2. Who processes it</h2>
      <p>Personal FT is built on top of a small set of trusted providers:</p>
      <ul>
        <li><strong>Supabase</strong> — hosts our database and handles authentication</li>
        <li><strong>Vercel</strong> — hosts the app and runs our serverless functions</li>
        <li><strong>Razorpay</strong> — processes lifetime-access payments</li>
        <li><strong>Google Gemini</strong> — transcribes voice notes and parses natural-language expense entries</li>
        <li><strong>Resend</strong> — sends transactional emails (welcome, trial reminders, payment confirmation)</li>
        <li><strong>Google OAuth</strong> — used when you sign in with Google</li>
      </ul>
      <p>
        Each of these providers has their own privacy policy. Your data is
        subject to their terms when it&apos;s handled by them.
      </p>

      <h2>3. How we use your data</h2>
      <ul>
        <li>To let you sign in and use the app</li>
        <li>To show you your own transactions, balances, and reports</li>
        <li>To send you transactional emails you asked for (trial reminders, payment confirmations)</li>
        <li>To debug problems if you report an issue</li>
      </ul>
      <p>
        We do not sell your data. We do not use it for advertising. We do not
        share your data with third parties for their own purposes.
      </p>

      <h2>4. How long we keep it</h2>
      <p>
        For as long as your account exists. When you delete your account
        (Settings → Danger zone → Delete my account), your rows are removed
        from our database and cascade-deleted from every related table
        (transactions, banks, categories, budgets, subscriptions, everything).
      </p>

      <h2>5. Your rights</h2>
      <ul>
        <li><strong>Access</strong> — you can see everything the app knows about your finances from the dashboard itself</li>
        <li><strong>Export</strong> — you can download your expenses and income as CSV from those pages</li>
        <li><strong>Correction</strong> — every row is editable from the app</li>
        <li><strong>Deletion</strong> — delete your account from Settings, or email us and we&apos;ll do it for you</li>
      </ul>

      <h2>6. Security</h2>
      <p>
        Traffic to the app is served over HTTPS. Passwords are hashed with
        bcrypt on Supabase&apos;s auth server. Database access is protected
        by row-level security so a signed-in user can only ever see or modify
        their own rows. We do not have direct access to your password.
      </p>

      <h2>7. Children</h2>
      <p>
        Personal FT is not intended for use by anyone under 18. Please do not
        sign up if you&apos;re under 18. If we learn that we have data from
        a minor, we&apos;ll delete it.
      </p>

      <h2>8. Changes to this policy</h2>
      <p>
        If we materially change how we handle your data, we&apos;ll update
        this page and (if you&apos;re a paid customer) send you an email.
        The &ldquo;Last updated&rdquo; date at the top of this page always
        reflects the current version.
      </p>

      <h2>9. Contact</h2>
      <p>
        If you have questions or concerns about how we handle your data,
        email <a href="mailto:vinayteja23@gmail.com">vinayteja23@gmail.com</a>
        {' '}and we&apos;ll get back to you.
      </p>
    </LegalPageLayout>
  );
}
