import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import {
  organizationWelcomeTemplate,
  passwordResetRequestTemplate,
  passwordResetSuccessTemplate,
  valetCredentialsTemplate,
} from '../templates/emailTemplates';

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

async function sendMail(options: MailOptions): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    // No SMTP configured (typical in local dev) — log the full email so generated
    // credentials and reset links remain accessible during development.
    const text = options.html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    console.info(`📧 [email:dev] To: ${options.to} | Subject: ${options.subject}\n   Body: ${text}`);
    return;
  }
  try {
    await transport.sendMail({ from: env.EMAIL_FROM, ...options });
  } catch (error) {
    console.error(`Failed to send email to ${options.to}:`, error);
  }
}

export const emailService = {
  async sendOrganizationWelcome(params: {
    to: string;
    companyName: string;
    adminName: string;
    email: string;
    password: string;
  }): Promise<void> {
    await sendMail({
      to: params.to,
      subject: `Welcome to WeePark — ${params.companyName}`,
      html: organizationWelcomeTemplate({ ...params, loginUrl: `${env.CLIENT_URL}/login` }),
    });
  },

  async sendValetCredentials(params: { to: string; name: string; email: string; password: string }): Promise<void> {
    await sendMail({
      to: params.to,
      subject: 'Your WeePark Valet Account',
      html: valetCredentialsTemplate({ ...params, loginUrl: `${env.CLIENT_URL}/login` }),
    });
  },

  async sendPasswordResetRequest(params: { to: string; name: string; token: string }): Promise<void> {
    await sendMail({
      to: params.to,
      subject: 'Reset your WeePark password',
      html: passwordResetRequestTemplate({
        name: params.name,
        resetUrl: `${env.CLIENT_URL}/reset-password?token=${params.token}`,
      }),
    });
  },

  async sendPasswordResetSuccess(params: { to: string; name: string }): Promise<void> {
    await sendMail({
      to: params.to,
      subject: 'Your WeePark password was changed',
      html: passwordResetSuccessTemplate({ name: params.name, loginUrl: `${env.CLIENT_URL}/login` }),
    });
  },
};
