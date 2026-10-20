import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { logger } from '../core/logger.js';

class EmailService {
  /**
   * Lazily creates or returns the nodemailer transporter using current env vars
   */
  getTransporter() {
    const user = env.SMTP_USER?.trim() || '';
    // Clean spaces that users often copy from Google App Passwords (e.g. "abcd efgh ijkl mnop")
    const pass = env.SMTP_PASS?.replace(/\s+/g, '') || '';
    const host = env.SMTP_HOST?.trim() || '';
    const port = Number(env.SMTP_PORT) || 587;
    const isSecure = env.SMTP_SECURE === 'true' || port === 465;

    // Direct Gmail configuration if host is smtp.gmail.com or provider is google
    if (host === 'smtp.gmail.com' || env.EMAIL_PROVIDER === 'google') {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    }

    // Standard SMTP transporter
    return nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port,
      secure: isSecure,
      auth: { user, pass },
    });
  }

  /**
   * Send an email
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} html - HTML email body
   */
  async sendEmail(to, subject, html) {
    try {
      const transporter = this.getTransporter();
      const from = env.EMAIL_FROM || (env.SMTP_USER ? `"Exam View" <${env.SMTP_USER}>` : '"Exam View" <noreply@examview.com>');

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      logger.info(`[Email] Successfully sent to ${to}. MessageId: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`[Email] Failed to send to ${to}`, error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
