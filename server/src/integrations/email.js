import nodemailer from 'nodemailer';
import { logger } from '../core/logger.js';
import { getEmailConfig } from '../services/email-config.service.js';

// Fail fast if the mail server cannot be reached (some hosts block SMTP) instead of hanging for minutes.
const TIMEOUTS = { connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 20000 };

const OUTLOOK_HOST = 'smtp.office365.com';

/** Build a nodemailer transporter from a resolved config (see services/email-config.service.js). */
export const buildTransporter = (config) => {
  const { provider, user, pass } = config;
  const host = config.host || (provider === 'outlook' ? OUTLOOK_HOST : 'smtp.gmail.com');
  const port = Number(config.port) || 587;
  const secure = Boolean(config.secure) || port === 465;

  // Gmail has a dedicated preset (handles host / port / TLS for us)
  if (host === 'smtp.gmail.com' || provider === 'google') {
    return nodemailer.createTransport({ service: 'gmail', auth: { user, pass }, ...TIMEOUTS });
  }

  return nodemailer.createTransport({ host, port, secure, auth: { user, pass }, ...TIMEOUTS });
};

const defaultFrom = (config) =>
  config.from || (config.user ? `"Exam View" <${config.user}>` : '"Exam View" <noreply@examview.com>');

class EmailService {
  /** Send with an explicit config (used by the "send test email" button). */
  async sendWithConfig(config, to, subject, html) {
    const transporter = buildTransporter(config);
    return transporter.sendMail({ from: defaultFrom(config), to, subject, html });
  }

  /**
   * Send an email using the saved configuration (Platform Settings), or the server env as fallback.
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML email body
   */
  async sendEmail(to, subject, html) {
    try {
      const config = await getEmailConfig();
      const info = await this.sendWithConfig(config, to, subject, html);
      logger.info(`[Email] Successfully sent to ${to}. MessageId: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`[Email] Failed to send to ${to}`, error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
