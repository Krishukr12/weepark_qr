import { escapeHtml } from '../utils/html';

/** Inline CID used when Nodemailer attaches assets/icon-dark.png. */
export const BRAND_LOGO_CID = 'weepark-logo';

const brandHeader = (): string => `
<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td style="vertical-align:middle;padding-right:12px;">
      <img src="cid:${BRAND_LOGO_CID}" alt="weepark" width="36" height="36" style="display:block;border:0;outline:none;width:36px;height:36px;" />
    </td>
    <td style="vertical-align:middle;">
      <div style="font-size:18px;font-weight:800;color:#141b33;letter-spacing:-0.4px;line-height:1.1;">weepark</div>
      <div style="font-size:11px;font-style:italic;color:#a1a1aa;font-family:Georgia,'Times New Roman',serif;line-height:1.2;margin-top:2px;">You Relax</div>
    </td>
  </tr>
</table>`;

const baseLayout = (title: string, body: string): string => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#ffffff;padding:24px 32px;border-bottom:1px solid #e4e4e7;">
            ${brandHeader()}
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#141b33;letter-spacing:-0.3px;">${title}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">© ${new Date().getFullYear()} weepark · You Relax</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const credentialBox = (email: string, password: string): string => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #e4e4e7;border-radius:12px;margin:16px 0;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Email</p>
    <p style="margin:0 0 16px;font-size:15px;color:#141b33;font-weight:600;">${escapeHtml(email)}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Temporary password</p>
    <p style="margin:0;font-size:15px;color:#141b33;font-weight:600;font-family:monospace;">${escapeHtml(password)}</p>
  </td></tr>
</table>`;

const button = (url: string, label: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr><td style="background:#141b33;border-radius:10px;">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;

export function organizationWelcomeTemplate(params: {
  companyName: string;
  adminName: string;
  email: string;
  password: string;
  loginUrl: string;
  clientType?: 'B2B' | 'B2C';
}): string {
  const intro =
    params.clientType === 'B2C'
      ? `Your organization <strong>${escapeHtml(params.companyName)}</strong> has been onboarded to <strong>weepark</strong> as a walk-in (B2C) client. Use the credentials below to sign in and view parking activity at your assigned sites.`
      : `Your organization <strong>${escapeHtml(params.companyName)}</strong> has been onboarded to <strong>weepark</strong>. Use the credentials below to sign in and manage your employees, vehicles and parking activity.`;

  return baseLayout(
    `Welcome aboard, ${escapeHtml(params.companyName)}!`,
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${escapeHtml(params.adminName)},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${intro}</p>
     ${credentialBox(params.email, params.password)}
     ${button(params.loginUrl, 'Sign in to weepark')}
     <p style="font-size:13px;color:#71717a;line-height:1.6;">For security, please change your password after your first login.</p>`,
  );
}

export function valetCredentialsTemplate(params: {
  name: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  return baseLayout(
    'Your valet account is ready',
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${escapeHtml(params.name)},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">A <strong>weepark</strong> valet account has been created for you. Sign in to view your assigned sites and manage pickups.</p>
     ${credentialBox(params.email, params.password)}
     ${button(params.loginUrl, 'Sign in to weepark')}`,
  );
}

export function passwordResetRequestTemplate(params: { name: string; resetUrl: string }): string {
  return baseLayout(
    'Reset your password',
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${escapeHtml(params.name)},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">We received a request to reset your weepark password. Click the button below to choose a new one. This link expires in 30 minutes.</p>
     ${button(params.resetUrl, 'Reset password')}
     <p style="font-size:13px;color:#71717a;line-height:1.6;">If you didn't request this, you can safely ignore this email.</p>`,
  );
}

export function passwordResetSuccessTemplate(params: { name: string; loginUrl: string }): string {
  return baseLayout(
    'Password changed successfully',
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${escapeHtml(params.name)},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">Your weepark password was just changed. If this was you, no further action is needed.</p>
     ${button(params.loginUrl, 'Sign in')}
     <p style="font-size:13px;color:#71717a;line-height:1.6;">If you didn't make this change, contact your administrator immediately.</p>`,
  );
}
