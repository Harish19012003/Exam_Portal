import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { logger } from '../core/logger.js';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.example.com',
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE || false,
      auth: {
        user: env.SMTP_USER || 'user',
        pass: env.SMTP_PASS || 'pass',
      },
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
      const info = await this.transporter.sendMail({
        from: env.SMTP_FROM || '"Exam Portal" <noreply@examportal.com>',
        to,
        subject,
        html,
      });
      logger.info(`[Email] Sent to ${to}. MessageId: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error(`[Email] Failed to send to ${to}`, error);
      throw new Error('Failed to send email');
    }
  }
}

export const emailService = new EmailService();
