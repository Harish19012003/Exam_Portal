import axios from 'axios';
import env from '../config/env.js';
import { logger } from '../core/logger.js';

const WA_API_URL = 'https://wa.officall.ceoitbox.com/api/sendText';

export const whatsappService = {
  /**
   * Sends a WhatsApp message via ceoitbox
   * @param {string} phone - Target phone number with country code (e.g. 919876543210)
   * @param {string} text - Message text
   */
  async sendMessage(phone, text) {
    try {
      const response = await axios.post(
        WA_API_URL,
        {
          number: phone,
          text: text,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.WHATSAPP_API_KEY || 'demo-key'}`,
          },
        }
      );
      logger.info(`[WhatsApp] Sent message to ${phone}`);
      return response.data;
    } catch (error) {
      logger.error(`[WhatsApp] Failed to send message to ${phone}`, error?.response?.data || error.message);
      // Depending on severity, we may or may not throw.
      return { success: false, error: error.message };
    }
  }
};
