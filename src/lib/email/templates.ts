// Email templates. Keep them SHORT and FRIENDLY. Each template returns
// a subject line + an HTML body. The HTML uses table-based layout + inline
// styles because Gmail / Outlook / Apple Mail strip most modern CSS.

export type EmailTemplate = 'welcome';

interface Common {
  firstName: string | null;
  appUrl: string;
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
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;line-height:1.3;">Welcome to Personal FT</h1>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 24px 32px;color:#B0B0B0;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 12px 0;">${greeting(firstName)}</p>
      <p style="margin:0 0 12px 0;">Everything is free. No trial, no paywall &mdash; just track your money.</p>
      <p style="margin:0 0 12px 0;">Fastest path to your first insight:</p>
      <ol style="margin:0 0 12px 20px;padding:0;color:#B0B0B0;">
        <li style="margin-bottom:4px;">Add a bank in Settings</li>
        <li style="margin-bottom:4px;">Voice-log an expense in Quick Add</li>
        <li style="margin-bottom:4px;">See the leak on your dashboard</li>
      </ol>
    </td>
  </tr>`;

export function buildWelcome(vars: Common) {
  return {
    subject: `Welcome to Personal FT`,
    html: shell(welcomeBody(vars), 'Open Personal FT', `${vars.appUrl}/dashboard`),
  };
}
