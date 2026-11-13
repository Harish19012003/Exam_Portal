/**
 * Built-in email templates (used until a super admin customises them in Settings > Message Templates).
 * `required` templates power sign-in and password recovery: they can be switched off, but the admin is warned first.
 */
export const DEFAULT_TEMPLATES = [
  {
    "id": "otp",
    "name": "Login Verification OTP",
    "badge": "Auth",
    "required": true,
    "variables": [
      "first_name",
      "otp_code",
      "expiry_minutes",
      "portal_url"
    ],
    "sample": {
      "first_name": "Alex",
      "otp_code": "482910",
      "expiry_minutes": "5",
      "portal_url": "https://examview.portal.com"
    },
    "subject": "Your Exam View Verification Code: {otp_code}",
    "body": "<!DOCTYPE html>\n<html>\n<body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 30px 10px;\">\n  <div style=\"max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05);\">\n    <div style=\"display: flex; align-items: center; gap: 10px; margin-bottom: 24px;\">\n      <div style=\"width: 36px; height: 36px; border-radius: 8px; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;\">E</div>\n      <span style=\"font-size: 18px; font-weight: 700; color: #030712;\">Exam View</span>\n    </div>\n    <h2 style=\"font-size: 20px; font-weight: 700; color: #030712; margin-top: 0; margin-bottom: 12px;\">Sign-in Verification Code</h2>\n    <p style=\"color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 20px;\">Hello <strong>{first_name}</strong>,</p>\n    <p style=\"color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 24px;\">We received a login request for your Exam View account. Use the one-time code below to complete your sign in:</p>\n    \n    <div style=\"background-color: #f3f4f6; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;\">\n      <span style=\"font-family: ui-monospace, SFMono-Regular, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #111827;\">{otp_code}</span>\n    </div>\n\n    <p style=\"color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 20px;\">This code is valid for <strong>{expiry_minutes} minutes</strong>. If you did not attempt to sign in, you can safely ignore this message.</p>\n    <hr style=\"border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;\" />\n    <p style=\"color: #9ca3af; font-size: 12px; margin: 0; text-align: center;\">Exam View Portal • Secure Authentication</p>\n  </div>\n</body>\n</html>"
  },
  {
    "id": "password_reset",
    "name": "Password Reset Request",
    "badge": "Security",
    "required": true,
    "variables": [
      "first_name",
      "reset_url",
      "expiry_minutes",
      "support_email"
    ],
    "sample": {
      "first_name": "Jordan",
      "reset_url": "https://examview.portal.com/reset-password?token=sample_token",
      "expiry_minutes": "15",
      "support_email": "support@examview.com"
    },
    "subject": "Reset Your Exam View Password",
    "body": "<!DOCTYPE html>\n<html>\n<body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 30px 10px;\">\n  <div style=\"max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05);\">\n    <div style=\"display: flex; align-items: center; gap: 10px; margin-bottom: 24px;\">\n      <div style=\"width: 36px; height: 36px; border-radius: 8px; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;\">E</div>\n      <span style=\"font-size: 18px; font-weight: 700; color: #030712;\">Exam View</span>\n    </div>\n    <h2 style=\"font-size: 20px; font-weight: 700; color: #030712; margin-top: 0; margin-bottom: 12px;\">Password Reset Request</h2>\n    <p style=\"color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 20px;\">Hello <strong>{first_name}</strong>,</p>\n    <p style=\"color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 24px;\">We received a request to reset the password for your Exam View account. Click the button below to choose a new password:</p>\n    \n    <div style=\"text-align: center; margin: 28px 0;\">\n      <a href=\"{reset_url}\" style=\"background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;\">Reset Password</a>\n    </div>\n\n    <p style=\"color: #6b7280; font-size: 13px; line-height: 1.5; margin-bottom: 20px;\">This link will expire in <strong>{expiry_minutes} minutes</strong>. If you did not request a password change, please contact <strong>{support_email}</strong> immediately.</p>\n    <hr style=\"border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;\" />\n    <p style=\"color: #9ca3af; font-size: 12px; margin: 0; text-align: center;\">Exam View Portal • Secure Authentication</p>\n  </div>\n</body>\n</html>"
  },
  {
    "id": "two_factor",
    "name": "Two-Factor Auth Enabled",
    "badge": "Security",
    "required": false,
    "variables": [
      "first_name",
      "portal_url"
    ],
    "sample": {
      "first_name": "Portal Admin",
      "portal_url": "https://examview.portal.com"
    },
    "subject": "Two-Factor Authentication Enabled on Your Account",
    "body": "<!DOCTYPE html>\n<html>\n<body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 30px 10px;\">\n  <div style=\"max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;\">\n    <h2 style=\"font-size: 20px; font-weight: 700; color: #030712; margin-top: 0;\">Two-Factor Authentication Active</h2>\n    <p style=\"color: #4b5563; font-size: 14px;\">Hello <strong>{first_name}</strong>,</p>\n    <p style=\"color: #4b5563; font-size: 14px;\">This is a security confirmation that Two-Factor Authentication (TOTP Authenticator App) has been successfully activated on your Exam View account.</p>\n    <p style=\"color: #4b5563; font-size: 14px;\">From now on, you will be prompted for a 6-digit verification code from your authenticator app whenever you sign in.</p>\n  </div>\n</body>\n</html>"
  },
  {
    "id": "welcome",
    "name": "Welcome / New Account",
    "badge": "Welcome",
    "required": false,
    "variables": [
      "first_name",
      "email",
      "login_url"
    ],
    "sample": {
      "first_name": "Morgan",
      "email": "morgan@example.com",
      "login_url": "https://examview.portal.com/login"
    },
    "subject": "Welcome to Exam View Portal - Your Account is Ready",
    "body": "<!DOCTYPE html>\n<html>\n<body style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 30px 10px;\">\n  <div style=\"max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;\">\n    <h2 style=\"font-size: 20px; font-weight: 700; color: #030712; margin-top: 0;\">Welcome to Exam View</h2>\n    <p style=\"color: #4b5563; font-size: 14px;\">Hello <strong>{first_name}</strong>,</p>\n    <p style=\"color: #4b5563; font-size: 14px;\">Your account has been created on the Exam View portal with username <strong>{email}</strong>.</p>\n    <div style=\"text-align: center; margin: 24px 0;\">\n      <a href=\"{login_url}\" style=\"background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;\">Access Your Account</a>\n    </div>\n  </div>\n</body>\n</html>"
  }
];
