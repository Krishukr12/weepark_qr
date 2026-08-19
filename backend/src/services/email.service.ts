import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProduction } from '../config/env';
import { ApiError } from '../utils/apiError';
import {
  BRAND_LOGO_CID,
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
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }
  return transporter;
}

function brandLogoAttachment() {
  return {
    filename: 'icon-dark.png',
    path: path.join(__dirname, '../../assets/icon-dark.png'),
    cid: BRAND_LOGO_CID,
  };
}

async function sendMail(options: MailOptions, { allowDevSkip } = { allowDevSkip: false }): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    if (isProduction) {
      throw ApiError.internal('Email delivery is not configured');
    }
    console.info(`Email skipped (SMTP unset): to=${options.to} subject=${options.subject}`);
    if (!allowDevSkip) {
      // Dev still "succeeds" so local onboarding works; credentials are never logged.
    }
    return;
  }
  try {
    await transport.sendMail({
      from: env.EMAIL_FROM,
      ...options,
      attachments: [brandLogoAttachment()],
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    console.error(`Failed to send email to ${options.to}: ${reason}`);
    throw ApiError.internal('Failed to send email');
  }
}

export const emailService = {
  async sendOrganizationWelcome(params: {
    to: string;
    companyName: string;
    adminName: string;
    email: string;
    password: string;
    clientType?: 'B2B' | 'B2C';
  }): Promise<void> {
    await sendMail({
      to: params.to,
      subject: `Welcome to weepark — ${params.companyName}`,
      html: organizationWelcomeTemplate({ ...params, loginUrl: `${env.CLIENT_URL}/login` }),
    });
  },

  async sendValetCredentials(params: { to: string; name: string; email: string; password: string }): Promise<void> {
    await sendMail({
      to: params.to,
      subject: 'Your weepark valet account',
      html: valetCredentialsTemplate({ ...params, loginUrl: `${env.CLIENT_URL}/login` }),
    });
  },

  async sendPasswordResetRequest(params: { to: string; name: string; token: string }): Promise<void> {
    try {
      await sendMail(
        {
          to: params.to,
          subject: 'Reset your weepark password',
          html: passwordResetRequestTemplate({
            name: params.name,
            resetUrl: `${env.CLIENT_URL}/reset-password?token=${params.token}`,
          }),
        },
        { allowDevSkip: true },
      );
    } catch {
      console.error('Password reset email failed');
    }
  },

  async sendPasswordResetSuccess(params: { to: string; name: string }): Promise<void> {
    try {
      await sendMail({
        to: params.to,
        subject: 'Your weepark password was changed',
        html: passwordResetSuccessTemplate({ name: params.name, loginUrl: `${env.CLIENT_URL}/login` }),
      });
    } catch {
      console.error('Password reset success email failed');
    }
  },
};
