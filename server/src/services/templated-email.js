import env from '../config/env.js';
import { emailService } from '../integrations/email.js';
import { renderTemplate } from '../api/v1/settings/message-templates.service.js';
import { getPlatformSettings } from '../api/v1/settings/platform-settings.service.js';

/**
 * Send one of the editable email templates (Settings > Message Templates).
 * `portal_url` and `support_email` are filled in automatically; pass the rest in `values`.
 * Resolves to false (and sends nothing) when the template has been switched off.
 */
export const sendTemplatedEmail = async (templateId, to, values = {}) => {
  const platform = await getPlatformSettings();
  const rendered = await renderTemplate(templateId, {
    portal_url: env.CLIENT_URL,
    login_url: `${env.CLIENT_URL}/login`,
    support_email: platform.support_email,
    ...values,
  });
  if (!rendered) {return false;}
  await emailService.sendEmail(to, rendered.subject, rendered.html);
  return true;
};
