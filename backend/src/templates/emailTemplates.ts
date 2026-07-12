const baseLayout = (title: string, body: string): string => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#09090b;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">Wee<span style="color:#34d399;">Park</span></span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#09090b;letter-spacing:-0.3px;">${title}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;">© ${new Date().getFullYear()} WeePark · Smart Parking Management</p>
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
    <p style="margin:0 0 16px;font-size:15px;color:#09090b;font-weight:600;">${email}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#71717a;">Temporary password</p>
    <p style="margin:0;font-size:15px;color:#09090b;font-weight:600;font-family:monospace;">${password}</p>
  </td></tr>
</table>`;

const button = (url: string, label: string): string => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr><td style="background:#09090b;border-radius:10px;">
    <a href="${url}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>
  </td></tr>
</table>`;

export function organizationWelcomeTemplate(params: {
  companyName: string;
  adminName: string;
  email: string;
  password: string;
  loginUrl: string;
}): string {
  return baseLayout(
    `Welcome aboard, ${params.companyName}!`,
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${params.adminName},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">Your organization <strong>${params.companyName}</strong> has been onboarded to WeePark. Use the credentials below to sign in and manage your employees, vehicles and parking activity.</p>
     ${credentialBox(params.email, params.password)}
     ${button(params.loginUrl, 'Sign in to WeePark')}
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
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${params.name},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">A WeePark valet account has been created for you. Sign in to view your assigned sites and manage pickups.</p>
     ${credentialBox(params.email, params.password)}
     ${button(params.loginUrl, 'Sign in to WeePark')}`,
  );
}

export function passwordResetRequestTemplate(params: { name: string; resetUrl: string }): string {
  return baseLayout(
    'Reset your password',
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${params.name},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">We received a request to reset your WeePark password. Click the button below to choose a new one. This link expires in 30 minutes.</p>
     ${button(params.resetUrl, 'Reset password')}
     <p style="font-size:13px;color:#71717a;line-height:1.6;">If you didn't request this, you can safely ignore this email.</p>`,
  );
}

export function passwordResetSuccessTemplate(params: { name: string; loginUrl: string }): string {
  return baseLayout(
    'Password changed successfully',
    `<p style="font-size:14px;color:#3f3f46;line-height:1.6;">Hi ${params.name},</p>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">Your WeePark password was just changed. If this was you, no further action is needed.</p>
     ${button(params.loginUrl, 'Sign in')}
     <p style="font-size:13px;color:#71717a;line-height:1.6;">If you didn't make this change, contact your administrator immediately.</p>`,
  );
}
