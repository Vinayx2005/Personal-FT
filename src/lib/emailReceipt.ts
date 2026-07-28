// Send a payment-receipt email via Resend. Uses plain fetch so we don't
// pull in a client library. Fails soft — the caller catches errors and
// treats them as non-fatal so a Resend outage never rolls back a payment.

interface ReceiptInput {
  to: string;
  name?: string | null;
  amountInRupees: number;
  paymentId: string;
  orderId: string;
  appUrl: string;
}

const buildHtml = ({ name, amountInRupees, paymentId, orderId, appUrl }: ReceiptInput) => {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0A0A0A;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background:#141414;border:1px solid #2A2A2A;border-radius:16px;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <div style="display:inline-block;background:#F37335;color:#fff;font-weight:900;font-size:14px;padding:8px 12px;border-radius:8px;letter-spacing:1px;">PFT</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;">
                <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.3;">You&rsquo;re in — lifetime access unlocked ✓</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;color:#B0B0B0;font-size:14px;line-height:1.6;">
                <p style="margin:0 0 12px 0;">${greeting}</p>
                <p style="margin:0 0 12px 0;">Thanks for backing Personal FT. Your ₹${amountInRupees.toLocaleString('en-IN')} payment is confirmed and your account now has <strong style="color:#fff;">lifetime access</strong> — no renewals, no upsells.</p>
                <p style="margin:0;">Every category, budget, and report you set up during the trial stays with you. Future updates are included.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0A0A0A;border:1px solid #2A2A2A;border-radius:12px;">
                  <tr><td style="padding:14px 16px 6px 16px;font-size:11px;color:#6E6E6E;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">Receipt</td></tr>
                  <tr>
                    <td style="padding:0 16px 6px 16px;font-size:13px;color:#B0B0B0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr><td style="padding:4px 0;">Amount</td><td align="right" style="padding:4px 0;color:#fff;font-weight:600;">₹${amountInRupees.toLocaleString('en-IN')}</td></tr>
                        <tr><td style="padding:4px 0;">Payment ID</td><td align="right" style="padding:4px 0;color:#fff;font-family:monospace;font-size:12px;">${paymentId}</td></tr>
                        <tr><td style="padding:4px 0 12px 0;">Order ID</td><td align="right" style="padding:4px 0 12px 0;color:#fff;font-family:monospace;font-size:12px;">${orderId}</td></tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 32px 32px;">
                <a href="${appUrl}/dashboard" style="display:inline-block;background:#F37335;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;">Open Personal FT</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #2A2A2A;color:#6E6E6E;font-size:12px;line-height:1.6;">
                <p style="margin:0 0 6px 0;">Keep this email — it&rsquo;s your receipt.</p>
                <p style="margin:0;">Need help? Just reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export async function sendReceiptEmail(input: ReceiptInput): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // Silently skip if not configured — payment still succeeds.
  // Default to Resend's shared sandbox address so the email works before the
  // user has verified their own domain. Set RESEND_FROM_EMAIL to override.
  const from = process.env.RESEND_FROM_EMAIL || 'Personal FT <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: 'Welcome to Personal FT — lifetime access unlocked',
      html: buildHtml(input),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${text}`);
  }
}
