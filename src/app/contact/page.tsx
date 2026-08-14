import LegalPageLayout from '@/components/LegalPageLayout';

export const metadata = {
  title: 'Contact us · Personal FT',
  description: 'How to reach Personal FT support, and what to include when writing.',
};

export default function ContactPage() {
  return (
    <LegalPageLayout title="Contact us" updatedOn="14 August 2026">
      <p>
        Personal FT is built and run by a small team — you&apos;ll hear back
        from a real person, usually within a day.
      </p>

      {/* Primary contact block */}
      <div className="not-prose mt-6 rounded-2xl border border-18-orange/40 bg-18-orange/10 p-5">
        <p className="text-xs uppercase tracking-widest font-bold text-18-orange !my-0">
          Email support
        </p>
        <a
          href="mailto:vinayteja23@gmail.com"
          className="!text-white !no-underline hover:!underline text-2xl md:text-3xl font-black block mt-2"
        >
          vinayteja23@gmail.com
        </a>
        <p className="text-sm text-white/70 mt-3 !my-0">
          Typical response time: <strong>within 24 hours</strong> on weekdays,
          up to <strong>48 hours</strong> on weekends and Indian public holidays.
        </p>
      </div>

      <h2>What to include when you write</h2>
      <p>
        A few extra details make it much faster for us to help you:
      </p>
      <ul>
        <li>The <strong>email address on your Personal FT account</strong> (so we can find your record)</li>
        <li>What you were trying to do, and what happened instead</li>
        <li>A screenshot if there&apos;s a visible error or unexpected screen</li>
        <li>Your device / browser (e.g. &ldquo;iPhone 14, Safari&rdquo; or &ldquo;Windows Chrome&rdquo;)</li>
        <li>If it&apos;s about a payment: the Razorpay payment ID (starts with <code className="bg-18-surface-2 px-1.5 py-0.5 rounded text-xs">pay_</code>) from your payment confirmation email</li>
      </ul>

      <h2>Common things — self-serve first if you like</h2>

      <h3>I want a refund</h3>
      <p>
        See our <a href="/refund">Refund Policy</a>. If you&apos;re within
        7 days of paying, you can email us with subject line &ldquo;Refund
        request&rdquo; and we&apos;ll process it — no questions asked.
      </p>

      <h3>I want to delete my account</h3>
      <p>
        You don&apos;t need to email us for this. Go to{' '}
        <strong>Settings &rarr; Danger zone &rarr; Delete my account</strong>
        {' '}and confirm. Every row we hold about you is wiped in a single
        click. See the <a href="/privacy">Privacy Policy</a> for what
        gets deleted.
      </p>

      <h3>Payment failed / stuck</h3>
      <p>
        First, wait 5 minutes and try again — sometimes the Razorpay callback
        arrives a little late. If it still shows as unpaid after two attempts,
        email us with your Razorpay payment ID and we&apos;ll reconcile it
        manually.
      </p>

      <h3>Voice note not working</h3>
      <p>
        Check that mic permission is granted to the site in your browser
        settings, then reload. If it still fails, tell us your device +
        browser and we&apos;ll dig in — voice recording is finicky across
        iOS Safari vs Chrome vs Firefox.
      </p>

      <h3>Feature request or feedback</h3>
      <p>
        Love hearing these. Subject line{' '}
        <strong>&ldquo;Feature: [short description]&rdquo;</strong>{' '}
        and we&apos;ll read every one, even if we can&apos;t reply to all.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>Phone support — we&apos;re a small team, email keeps things trackable and fair</li>
        <li>Live chat — same reason</li>
        <li>Financial advice — Personal FT is a tracker, not an advisor</li>
      </ul>

      <h2>Business address</h2>
      <p>
        Personal FT operates as an independent product from Hyderabad,
        Telangana, India. If you need a postal address for legal / compliance
        purposes, email us and we&apos;ll share it on request.
      </p>
    </LegalPageLayout>
  );
}
