// Unified Resend sender. Called by both /api/email/welcome, the cron
// reminders, and the payment-verify route. Fails soft — if Resend isn't
// configured yet, log and return so the app keeps working during setup.

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email/send] RESEND_API_KEY not set — skipping send');
    return { ok: false, error: 'RESEND_API_KEY not set' };
  }
  const from =
    process.env.RESEND_FROM_EMAIL || 'Personal FT <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${text}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Unknown send error' };
  }
}
