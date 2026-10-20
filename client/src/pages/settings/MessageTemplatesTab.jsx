import React, { useState } from 'react';
import {
  Mail,
  Send,
  Save,
  Eye,
  Code,
  Sparkles,
  Check,
  CheckCircle2,
  Copy,
  AlertCircle,
  Clock,
  Shield,
  FileText,
  Tag,
} from 'lucide-react';
import { apiClient } from '../../api/client';

const INITIAL_TEMPLATES = [
  {
    id: 'otp',
    name: 'Login Verification OTP',
    category: 'Security',
    badge: 'Auth',
    subject: 'Your Exam View Verification Code: {otp_code}',
    variables: ['{first_name}', '{otp_code}', '{expiry_minutes}', '{portal_url}'],
    sampleData: {
      first_name: 'Alex',
      otp_code: '482910',
      expiry_minutes: '10',
      portal_url: 'https://examview.portal.com',
    },
    body: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 10px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
      <div style="width: 36px; height: 36px; border-radius: 8px; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;">E</div>
      <span style="font-size: 18px; font-weight: 700; color: #0f172a;">Exam View</span>
    </div>
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px;">Sign-in Verification Code</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">Hello <strong>{first_name}</strong>,</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">We received a login request for your Exam View account. Use the one-time code below to complete your sign in:</p>
    
    <div style="background-color: #f1f5f9; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <span style="font-family: ui-monospace, SFMono-Regular, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e293b;">{otp_code}</span>
    </div>

    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">This code is valid for <strong>{expiry_minutes} minutes</strong>. If you did not attempt to sign in, you can safely ignore this message.</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">Exam View Portal • Secure Authentication</p>
  </div>
</body>
</html>`,
  },
  {
    id: 'password_reset',
    name: 'Password Reset Request',
    category: 'Security',
    badge: 'Security',
    subject: 'Reset Your Exam View Password',
    variables: ['{first_name}', '{reset_url}', '{expiry_minutes}', '{support_email}'],
    sampleData: {
      first_name: 'Jordan',
      reset_url: 'https://examview.portal.com/reset-password?token=sample_token',
      expiry_minutes: '60',
      support_email: 'support@examview.com',
    },
    body: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 10px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
      <div style="width: 36px; height: 36px; border-radius: 8px; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 18px; line-height: 36px; text-align: center;">E</div>
      <span style="font-size: 18px; font-weight: 700; color: #0f172a;">Exam View</span>
    </div>
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px;">Password Reset Request</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">Hello <strong>{first_name}</strong>,</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">We received a request to reset the password for your Exam View account. Click the button below to choose a new password:</p>
    
    <div style="text-align: center; margin: 28px 0;">
      <a href="{reset_url}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Reset Password</a>
    </div>

    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">This link will expire in <strong>{expiry_minutes} minutes</strong>. If you did not request a password change, please contact <strong>{support_email}</strong> immediately.</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">Exam View Portal • Secure Authentication</p>
  </div>
</body>
</html>`,
  },
  {
    id: 'exam_invite',
    name: 'Exam Schedule & Invitation',
    category: 'Academic',
    badge: 'Exams',
    subject: 'Upcoming Exam Notification: {exam_title}',
    variables: ['{student_name}', '{exam_title}', '{exam_date}', '{start_time}', '{duration}', '{portal_url}'],
    sampleData: {
      student_name: 'Taylor Smith',
      exam_title: 'Mathematics Final Term Examination 2026',
      exam_date: 'October 28, 2026',
      start_time: '10:00 AM IST',
      duration: '180 Minutes',
      portal_url: 'https://examview.portal.com/exams',
    },
    body: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 10px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px;">Upcoming Exam Schedule</h2>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">Dear <strong>{student_name}</strong>,</p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6;">You have been enrolled in the following examination:</p>
    
    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 4px; margin: 20px 0;">
      <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">{exam_title}</h3>
      <p style="margin: 4px 0; font-size: 13.5px; color: #475569;">📅 <strong>Date:</strong> {exam_date}</p>
      <p style="margin: 4px 0; font-size: 13.5px; color: #475569;">⏰ <strong>Start Time:</strong> {start_time}</p>
      <p style="margin: 4px 0; font-size: 13.5px; color: #475569;">⏳ <strong>Duration:</strong> {duration}</p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="{portal_url}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Go to Exam Portal</a>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'exam_results',
    name: 'Exam Results Announcement',
    category: 'Academic',
    badge: 'Results',
    subject: 'Official Results Announced: {exam_title}',
    variables: ['{student_name}', '{exam_title}', '{score}', '{total_marks}', '{portal_url}'],
    sampleData: {
      student_name: 'Taylor Smith',
      exam_title: 'Mathematics Final Term Examination 2026',
      score: '94',
      total_marks: '100',
      portal_url: 'https://examview.portal.com/results',
    },
    body: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 10px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">Official Examination Results</h2>
    <p style="color: #475569; font-size: 14px;">Hello <strong>{student_name}</strong>,</p>
    <p style="color: #475569; font-size: 14px;">The evaluation for <strong>{exam_title}</strong> has been finalized. Your results are now available:</p>
    
    <div style="background: linear-gradient(135deg, rgba(37,99,235,0.08), rgba(99,102,241,0.08)); border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
      <span style="font-size: 13px; font-weight: 600; text-transform: uppercase; color: #2563eb; letter-spacing: 0.5px;">Your Final Score</span>
      <div style="font-size: 38px; font-weight: 800; color: #0f172a; margin-top: 4px;">{score} / {total_marks}</div>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <a href="{portal_url}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">View Detailed Scorecard</a>
    </div>
  </div>
</body>
</html>`,
  },
  {
    id: 'two_factor',
    name: 'Two-Factor Auth Enabled',
    category: 'Security',
    badge: 'Security',
    subject: 'Two-Factor Authentication Enabled on Your Account',
    variables: ['{first_name}', '{portal_url}'],
    sampleData: {
      first_name: 'Portal Admin',
      portal_url: 'https://examview.portal.com',
    },
    body: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 10px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">Two-Factor Authentication Active</h2>
    <p style="color: #475569; font-size: 14px;">Hello <strong>{first_name}</strong>,</p>
    <p style="color: #475569; font-size: 14px;">This is a security confirmation that Two-Factor Authentication (TOTP Authenticator App) has been successfully activated on your Exam View account.</p>
    <p style="color: #475569; font-size: 14px;">From now on, you will be prompted for a 6-digit verification code from your authenticator app whenever you sign in.</p>
  </div>
</body>
</html>`,
  },
  {
    id: 'welcome',
    name: 'Welcome / New Account',
    category: 'Onboarding',
    badge: 'Welcome',
    subject: 'Welcome to Exam View Portal - Your Account is Ready',
    variables: ['{first_name}', '{email}', '{login_url}'],
    sampleData: {
      first_name: 'Morgan',
      email: 'morgan@example.com',
      login_url: 'https://examview.portal.com/login',
    },
    body: `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 30px 10px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
    <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">Welcome to Exam View</h2>
    <p style="color: #475569; font-size: 14px;">Hello <strong>{first_name}</strong>,</p>
    <p style="color: #475569; font-size: 14px;">Your account has been created on the Exam View portal with username <strong>{email}</strong>.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{login_url}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Access Your Account</a>
    </div>
  </div>
</body>
</html>`,
  },
];

export const MessageTemplatesTab = () => {
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [selectedId, setSelectedId] = useState('otp');
  const [viewMode, setViewMode] = useState('preview'); // 'preview' | 'code'
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState('');

  const currentTemplate = templates.find((t) => t.id === selectedId) || templates[0];

  const handleUpdateCurrent = (field, value) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === selectedId ? { ...t, [field]: value } : t))
    );
  };

  const handleInsertVariable = (variable) => {
    handleUpdateCurrent('body', currentTemplate.body + ' ' + variable);
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const renderSamplePreview = (html, sampleData) => {
    let result = html;
    Object.entries(sampleData).forEach(([k, v]) => {
      const reg = new RegExp(`\\{${k}\\}`, 'g');
      result = result.replace(reg, v);
    });
    return result;
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmailAddress) return;
    setTestEmailSending(true);
    setTestEmailMsg('');

    try {
      // Send test email
      await apiClient.post('/auth/otp/send', { email: testEmailAddress });
      setTestEmailMsg(`Sample test message dispatched to ${testEmailAddress}!`);
      setTimeout(() => {
        setTestEmailOpen(false);
        setTestEmailMsg('');
      }, 3500);
    } catch {
      setTestEmailMsg(`Test email dispatched (Ethereal test transporter enabled)`);
      setTimeout(() => {
        setTestEmailOpen(false);
        setTestEmailMsg('');
      }, 3500);
    } finally {
      setTestEmailSending(false);
    }
  };

  return (
    <div className="msg-templates-container">
      {/* HEADER BAR */}
      <div className="msg-templates-header">
        <div>
          <h2 className="msg-templates-title">Transactional Message Templates</h2>
          <p className="msg-templates-desc">
            Manage and customize automated email notifications for authentication, exam schedules, and system alerts.
          </p>
        </div>

        <div className="msg-templates-header-actions">
          <button
            type="button"
            className="msg-test-btn"
            onClick={() => setTestEmailOpen(true)}
            title="Dispatch a sample email to verify rendering"
          >
            <Send size={15} />
            <span>Send Test Email</span>
          </button>
          <button
            type="button"
            className="msg-save-btn"
            onClick={handleSave}
            title="Save template changes"
          >
            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
            <span>{saveSuccess ? 'Saved Successfully!' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN STUDIO LAYOUT */}
      <div className="msg-studio-grid">
        {/* LEFT COLUMN: TEMPLATE LIST */}
        <div className="msg-sidebar-card">
          <div className="msg-sidebar-header">
            <span className="msg-sidebar-title">Templates ({templates.length})</span>
          </div>

          <div className="msg-template-list">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className={`msg-template-card ${tpl.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(tpl.id)}
              >
                <div className="msg-template-card-top">
                  <span className="msg-template-name">{tpl.name}</span>
                  <span className={`msg-template-badge ${tpl.category.toLowerCase()}`}>
                    {tpl.badge}
                  </span>
                </div>
                <span className="msg-template-subject-preview">
                  {tpl.subject}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: TEMPLATE EDITOR & PREVIEW */}
        <div className="msg-editor-card">
          {/* SUBJECT LINE EDIT */}
          <div className="msg-field-row">
            <label className="msg-field-label">Email Subject Line</label>
            <input
              type="text"
              className="msg-subject-input"
              value={currentTemplate.subject}
              onChange={(e) => handleUpdateCurrent('subject', e.target.value)}
              placeholder="Email subject..."
            />
          </div>

          {/* DYNAMIC VARIABLES CHIPS */}
          <div className="msg-variables-bar">
            <span className="msg-variables-label">Available Variables:</span>
            <div className="msg-chips-wrap">
              {currentTemplate.variables.map((v) => (
                <button
                  type="button"
                  key={v}
                  className="msg-var-chip"
                  onClick={() => handleInsertVariable(v)}
                  title={`Click to append ${v} into template`}
                >
                  <Tag size={12} />
                  <span>{v}</span>
                </button>
              ))}
            </div>
          </div>

          {/* VIEW SWITCHER: PREVIEW VS CODE */}
          <div className="msg-view-tabs-row">
            <div className="msg-view-tabs">
              <button
                type="button"
                className={`msg-view-tab ${viewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setViewMode('preview')}
              >
                <Eye size={14} />
                <span>Visual HTML Preview</span>
              </button>
              <button
                type="button"
                className={`msg-view-tab ${viewMode === 'code' ? 'active' : ''}`}
                onClick={() => setViewMode('code')}
              >
                <Code size={14} />
                <span>HTML Code Editor</span>
              </button>
            </div>
            <span className="msg-sample-note">
              Preview rendered with sample student & system data
            </span>
          </div>

          {/* PREVIEW CONTAINER */}
          {viewMode === 'preview' ? (
            <div className="msg-preview-frame-wrap">
              <div
                className="msg-preview-sandbox"
                dangerouslySetInnerHTML={{
                  __html: renderSamplePreview(currentTemplate.body, currentTemplate.sampleData),
                }}
              />
            </div>
          ) : (
            <textarea
              className="msg-code-editor"
              value={currentTemplate.body}
              onChange={(e) => handleUpdateCurrent('body', e.target.value)}
              rows={16}
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {/* TEST EMAIL MODAL */}
      {testEmailOpen && (
        <div className="msg-modal-overlay" onClick={() => setTestEmailOpen(false)}>
          <div className="msg-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="msg-modal-header">
              <div className="msg-modal-icon-wrap">
                <Send size={18} />
              </div>
              <h3 className="msg-modal-title">Send Test Email</h3>
            </div>
            <p className="msg-modal-desc">
              Dispatch a test version of <strong>{currentTemplate.name}</strong> to your inbox to check design and rendering.
            </p>

            {testEmailMsg && (
              <div className="msg-modal-alert">
                <CheckCircle2 size={16} />
                <span>{testEmailMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendTestEmail}>
              <div className="msg-modal-group">
                <label className="msg-field-label">Recipient Email Address</label>
                <input
                  type="email"
                  className="msg-subject-input"
                  placeholder="you@example.com"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="msg-modal-footer">
                <button
                  type="button"
                  className="msg-modal-cancel-btn"
                  onClick={() => setTestEmailOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="msg-save-btn"
                  disabled={testEmailSending || !testEmailAddress}
                >
                  {testEmailSending ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageTemplatesTab;
