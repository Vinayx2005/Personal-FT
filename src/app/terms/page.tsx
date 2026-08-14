import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata = {
  title: 'Terms & Conditions · Personal FT',
  description:
    'The rules for using Personal FT — what you can expect from us, and what we ask of you.',
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms &amp; Conditions" updatedOn="14 August 2026">
      <p>
        These Terms &amp; Conditions govern your use of Personal FT
        (&ldquo;the app&rdquo;) at{' '}
        <strong>personal-ft-liard.vercel.app</strong>. By creating an account
        or using the app, you agree to these terms. If you don&apos;t agree,
        please don&apos;t use the app.
      </p>

      <h2>1. What Personal FT is</h2>
      <p>
        Personal FT is a personal finance tracker built for young Indian
        professionals. It lets you log expenses and income, categorise them,
        set budgets, track investments and SIPs, and see where your money is
        going. It is <strong>not</strong> a bank, not a broker, and does not
        move money on your behalf. All entries are things you type in
        yourself.
      </p>

      <h2>2. Account eligibility</h2>
      <ul>
        <li>You must be at least 18 years old to use Personal FT</li>
        <li>You must provide a valid email address and use accurate information</li>
        <li>You&apos;re responsible for keeping your password secure — please don&apos;t share it</li>
        <li>One human, one account. Please don&apos;t create multiple accounts to abuse the free trial</li>
      </ul>

      <h2>3. Free trial &amp; payment</h2>
      <p>
        New accounts get a <strong>7-day free trial</strong> with full access
        to every feature. No card is required to start the trial. On day 8, if
        you haven&apos;t paid, the app switches to a paywall that asks you to
        purchase lifetime access.
      </p>
      <p>
        <strong>Lifetime access costs ₹499</strong> (all applicable taxes
        included), paid once via Razorpay. Once paid, you have access to the
        app for as long as we continue to operate it. There are no recurring
        charges and no subscription fees.
      </p>

      <h2>4. Refunds</h2>
      <p>
        All purchases are final. The 7-day free trial is your evaluation
        window &mdash; please use it fully before paying. We only refund in
        specific situations (duplicate charge, extended outage on our side,
        or a full service shutdown within your first year). Full details are
        in our <a href="/refund">Refund Policy</a>.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Attempt to bypass authentication or access other users&apos; data</li>
        <li>Reverse-engineer, scrape, or automate access to the app in ways it wasn&apos;t designed for</li>
        <li>Upload content that&apos;s illegal, infringing, or malicious</li>
        <li>Use the app to launder money, evade taxes, or commit fraud</li>
        <li>Resell access to your account</li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these rules,
        without notice and without refund.
      </p>

      <h2>6. Your data</h2>
      <p>
        You own your financial data. We store it to make the app work for you.
        See our <a href="/privacy">Privacy Policy</a> for the full details. You
        can delete your account at any time from Settings, which removes
        every row we hold about you.
      </p>

      <h2>7. Voice notes and AI</h2>
      <p>
        When you send a voice note through Quick Chat, the audio is processed
        by Google Gemini to transcribe and extract the expense details.
        Google&apos;s terms apply to that processing. We try to keep this
        pipeline reliable but can&apos;t guarantee every voice note will parse
        correctly — you should review the parsed preview before hitting
        Confirm &amp; Save.
      </p>

      <h2>8. Availability &amp; no SLA</h2>
      <p>
        We&apos;ll do our best to keep the app up and running, but we
        don&apos;t promise 100% uptime. Occasional maintenance, provider
        outages (Supabase, Vercel, Razorpay, etc.) or bugs are part of
        running a small independent product. We don&apos;t offer a formal
        service-level agreement.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        Personal FT is a record-keeping tool, not financial advice. We provide
        the app <strong>&ldquo;as is&rdquo;</strong> without warranties of any
        kind. To the maximum extent permitted by law, our liability for any
        claim relating to your use of the app is limited to the amount you
        paid us in the twelve months before the claim (i.e. at most ₹499).
      </p>
      <p>
        We&apos;re not responsible for financial decisions you make based on
        what you see in the app, for any loss of data caused by third-party
        providers, or for indirect / consequential damages.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        If we change these terms materially, we&apos;ll update this page and
        (if you&apos;re a paid customer) email you. The &ldquo;Last
        updated&rdquo; date at the top of this page always reflects the
        current version. Continued use of the app after a change means
        you accept the new terms.
      </p>

      <h2>11. Termination</h2>
      <p>
        You can stop using Personal FT and delete your account any time. We
        may terminate accounts that violate these terms, or shut down the
        service entirely with reasonable notice. If we shut down within your
        first year of lifetime access, we&apos;ll refund your ₹499 in full.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Any disputes are
        subject to the exclusive jurisdiction of the courts in Hyderabad,
        Telangana.
      </p>

      <h2>13. Contact</h2>
      <p>
        For questions about these terms, email{' '}
        <a href="mailto:vinayteja23@gmail.com">vinayteja23@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
