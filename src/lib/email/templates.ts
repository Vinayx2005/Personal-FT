// Email templates. Keep them SHORT and FRIENDLY. Each template returns
// a subject line + an HTML body. The HTML uses table-based layout + inline
// styles because Gmail / Outlook / Apple Mail strip most modern CSS.

export type EmailTemplate = 'welcome' | 'reminder_3d' | 'reminder_2d' | 'reminder_1d' | 'payment_done';

interface Common {
  firstName: string | null;
  appUrl: string;
}

interface PaymentDoneVars extends Common {
  amountInRupees: number;
  paymentId: string;
  orderId: string;
}

const shell = (bodyHtml: string, ctaLabel: string, ctaHref: string) => `<!doctype html>
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
            ${bodyHtml}
            <tr>
              <td align="center" style="padding:8px 32px 32px 32px;">
                <a href="${ctaHref}" style="display:inline-block;background:#F37335;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:999px;">${ctaLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #2A2A2A;color:#6E6E6E;font-size:12px;line-height:1.6;">
                <p style="margin:0;">Need help? Just reply to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const greeting = (name: string | null) =>
  name ? `Hey ${name.split(' ')[0]},` : 'Hey there,';

const welcomeBody = ({ firstName }: Common) => `
  <tr>
    <td style="padding:16px 32px 8px 32px;">
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.3;">You're in — your 7-day trial has started</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 24px 32px;color:#B0B0B0;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 12px 0;">${greeting(firstName)}</p>
      <p style="margin:0 0 12px 0;">Welcome to Personal FT. Your 7-day trial is on the house &mdash; explore everything.</p>
      <p style="margin:0 0 12px 0;">Fastest path to your first insight:</p>
      <ol style="margin:0 0 12px 20px;padding:0;color:#B0B0B0;">
        <li style="margin-bottom:4px;">Add a bank in Settings</li>
        <li style="margin-bottom:4px;">Voice-log an expense in Quick Add</li>
        <li style="margin-bottom:4px;">See the leak on your dashboard</li>
      </ol>
      <p style="margin:0;color:#6E6E6E;font-size:12px;">No card charged during the trial.</p>
    </td>
  </tr>`;

const reminderBody = (
  { firstName }: Common,
  daysLeft: 3 | 2 | 1,
  title: string,
  body: string,
) => `
  <tr>
    <td style="padding:16px 32px 8px 32px;">
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.3;">${title}</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 8px 32px;color:#B0B0B0;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 12px 0;">${greeting(firstName)}</p>
      ${body}
    </td>
  </tr>
  <tr>
    <td style="padding:0 32px 16px 32px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0A0A0A;border:1px solid #2A2A2A;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;color:#B0B0B0;font-size:13px;text-align:center;">
            <span style="color:#fff;font-size:24px;font-weight:600;">₹499</span>
            <span style="color:#6E6E6E;text-decoration:line-through;margin-left:10px;font-weight:500;">₹4,999</span>
            <div style="color:#6E6E6E;font-size:11px;margin-top:4px;">One-time · Lifetime access · No renewals</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${daysLeft === 1 ? `<tr><td style="padding:0 32px 8px 32px;color:#F37335;font-size:12px;text-align:center;font-weight:600;">Trial locks tomorrow.</td></tr>` : ''}`;

const paymentDoneBody = ({ firstName, amountInRupees, paymentId, orderId }: PaymentDoneVars) => `
  <tr>
    <td style="padding:16px 32px 8px 32px;">
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.3;">You&rsquo;re in &mdash; lifetime access unlocked ✓</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 24px 32px;color:#B0B0B0;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 12px 0;">${greeting(firstName)}</p>
      <p style="margin:0 0 12px 0;">Payment confirmed. Personal FT is yours forever.</p>
      <p style="margin:0;">Everything you set up during the trial is still there. Future updates included.</p>
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
    <td style="padding:0 32px 8px 32px;color:#6E6E6E;font-size:12px;text-align:center;">Keep this email as your receipt.</td>
  </tr>`;

export function buildWelcome(vars: Common) {
  return {
    subject: `You're in — your 7-day trial has started`,
    html: shell(welcomeBody(vars), 'Open Personal FT', `${vars.appUrl}/dashboard`),
  };
}

export function build3DayReminder(vars: Common) {
  return {
    subject: '3 days left in your Personal FT trial',
    html: shell(
      reminderBody(vars, 3, '3 days left in your trial',
        `<p style="margin:0 0 12px 0;">Quick heads-up &mdash; your trial ends in <strong style="color:#fff;">3 days</strong>. If Personal FT is earning its keep, lock in lifetime access for ₹499 (usually ₹4,999). One-time. No renewals. Ever.</p>`
      ),
      'Get lifetime for ₹499',
      `${vars.appUrl}/dashboard`
    ),
  };
}

export function build2DayReminder(vars: Common) {
  return {
    subject: '2 days left — keep everything you\'ve built',
    html: shell(
      reminderBody(vars, 2, '2 days left in your trial',
        `<p style="margin:0 0 12px 0;">Two days until your trial ends. Every budget, bank, and transaction you\'ve logged stays with you &mdash; you just need to upgrade to keep using them.</p><p style="margin:0;">₹499 once. Lifetime access. That&rsquo;s it.</p>`
      ),
      'Unlock lifetime access',
      `${vars.appUrl}/dashboard`
    ),
  };
}

export function build1DayReminder(vars: Common) {
  return {
    subject: 'Last day of your Personal FT trial',
    html: shell(
      reminderBody(vars, 1, 'Trial ends tomorrow',
        `<p style="margin:0 0 12px 0;">Your trial ends <strong style="color:#fff;">tomorrow</strong>. If you\'re not done exploring, grab lifetime access for ₹499 today (normally ₹4,999 &mdash; 90% launch discount).</p><p style="margin:0;">Skip it and the dashboard locks. Grab it and it&rsquo;s yours forever.</p>`
      ),
      'Pay ₹499 & keep going',
      `${vars.appUrl}/dashboard`
    ),
  };
}

export function buildPaymentDone(vars: PaymentDoneVars) {
  return {
    subject: 'You\'re in — lifetime access unlocked ✓',
    html: shell(paymentDoneBody(vars), 'Open Personal FT', `${vars.appUrl}/dashboard`),
  };
}
