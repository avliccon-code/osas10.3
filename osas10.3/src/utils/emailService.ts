import {
  Appointment,
  Announcement,
  SafetyReport,
  ScholarshipApplication,
  DormApplicant,
  DormReport,
  DisciplinaryReport,
  DisciplinaryRecord,
  User,
} from '../types';

/**
 * Environment-aware SMTP & Email Configuration
 */
const getEnvVar = (key: string, fallback: string): string => {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (metaEnv && metaEnv[key] && typeof metaEnv[key] === 'string' && metaEnv[key]?.trim() !== '') {
      return metaEnv[key]!.trim();
    }
  } catch {
    // Ignore if import.meta is not accessible in certain runtime environments
  }
  return fallback;
};

export const ADMIN_EMAIL = getEnvVar('VITE_ADMIN_EMAIL', 'arnoldviena@gmail.com');
export const GUIDANCE_ADMIN_EMAIL = getEnvVar('VITE_GUIDANCE_ADMIN_EMAIL', 'avliccon04@gmail.com');
export const SENDER_EMAIL = getEnvVar('VITE_SMTP_USER', getEnvVar('VITE_SENDER_EMAIL', 'arnoldviena@gmail.com'));
export const SENDER_NAME = getEnvVar('VITE_SENDER_NAME', 'Dingalan Community College - OSAS');
export const SMTP_HOST = getEnvVar('VITE_SMTP_HOST', 'smtp.gmail.com');
export const SMTP_PORT = parseInt(getEnvVar('VITE_SMTP_PORT', '587'), 10);

export interface EmailConfig {
  senderEmail: string;
  senderName: string;
  adminEmail: string;
  smtpHost: string;
  smtpPort: number;
}

export function getEmailConfig(): EmailConfig {
  return {
    senderEmail: SENDER_EMAIL,
    senderName: SENDER_NAME,
    adminEmail: ADMIN_EMAIL,
    smtpHost: SMTP_HOST,
    smtpPort: SMTP_PORT,
  };
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  category?: 'REGISTRATION' | 'APPOINTMENT' | 'SCHOLARSHIP' | 'DORM' | 'DISCIPLINE' | 'SAFETY' | 'ANNOUNCEMENT' | 'GENERAL';
}

export interface EmailLogEntry {
  id: string;
  email: string;
  toEmail: string;
  subject: string;
  body: string;
  sender: string;
  category?: string;
  sentAt: string;
  timestamp: string;
}

/**
 * Record sent email into persistent local logs for administrative audit trail
 */
function recordEmailLog(to: string, subject: string, body: string, category?: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('osas_email_logs');
    const logs: EmailLogEntry[] = raw ? JSON.parse(raw) : [];
    const newLog: EmailLogEntry = {
      id: `email-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      email: to,
      toEmail: to,
      subject,
      body,
      sender: SENDER_EMAIL,
      category: category || 'GENERAL',
      sentAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.removeItem('osas_email_logs');
      localStorage.setItem('osas_email_logs', JSON.stringify([newLog, ...logs].slice(0, 25)));
    } catch (_) {}
  } catch (err) {
    console.warn('[EmailService] Local log error', err);
  }
}

/**
 * Core Centralized Email Dispatching Service
 * Supports:
 * 1. Local Express API backend (`/api/send-email`)
 * 2. Netlify Serverless Functions (`/.netlify/functions/send-email`)
 * 3. Client notification event broadcast for real-time in-app alerts
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; message?: string; delivered?: boolean }> {
  const { to, subject, html, text, category } = options;

  if (!to || !subject) {
    console.warn('[EmailService] Skipped dispatch: Missing recipient or subject');
    return { success: false, message: 'Missing recipient or subject' };
  }

  // Plain text conversion fallback
  const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // Audit log in storage
  recordEmailLog(to, subject, plainText, category);

  let delivered = false;
  let statusMessage = `Email processed for ${to}`;

  // Dispatch HTTP request to Backend / Netlify Serverless Function
  if (typeof window !== 'undefined') {
    try {
      const payload = {
        to,
        subject,
        html,
        text: plainText,
      };

      // Try primary API endpoint
      let res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);

      // Fallback to Netlify function if primary endpoint is not available or failed
      if (!res || !res.ok) {
        const netlifyRes = await fetch('/.netlify/functions/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => null);

        if (netlifyRes && (netlifyRes.ok || !res)) {
          res = netlifyRes;
        }
      }

      if (res && res.ok) {
        const resData = await res.json().catch(() => null);
        if (resData?.delivered) {
          delivered = true;
          statusMessage = resData?.message || `Live email successfully delivered to ${to} via SMTP.`;
          console.log(`[EmailService] Live email successfully delivered to ${to} (${subject})`);
        } else if (resData?.success) {
          statusMessage = resData?.message || `Email dispatched to ${to}.`;
        }
      } else if (res) {
        const errData = await res.json().catch(() => null);
        statusMessage = errData?.error || `Email dispatch error (HTTP ${res.status})`;
        console.warn('[EmailService] Dispatch error:', statusMessage);
      }
    } catch (err: any) {
      console.warn('[EmailService] Network error during email dispatch:', err);
      statusMessage = err?.message || 'Network error during email dispatch';
    }

    // Broadcast in-app toast event
    try {
      window.dispatchEvent(
        new CustomEvent('osas_email_sent', {
          detail: {
            toEmail: to,
            subject,
            body: plainText,
            sender: SENDER_EMAIL,
            category: category || 'GENERAL',
            timestamp: new Date().toISOString(),
          },
        })
      );
    } catch (e) {
      console.warn('[EmailService] Event dispatch error:', e);
    }
  }

  return { success: true, delivered, message: statusMessage };
}

/**
 * Standardized High-Contrast HTML Email Builder
 */
export function buildHtmlTemplate(params: {
  preheader?: string;
  headerTitle: string;
  headerSubtitle?: string;
  badgeText?: string;
  badgeColor?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  recipientName: string;
  introParagraph: string;
  detailsTable?: { label: string; value: string; isHighlight?: boolean }[];
  contentParagraphs?: string[];
  actionButton?: { label: string; url: string };
  securityNotice?: string;
}): string {
  const {
    preheader = 'OSAS Official Advisory & Transaction Notification',
    headerTitle,
    headerSubtitle = 'Dingalan Community College • Office of Student Affairs & Services',
    badgeText,
    badgeColor = 'blue',
    recipientName,
    introParagraph,
    detailsTable = [],
    contentParagraphs = [],
    actionButton,
    securityNotice,
  } = params;

  const badgeStyles: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    green: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    amber: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    red: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    purple: { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
  };

  const activeBadgeStyle = badgeStyles[badgeColor] || badgeStyles.blue;

  const detailsRows = detailsTable
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #475569; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; width: 35%; text-transform: uppercase; letter-spacing: 0.5px;">
          ${item.label}
        </td>
        <td style="padding: 10px 14px; font-size: 13px; font-weight: ${item.isHighlight ? '800' : '600'}; color: ${item.isHighlight ? '#0f172a' : '#1e293b'}; background-color: #ffffff; border-bottom: 1px solid #e2e8f0;">
          ${item.value}
        </td>
      </tr>
    `
    )
    .join('');

  const paragraphsHtml = contentParagraphs
    .map(
      (p) =>
        `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #334155;">${p}</p>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text for inbox preview -->
  <div style="display: none; max-height: 0px; overflow: hidden;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); padding: 28px 24px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #f59e0b; color: #0f172a; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 10px;">
                      DCC • OSAS OFFICIAL
                    </div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.3;">
                      ${headerTitle}
                    </h1>
                    <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500;">
                      ${headerSubtitle}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 28px 24px;">
              
              <!-- Greeting & Status Badge -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 20px;">
                <tr>
                  <td valign="middle">
                    <p style="margin: 0; font-size: 15px; font-weight: 700; color: #0f172a;">
                      Dear ${recipientName},
                    </p>
                  </td>
                  ${
                    badgeText
                      ? `
                  <td align="right" valign="middle">
                    <span style="display: inline-block; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 12px; background-color: ${activeBadgeStyle.bg}; color: ${activeBadgeStyle.text}; border: 1px solid ${activeBadgeStyle.border}; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${badgeText}
                    </span>
                  </td>
                  `
                      : ''
                  }
                </tr>
              </table>

              <!-- Intro Paragraph -->
              <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                ${introParagraph}
              </p>

              <!-- Details Table (if any) -->
              ${
                detailsTable.length > 0
                  ? `
              <div style="margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                  ${detailsRows}
                </table>
              </div>
              `
                  : ''
              }

              <!-- Additional Paragraphs -->
              ${paragraphsHtml}

              <!-- Action Call to Action (if any) -->
              ${
                actionButton
                  ? `
              <div style="margin: 28px 0 16px 0; text-align: center;">
                <a href="${actionButton.url}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 800; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3); letter-spacing: 0.2px;">
                  ${actionButton.label}
                </a>
              </div>
              `
                  : ''
              }

              <!-- Security Notice / Advisory (if any) -->
              ${
                securityNotice
                  ? `
              <div style="margin-top: 22px; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 6px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #475569; font-weight: 500;">
                  ⚠️ <strong>Security Advisory:</strong> ${securityNotice}
                </p>
              </div>
              `
                  : ''
              }

              <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #64748b;">
                  Warm regards,<br>
                  <strong style="color: #0f172a;">Office of Student Affairs & Services (OSAS)</strong><br>
                  <span style="font-size: 12px; color: #94a3b8;">Dingalan Community College • Guidance & Student Development</span>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                Official Institutional Notification
              </p>
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                This email was dispatched via OSAS Notification Engine on behalf of <strong>${SENDER_EMAIL}</strong>.
                If you have questions or received this in error, please contact the OSAS Helpdesk.
              </p>
              <p style="margin: 0; font-size: 10px; color: #cbd5e1;">
                © ${new Date().getFullYear()} Dingalan Community College — Office of Student Affairs & Services. All Rights Reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/* =========================================================================
   1. STUDENT RECORDS & AUTHENTICATION MODULE
   ========================================================================= */

/**
 * Sends student registration confirmation email with Student ID and credentials
 */
export async function sendStudentRegistrationEmail(
  student: {
    id: string;
    studentId: string;
    name: string;
    email: string;
    course?: string;
    yearLevel?: string;
  },
  oneTimePassword?: string
): Promise<void> {
  if (!student.email) return;

  const html = buildHtmlTemplate({
    preheader: `Welcome to DCC OSAS! Your Student ID is ${student.studentId}.`,
    headerTitle: 'Welcome to DCC OSAS Portal',
    badgeText: 'Account Created',
    badgeColor: 'blue',
    recipientName: student.name,
    introParagraph:
      'Your official student account has been successfully registered in the DCC Office of Student Affairs and Services (OSAS) Management System. You may now log in to access appointments, scholarships, dormitory services, and campus announcements.',
    detailsTable: [
      { label: 'Student ID', value: student.studentId, isHighlight: true },
      { label: 'Full Name', value: student.name },
      { label: 'Registered Email', value: student.email },
      { label: 'Course / Program', value: student.course || 'Not specified' },
      { label: 'Year Level', value: student.yearLevel || 'Not specified' },
      ...(oneTimePassword
        ? [{ label: 'Temporary Password (OTP)', value: oneTimePassword, isHighlight: true }]
        : []),
    ],
    contentParagraphs: [
      'Please keep your Student ID and login credentials confidential at all times. Upon initial login, you will be prompted to update your password.',
    ],
    securityNotice:
      'Never share your password or Student ID with anyone. The OSAS admin will never ask for your account credentials outside official secure channels.',
  });

  await sendEmail({
    to: student.email,
    subject: `🎓 Welcome to OSAS - Your Student Account (${student.studentId})`,
    html,
    category: 'REGISTRATION',
  });
}

/**
 * Sends Password Reset OTP or Reset Link
 */
export async function sendPasswordResetEmail(
  user: { name: string; email: string; studentId?: string },
  resetTokenOrOtp: string
): Promise<void> {
  if (!user.email) return;

  const html = buildHtmlTemplate({
    preheader: `Password reset request for ${user.email}`,
    headerTitle: 'OSAS Password Reset Request',
    badgeText: 'Security Alert',
    badgeColor: 'amber',
    recipientName: user.name,
    introParagraph:
      'We received a request to reset your password for your DCC OSAS account. Use the one-time verification code below to proceed with updating your password.',
    detailsTable: [
      { label: 'Registered Email', value: user.email },
      { label: 'One-Time Code (OTP)', value: resetTokenOrOtp, isHighlight: true },
      { label: 'Valid For', value: '15 Minutes' },
    ],
    contentParagraphs: [
      'If you did not request a password reset, please ignore this email or notify the OSAS administrator immediately.',
    ],
    securityNotice: 'Do not disclose this verification code to anyone.',
  });

  await sendEmail({
    to: user.email,
    subject: `🔐 OSAS Password Reset Verification Code: ${resetTokenOrOtp}`,
    html,
    category: 'REGISTRATION',
  });
}

/* =========================================================================
   2. APPOINTMENTS & GUIDANCE COUNSELING MODULE
   ========================================================================= */

/**
 * Sends email when a student creates a new appointment request
 */
export async function sendAppointmentCreatedEmail(
  appointment: Appointment,
  student: User
): Promise<void> {
  const studentName = student.fullName;
  const appDate = appointment.preferredDate;
  const appTime = appointment.preferredTime;

  // 1. Notify Admin
  const adminHtml = buildHtmlTemplate({
    preheader: `New appointment requested by ${studentName} for ${appDate}.`,
    headerTitle: 'New Student Appointment Request',
    badgeText: 'New Request',
    badgeColor: 'amber',
    recipientName: 'OSAS Administrator',
    introParagraph: `A new counseling/guidance appointment request has been submitted by student <strong>${studentName}</strong> (${student.studentId || 'N/A'}). Please review the schedule and assign status.`,
    detailsTable: [
      { label: 'Student Name', value: studentName, isHighlight: true },
      { label: 'Student ID', value: student.studentId || 'N/A' },
      { label: 'Program & Year', value: `${student.course || 'N/A'} - ${student.yearLevel || 'N/A'}` },
      { label: 'Requested Date', value: appDate },
      { label: 'Preferred Time', value: appTime },
      { label: 'Description / Purpose', value: appointment.description },
    ],
    contentParagraphs: [
      'Please access the OSAS Admin Dashboard to Approve, Reschedule, or coordinate with the student.',
    ],
  });

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `📅 New Appointment Request: ${studentName} (${appDate} @ ${appTime})`,
    html: adminHtml,
    category: 'APPOINTMENT',
  });

  // 2. Receipt Confirmation to Student
  if (student.email) {
    const studentHtml = buildHtmlTemplate({
      preheader: `Your appointment request for ${appDate} has been received.`,
      headerTitle: 'Appointment Request Received',
      badgeText: 'Pending Review',
      badgeColor: 'blue',
      recipientName: studentName,
      introParagraph:
        'Your appointment request has been safely filed with the Office of Student Affairs and Services. Our guidance staff is reviewing your requested date and time.',
      detailsTable: [
        { label: 'Requested Date', value: appDate, isHighlight: true },
        { label: 'Preferred Time', value: appTime },
        { label: 'Purpose / Description', value: appointment.description },
        { label: 'Current Status', value: 'PENDING (Under Review)' },
      ],
      contentParagraphs: [
        'You will receive an email update once your appointment is officially approved or rescheduled by the OSAS counselor.',
      ],
    });

    await sendEmail({
      to: student.email,
      subject: `📋 Appointment Request Filed - ${appDate}`,
      html: studentHtml,
      category: 'APPOINTMENT',
    });
  }
}

/**
 * Dispatches email when Admin updates an appointment status
 */
export async function sendAppointmentStatusEmail(
  appointment: Appointment,
  action: 'APPROVED' | 'RESCHEDULED' | 'REJECTED' | 'COMPLETED',
  studentEmail?: string,
  studentName?: string,
  extraNotes?: string
): Promise<void> {
  if (!studentEmail) return;

  const targetName = studentName || appointment.studentName || 'Student';
  const effectiveDate = action === 'RESCHEDULED' && appointment.adminPreferredDate ? appointment.adminPreferredDate : appointment.preferredDate;
  const effectiveTime = action === 'RESCHEDULED' && appointment.adminPreferredTime ? appointment.adminPreferredTime : appointment.preferredTime;

  let badgeColor: 'green' | 'amber' | 'red' | 'blue' = 'blue';
  let badgeText = 'Status Update';
  let subjectPrefix = '📅 Appointment Update';
  let introParagraph = '';

  if (action === 'APPROVED') {
    badgeColor = 'green';
    badgeText = 'Approved & Confirmed';
    subjectPrefix = '✅ Appointment Confirmed';
    introParagraph = `Great news! Your requested appointment with the Office of Student Affairs and Services has been <strong>APPROVED</strong>.`;
  } else if (action === 'RESCHEDULED') {
    badgeColor = 'amber';
    badgeText = 'Schedule Adjusted';
    subjectPrefix = '⚠️ Appointment Rescheduled';
    introParagraph = `Please note that your appointment has been <strong>RESCHEDULED</strong> by the OSAS Counselor to the new date and time listed below.`;
  } else if (action === 'REJECTED') {
    badgeColor = 'red';
    badgeText = 'Cancelled / Declined';
    subjectPrefix = '❌ Appointment Advisory';
    introParagraph = `We regret to inform you that your appointment request could not be accommodated at this time. Please see the guidance notes below.`;
  } else if (action === 'COMPLETED') {
    badgeColor = 'green';
    badgeText = 'Completed';
    subjectPrefix = '🌟 Appointment Completed - Thank You';
    introParagraph = `Your appointment session with the Office of Student Affairs & Services has been marked as <strong>COMPLETED</strong>. We hope our session was helpful.`;
  }

  const detailsTable = [
    { label: 'Appointment Date', value: effectiveDate, isHighlight: true },
    { label: 'Time Slot', value: effectiveTime, isHighlight: true },
    { label: 'Description / Topic', value: appointment.description },
    { label: 'Status', value: action },
    ...(extraNotes || appointment.adminNotes
      ? [{ label: 'Admin Remarks / Notes', value: extraNotes || appointment.adminNotes || 'None' }]
      : []),
  ];

  const contentParagraphs =
    action === 'COMPLETED'
      ? [
          'We value your feedback! Please log in to your OSAS student portal to leave a quick 5-star service rating to help us improve our guidance services.',
        ]
      : action === 'APPROVED'
      ? [
          'Please arrive 5–10 minutes before your designated schedule at the OSAS Guidance Office. If you need to reschedule or cannot make it, please notify OSAS promptly.',
        ]
      : [];

  const html = buildHtmlTemplate({
    preheader: `${subjectPrefix} for ${effectiveDate} at ${effectiveTime}.`,
    headerTitle: subjectPrefix,
    badgeText,
    badgeColor,
    recipientName: targetName,
    introParagraph,
    detailsTable,
    contentParagraphs,
  });

  await sendEmail({
    to: studentEmail,
    subject: `${subjectPrefix} - ${effectiveDate} (${effectiveTime})`,
    html,
    category: 'APPOINTMENT',
  });
}

/* =========================================================================
   3. SCHOLARSHIP & FINANCIAL GRANTS MODULE
   ========================================================================= */

/**
 * Sends email when a student applies for a scholarship
 */
export async function sendScholarshipApplicationAlertEmail(
  application: ScholarshipApplication,
  student: User
): Promise<void> {
  const applicantName = student.fullName || application.studentName;

  // 1. Notify Admin
  const adminHtml = buildHtmlTemplate({
    preheader: `New scholarship application for ${application.scholarshipTitle} by ${applicantName}.`,
    headerTitle: 'New Scholarship Grant Application',
    badgeText: 'Application Pending',
    badgeColor: 'amber',
    recipientName: 'Scholarship Coordinator',
    introParagraph: `A new student has submitted an application for <strong>${application.scholarshipTitle}</strong>.`,
    detailsTable: [
      { label: 'Scholarship Grant', value: application.scholarshipTitle, isHighlight: true },
      { label: 'Applicant Name', value: applicantName },
      { label: 'Student ID', value: application.studentId || student.studentId || 'N/A' },
      { label: 'Course & Year', value: `${student.course || application.course || 'N/A'} - ${student.yearLevel || application.yearLevel || 'N/A'}` },
      { label: 'Applied At', value: application.appliedAt || new Date().toLocaleDateString() },
    ],
    contentParagraphs: [
      'Please access the OSAS Scholarship Module to verify attached requirements and evaluate eligibility.',
    ],
  });

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `🎓 New Scholarship Application: ${applicantName} - ${application.scholarshipTitle}`,
    html: adminHtml,
    category: 'SCHOLARSHIP',
  });

  // 2. Receipt to Student
  if (student.email || application.studentEmail) {
    const studentHtml = buildHtmlTemplate({
      preheader: `Your application for ${application.scholarshipTitle} has been received.`,
      headerTitle: 'Scholarship Application Received',
      badgeText: 'Under Review',
      badgeColor: 'blue',
      recipientName: applicantName,
      introParagraph: `Your scholarship application for <strong>${application.scholarshipTitle}</strong> has been successfully submitted to OSAS.`,
      detailsTable: [
        { label: 'Scholarship Program', value: application.scholarshipTitle, isHighlight: true },
        { label: 'Application Date', value: application.appliedAt || new Date().toLocaleDateString() },
        { label: 'Current Status', value: 'PENDING EVALUATION' },
      ],
      contentParagraphs: [
        'The scholarship committee will review your documentary requirements. You will receive an email once the evaluation results are finalized.',
      ],
    });

    await sendEmail({
      to: student.email || application.studentEmail,
      subject: `📝 Scholarship Application Filed: ${application.scholarshipTitle}`,
      html: studentHtml,
      category: 'SCHOLARSHIP',
    });
  }
}

/**
 * Sends scholarship approval / rejection notification
 */
export async function sendScholarshipStatusEmail(
  application: ScholarshipApplication,
  status: 'ACCEPTED' | 'REJECTED',
  notes?: string,
  studentEmail?: string,
  studentName?: string
): Promise<void> {
  if (!studentEmail) return;

  const isAccepted = status === 'ACCEPTED';
  const badgeColor = isAccepted ? 'green' : 'red';
  const badgeText = isAccepted ? 'ACCEPTED / APPROVED' : 'APPLICATION DECLINED';
  const subjectPrefix = isAccepted
    ? '🎉 Congratulations! Scholarship Application Accepted'
    : '📋 Scholarship Application Update';

  const introParagraph = isAccepted
    ? `We are pleased to inform you that your application for <strong>${application.scholarshipTitle}</strong> has been officially <strong>ACCEPTED and APPROVED</strong>.`
    : `Thank you for your interest in <strong>${application.scholarshipTitle}</strong>. After careful evaluation, your application could not be accommodated at this time due to slot limitations or qualification criteria.`;

  const detailsTable = [
    { label: 'Scholarship Program', value: application.scholarshipTitle, isHighlight: true },
    { label: 'Application Status', value: isAccepted ? 'ACCEPTED' : 'REJECTED' },
    ...(notes ? [{ label: 'Committee Remarks', value: notes }] : []),
  ];

  const contentParagraphs = isAccepted
    ? [
        'Please report to the OSAS Scholarship Office within 5 business days with your original documentary requirements to finalize your grant credentials and signing.',
      ]
    : [
        'We encourage you to explore other available scholarship programs and grants posted on the OSAS Student Portal.',
      ];

  const html = buildHtmlTemplate({
    preheader: `${subjectPrefix} for ${application.scholarshipTitle}`,
    headerTitle: subjectPrefix,
    badgeText,
    badgeColor,
    recipientName: studentName || 'Applicant',
    introParagraph,
    detailsTable,
    contentParagraphs,
  });

  await sendEmail({
    to: studentEmail,
    subject: `${subjectPrefix} - ${application.scholarshipTitle}`,
    html,
    category: 'SCHOLARSHIP',
  });
}

/* =========================================================================
   4. DORMITORY HOUSING MODULE
   ========================================================================= */

/**
 * Sends dorm application alert to admin and receipt to applicant
 */
export async function sendDormApplicationAlertEmail(applicant: DormApplicant): Promise<void> {
  // 1. Notify Admin
  const adminHtml = buildHtmlTemplate({
    preheader: `New dormitory residency application from ${applicant.studentName}.`,
    headerTitle: 'New Dormitory Application',
    badgeText: 'Dorm Application',
    badgeColor: 'amber',
    recipientName: 'Dormitory Supervisor',
    introParagraph: `A student has submitted a new residency application for the DCC Campus Dormitories.`,
    detailsTable: [
      { label: 'Student Name', value: applicant.studentName, isHighlight: true },
      { label: 'Student ID', value: applicant.studentId },
      { label: 'Applicant Email', value: applicant.studentEmail },
      { label: 'Home Address', value: applicant.address },
      { label: 'Reason for Application', value: applicant.reason },
      { label: 'Date Applied', value: applicant.appliedAt || new Date().toLocaleDateString() },
    ],
    contentParagraphs: [
      'Please open the OSAS Dormitory Module to verify room slot availability and process room assignment.',
    ],
  });

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `🏠 New Dormitory Application: ${applicant.studentName} (${applicant.studentId})`,
    html: adminHtml,
    category: 'DORM',
  });

  // 2. Receipt to Student
  if (applicant.studentEmail) {
    const studentHtml = buildHtmlTemplate({
      preheader: `Your DCC Dormitory application has been received.`,
      headerTitle: 'Dormitory Application Received',
      badgeText: 'Under Review',
      badgeColor: 'blue',
      recipientName: applicant.studentName,
      introParagraph:
        'Your application for dormitory accommodation has been received and queued for slot verification by our housing team.',
      detailsTable: [
        { label: 'Student ID', value: applicant.studentId },
        { label: 'Current Status', value: 'PENDING SLOT ASSIGNMENT' },
      ],
      contentParagraphs: [
        'You will receive an official room assignment advisory via email once a suitable room slot is assigned.',
      ],
    });

    await sendEmail({
      to: applicant.studentEmail,
      subject: `🏠 Dormitory Residency Application Received`,
      html: studentHtml,
      category: 'DORM',
    });
  }
}

/**
 * Sends dorm application approval/status email with room number
 */
export async function sendDormApplicationStatusEmail(
  applicant: DormApplicant,
  status: 'ACCEPTED' | 'REJECTED',
  roomNumber?: string
): Promise<void> {
  if (!applicant.studentEmail) return;

  const isAccepted = status === 'ACCEPTED';
  const badgeColor = isAccepted ? 'green' : 'red';
  const badgeText = isAccepted ? 'ROOM ASSIGNED' : 'SLOT UNAVAILABLE';
  const subjectPrefix = isAccepted
    ? '🎉 Dormitory Application Approved & Room Assigned'
    : '🏠 Dormitory Application Advisory';

  const introParagraph = isAccepted
    ? `Congratulations! Your application for DCC Dormitory residency has been <strong>APPROVED</strong>. You have been assigned to <strong>Room ${roomNumber}</strong>.`
    : 'Thank you for your dormitory application. Regrettably, all slots in your requested wing are currently full at this time.';

  const detailsTable = isAccepted
    ? [
        { label: 'Assigned Room', value: `Room ${roomNumber}`, isHighlight: true },
        { label: 'Student ID', value: applicant.studentId },
        { label: 'Status', value: 'OFFICIALLY ADMITTED' },
      ]
    : [
        { label: 'Application Status', value: 'UNAVAILABLE / WAITLISTED' },
        { label: 'Student ID', value: applicant.studentId },
      ];

  const contentParagraphs = isAccepted
    ? [
        'Please visit the Dormitory In-Charge at the OSAS office to claim your room key, submit your health clearance, and review dormitory regulations.',
      ]
    : [
        'You have been placed on the dormitory waitlist. We will notify you as soon as a room slot becomes available.',
      ];

  const html = buildHtmlTemplate({
    preheader: `${subjectPrefix} - Room ${roomNumber || 'N/A'}`,
    headerTitle: subjectPrefix,
    badgeText,
    badgeColor,
    recipientName: applicant.studentName,
    introParagraph,
    detailsTable,
    contentParagraphs,
  });

  await sendEmail({
    to: applicant.studentEmail,
    subject: `${subjectPrefix} (${applicant.studentId})`,
    html,
    category: 'DORM',
  });
}

/**
 * Sends email when a student reports a dorm maintenance issue
 */
export async function sendDormReportAlertEmail(
  report: DormReport,
  studentEmail?: string
): Promise<void> {
  // 1. Notify Admin
  const adminHtml = buildHtmlTemplate({
    preheader: `Dorm Maintenance Issue: ${report.issueType} in Room ${report.roomNumber}.`,
    headerTitle: 'Dormitory Maintenance Issue Reported',
    badgeText: 'Maintenance Ticket',
    badgeColor: 'amber',
    recipientName: 'Dormitory Admin & Facilities',
    introParagraph: `A dormitory maintenance or amenity issue has been reported for <strong>Room ${report.roomNumber}</strong> by <strong>${report.studentName}</strong>.`,
    detailsTable: [
      { label: 'Room Number', value: report.roomNumber, isHighlight: true },
      { label: 'Issue Category', value: report.issueType, isHighlight: true },
      { label: 'Reported By', value: `${report.studentName} (${report.studentId})` },
      { label: 'Date Reported', value: report.reportedAt || new Date().toLocaleString() },
      { label: 'Issue Description', value: report.description },
      { label: 'Ticket Status', value: report.status || 'PENDING' },
    ],
    contentParagraphs: [
      'Please dispatch the maintenance staff or facilities team to inspect and repair the reported issue.',
    ],
  });

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `🔧 [DORM ISSUE] ${report.issueType} in Room ${report.roomNumber}`,
    html: adminHtml,
    category: 'DORM',
  });

  // 2. Receipt to Student
  if (studentEmail) {
    const studentHtml = buildHtmlTemplate({
      preheader: `Your dorm maintenance report for Room ${report.roomNumber} has been logged.`,
      headerTitle: 'Dorm Maintenance Ticket Logged',
      badgeText: 'Ticket Logged',
      badgeColor: 'blue',
      recipientName: report.studentName,
      introParagraph: `Your maintenance ticket for <strong>Room ${report.roomNumber}</strong> regarding <em>${report.issueType}</em> has been transmitted to OSAS Facilities.`,
      detailsTable: [
        { label: 'Room Number', value: report.roomNumber },
        { label: 'Issue Reported', value: report.issueType },
        { label: 'Status', value: 'PENDING ACTION' },
      ],
      contentParagraphs: [
        'Our maintenance crew will inspect the problem shortly. You will be notified once the repair is completed.',
      ],
    });

    await sendEmail({
      to: studentEmail,
      subject: `🔧 Dorm Report Logged - Room ${report.roomNumber}`,
      html: studentHtml,
      category: 'DORM',
    });
  }
}

/**
 * Sends email when Dorm issue is resolved
 */
export async function sendDormReportCompletedEmail(
  report: DormReport,
  studentEmail?: string
): Promise<void> {
  if (!studentEmail) return;

  const html = buildHtmlTemplate({
    preheader: `Maintenance Completed: Room ${report.roomNumber} (${report.issueType})`,
    headerTitle: 'Dorm Maintenance Resolved',
    badgeText: 'Resolved & Completed',
    badgeColor: 'green',
    recipientName: report.studentName,
    introParagraph: `The maintenance report filed for <strong>Room ${report.roomNumber}</strong> regarding <em>${report.issueType}</em> has been marked as <strong>COMPLETED and RESOLVED</strong>.`,
    detailsTable: [
      { label: 'Room Number', value: report.roomNumber },
      { label: 'Issue Type', value: report.issueType },
      { label: 'Resolved Date', value: new Date().toLocaleDateString() },
    ],
    contentParagraphs: [
      'Please verify the repair in your room. You may also leave a 5-star transaction rating on your OSAS portal to let us know how we did.',
    ],
  });

  await sendEmail({
    to: studentEmail,
    subject: `✅ Dorm Repair Completed - Room ${report.roomNumber}`,
    html,
    category: 'DORM',
  });
}

/* =========================================================================
   5. DISCIPLINARY & STUDENT CONDUCT MODULE
   ========================================================================= */

/**
 * Sends email when a disciplinary incident report is filed
 */
export async function sendDisciplinaryReportAlertEmail(report: DisciplinaryReport): Promise<void> {
  const adminHtml = buildHtmlTemplate({
    preheader: `New Disciplinary Incident Filed: ${report.incidentType} involving ${report.reportedStudentName}.`,
    headerTitle: 'Disciplinary Incident Report Filed',
    badgeText: 'Incident Report',
    badgeColor: 'red',
    recipientName: 'Discipline Officer',
    introParagraph: `A formal disciplinary incident report has been submitted in the OSAS Disciplinary Module.`,
    detailsTable: [
      { label: 'Incident Type', value: report.incidentType, isHighlight: true },
      { label: 'Reported Student', value: report.reportedStudentName, isHighlight: true },
      { label: 'Location', value: report.location },
      { label: 'Submitted By', value: report.reporterName },
      { label: 'Date Filed', value: report.submittedAt || new Date().toLocaleString() },
      { label: 'Description', value: report.description },
    ],
    contentParagraphs: [
      'Please access the OSAS Disciplinary Management Console to review the testimony, check evidence attachments, and initiate investigation.',
    ],
  });

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `⚖️ [DISCIPLINARY ALERT] ${report.incidentType} - ${report.reportedStudentName}`,
    html: adminHtml,
    category: 'DISCIPLINE',
  });
}

/**
 * Sends confidential disciplinary advisory notice to student
 */
export async function sendDisciplinaryRecordNoticeEmail(
  record: DisciplinaryRecord,
  studentEmail?: string
): Promise<void> {
  if (!studentEmail) return;

  const html = buildHtmlTemplate({
    preheader: `Official Disciplinary Notice from OSAS regarding ${record.offenseType}.`,
    headerTitle: 'Official Disciplinary Advisory',
    badgeText: 'Official Notice',
    badgeColor: 'red',
    recipientName: record.studentName,
    introParagraph: `This is an official communication from the Office of Student Affairs and Services concerning a recorded incident on campus.`,
    detailsTable: [
      { label: 'Offense / Violation', value: record.offenseType, isHighlight: true },
      { label: 'Description', value: record.description || 'Institutional Conduct Violation' },
      { label: 'Date Logged', value: record.dateLogged || new Date().toLocaleDateString() },
      { label: 'Prescribed Sanction', value: record.sanction, isHighlight: true },
      { label: 'Status', value: record.status || 'SANCTIONED' },
    ],
    contentParagraphs: [
      'Please report to the OSAS Guidance & Discipline Office for an official counseling conference and resolution session. Strict confidentiality is maintained throughout the process.',
    ],
    securityNotice:
      'This notice contains confidential student disciplinary records protected under institutional guidelines and data privacy policies.',
  });

  await sendEmail({
    to: studentEmail,
    subject: `⚖️ Confidential: OSAS Disciplinary Advisory (${record.studentId})`,
    html,
    category: 'DISCIPLINE',
  });
}

/**
 * Sends incident report investigation update to the reporting person
 */
export async function sendDisciplinaryReportStatusUpdateEmail(
  report: DisciplinaryReport,
  reporterEmail?: string
): Promise<void> {
  if (!reporterEmail || report.isAnonymousReporter) return;

  const html = buildHtmlTemplate({
    preheader: `Update on your submitted incident report (${report.incidentType}).`,
    headerTitle: 'Incident Report Status Update',
    badgeText: report.status.replace('_', ' '),
    badgeColor: report.status === 'RESOLVED' ? 'green' : report.status === 'UNDER_INVESTIGATION' ? 'amber' : 'blue',
    recipientName: report.reporterName || 'Reporter',
    introParagraph: `The OSAS Discipline Office has updated the status of your incident report filed on ${report.submittedAt || 'recent record'}.`,
    detailsTable: [
      { label: 'Incident Type', value: report.incidentType, isHighlight: true },
      { label: 'Involved Party', value: report.reportedStudentName },
      { label: 'Location', value: report.location },
      { label: 'Current Status', value: report.status.replace('_', ' '), isHighlight: true },
      ...(report.investigationNotes
        ? [{ label: 'Admin Remarks', value: report.investigationNotes, isHighlight: true }]
        : []),
    ],
    contentParagraphs: [
      'Thank you for your active cooperation in maintaining a safe, disciplined, and harmonious campus environment.',
    ],
  });

  await sendEmail({
    to: reporterEmail,
    subject: `⚖️ OSAS Incident Report Update: ${report.incidentType}`,
    html,
    category: 'DISCIPLINE',
  });
}

/* =========================================================================
   6. EMERGENCY & CAMPUS SAFETY MODULE
   ========================================================================= */

/**
 * Sends urgent safety incident report alert
 */
export async function sendSafetyReportAlertEmail(report: SafetyReport): Promise<void> {
  const isAnonymous = report.isAnonymous;
  const reporterDisplay = isAnonymous
    ? 'Anonymous Student (Protected)'
    : `${report.studentName || 'Student'} (${report.studentId || 'N/A'})`;

  const adminHtml = buildHtmlTemplate({
    preheader: `[URGENT SAFETY ALERT] Incident at ${report.location}`,
    headerTitle: '🚨 Urgent Safety & Incident Report',
    badgeText: 'URGENT ALERT',
    badgeColor: 'red',
    recipientName: 'OSAS Emergency Response Team',
    introParagraph:
      'An emergency incident report has just been filed in the OSAS Safety & Emergency Module. Immediate administrative attention and verification is required.',
    detailsTable: [
      { label: 'Location', value: report.location, isHighlight: true },
      { label: 'Persons Involved', value: report.involvedPersons || 'N/A' },
      { label: 'Date & Time', value: report.reportedAt ? new Date(report.reportedAt).toLocaleString() : new Date().toLocaleString() },
      { label: 'Filed By', value: reporterDisplay },
      { label: 'Report Description', value: report.description },
      { label: 'Current Status', value: report.status || 'REPORTED' },
    ],
    contentParagraphs: [
      'Please check the OSAS Safety Reports console immediately to view any attached evidence, coordinate with campus security, and document resolution steps.',
    ],
  });

  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `🚨 [URGENT OSAS SAFETY ALERT] Incident at ${report.location}`,
    html: adminHtml,
    category: 'SAFETY',
  });
}

/**
 * Sends safety report status resolution update
 */
export async function sendSafetyReportStatusUpdateEmail(
  report: SafetyReport,
  studentEmail?: string
): Promise<void> {
  if (!studentEmail || report.isAnonymous) return;

  const html = buildHtmlTemplate({
    preheader: `Update on your safety report at ${report.location}`,
    headerTitle: 'Safety Report Status Update',
    badgeText: report.status,
    badgeColor: report.status === 'RESOLVED' ? 'green' : 'amber',
    recipientName: report.studentName || 'Student',
    introParagraph: `The status of your filed incident report at <strong>${report.location}</strong> has been updated by OSAS.`,
    detailsTable: [
      { label: 'Location', value: report.location },
      { label: 'Description', value: report.description },
      { label: 'New Status', value: report.status, isHighlight: true },
      ...(report.notes ? [{ label: 'Resolution Notes', value: report.notes }] : []),
    ],
    contentParagraphs: [
      'The Office of Student Affairs and Services is committed to maintaining a safe campus environment. Thank you for your cooperation and vigilance.',
    ],
  });

  await sendEmail({
    to: studentEmail,
    subject: `🛡️ Update on Safety Report: ${report.location} (${report.status})`,
    html,
    category: 'SAFETY',
  });
}

/* =========================================================================
   7. ANNOUNCEMENTS & CAMPUS BROADCASTS
   ========================================================================= */

/**
 * Sends official bulletin broadcast to a list of student emails
 */
export async function sendAnnouncementBroadcastEmail(
  announcement: Announcement,
  recipientEmails: string[]
): Promise<void> {
  if (!recipientEmails || recipientEmails.length === 0) return;

  const html = buildHtmlTemplate({
    preheader: `OSAS Bulletin: ${announcement.title}`,
    headerTitle: 'Official OSAS Bulletin & Advisory',
    badgeText: announcement.category || 'Announcement',
    badgeColor: 'purple',
    recipientName: 'Students & Campus Community',
    introParagraph: `The Office of Student Affairs and Services has released an official bulletin:`,
    detailsTable: [
      { label: 'Title', value: announcement.title, isHighlight: true },
      { label: 'Category', value: announcement.category || 'General' },
      { label: 'Date Posted', value: announcement.createdAt ? new Date(announcement.createdAt).toLocaleDateString() : new Date().toLocaleDateString() },
    ],
    contentParagraphs: [
      `<strong>Bulletin Details:</strong><br><div style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px; border-left: 3px solid #6366f1; margin: 10px 0; color: #1e293b; font-size: 14px; line-height: 1.6;">${announcement.content}</div>`,
    ],
  });

  const uniqueEmails = Array.from(new Set(recipientEmails.filter(Boolean)));
  for (const email of uniqueEmails) {
    await sendEmail({
      to: email,
      subject: `📢 OSAS Announcement: ${announcement.title}`,
      html,
      category: 'ANNOUNCEMENT',
    });
  }
}

/* =========================================================================
   8. GENERIC / CUSTOM NOTIFICATION DISPATCHER
   ========================================================================= */

/**
 * Sends custom ad-hoc institutional email to any recipient
 */
export async function sendCustomEmail(params: {
  to: string;
  recipientName?: string;
  subject: string;
  headerTitle?: string;
  badgeText?: string;
  badgeColor?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  message: string;
  details?: { label: string; value: string; isHighlight?: boolean }[];
  actionButton?: { label: string; url: string };
  category?: 'GENERAL' | 'REGISTRATION' | 'APPOINTMENT' | 'SCHOLARSHIP' | 'DORM' | 'DISCIPLINE' | 'SAFETY' | 'ANNOUNCEMENT';
}): Promise<{ success: boolean; message?: string }> {
  const html = buildHtmlTemplate({
    preheader: params.subject,
    headerTitle: params.headerTitle || params.subject,
    badgeText: params.badgeText,
    badgeColor: params.badgeColor || 'blue',
    recipientName: params.recipientName || 'Student',
    introParagraph: params.message,
    detailsTable: params.details,
    actionButton: params.actionButton,
  });

  return await sendEmail({
    to: params.to,
    subject: params.subject,
    html,
    category: params.category || 'GENERAL',
  });
}

/**
 * Dispatch email notification to Guidance Admin when a student case or appointment is referred
 */
export async function sendGuidanceReferralAlertEmail(params: {
  studentName: string;
  studentId: string;
  type: 'APPOINTMENT' | 'DISCIPLINARY' | 'SAFETY';
  details: string;
  notes?: string;
  referredBy?: string;
}): Promise<{ success: boolean; message?: string }> {
  const html = buildHtmlTemplate({
    preheader: `New Referred Case: ${params.studentName} (${params.type})`,
    headerTitle: 'New Case Referred to Guidance Office',
    badgeText: 'Referred to Guidance',
    badgeColor: 'purple',
    recipientName: 'Maria Mel B. Glemao (Guidance Counselor & Admin)',
    introParagraph: `A new ${params.type.toLowerCase()} case has been officially referred to the Guidance Office by ${params.referredBy || 'OSAS Administration'}:`,
    detailsTable: [
      { label: 'Student Name', value: params.studentName, isHighlight: true },
      { label: 'Student ID', value: params.studentId },
      { label: 'Case Type', value: params.type, isHighlight: true },
      { label: 'Description', value: params.details },
      ...(params.notes ? [{ label: 'Referral Notes', value: params.notes }] : []),
      { label: 'Referred At', value: new Date().toLocaleString() },
    ],
    contentParagraphs: [
      'Please access the DCC OSAS Guidance Portal to review the case and take appropriate counseling or scheduling action.',
    ],
  });

  return await sendEmail({
    to: GUIDANCE_ADMIN_EMAIL,
    subject: `📋 [Guidance Referral] ${params.type}: ${params.studentName} (${params.studentId})`,
    html,
    category: 'APPOINTMENT',
  });
}

/**
 * Dispatch email notification to OSAS Admin when a student submits new feedback / service evaluation
 */
export async function sendStudentFeedbackAlertEmail(params: {
  studentName: string;
  studentId: string;
  studentEmail?: string;
  title: string;
  content: string;
}): Promise<{ success: boolean; message?: string }> {
  const html = buildHtmlTemplate({
    preheader: `New Feedback Received: ${params.title}`,
    headerTitle: 'New Student Feedback / Evaluation',
    badgeText: 'Student Feedback',
    badgeColor: 'blue',
    recipientName: 'OSAS Administration',
    introParagraph: `A student has submitted new feedback / service evaluation via the STU-SERVE OSAS portal:`,
    detailsTable: [
      { label: 'Student Name', value: params.studentName, isHighlight: true },
      { label: 'Student ID', value: params.studentId },
      { label: 'Student Email', value: params.studentEmail || 'N/A' },
      { label: 'Subject / Title', value: params.title, isHighlight: true },
      { label: 'Date Submitted', value: new Date().toLocaleString() },
    ],
    contentParagraphs: [
      `<strong>Feedback Content:</strong><br><div style="padding: 12px 16px; background-color: #f8fafc; border-radius: 8px; border-left: 3px solid #3b82f6; margin: 10px 0; color: #1e293b; font-size: 14px; line-height: 1.6;">${params.content}</div>`,
      'You can review and manage all student feedbacks and ratings under the OSAS Feedback Evaluation tab.',
    ],
  });

  return await sendEmail({
    to: ADMIN_EMAIL,
    subject: `💬 [Feedback] ${params.studentName}: "${params.title}"`,
    html,
    category: 'GENERAL',
  });
}

/**
 * Dispatch email notification when a student list file is attached/uploaded for bulk registration
 */
export async function sendStudentListUploadedAlertEmail(params: {
  fileName: string;
  fileSize: string;
  recordCount: number;
  uploadedBy?: string;
  adminEmail?: string;
}): Promise<{ success: boolean; message?: string }> {
  const targetEmail = params.adminEmail || ADMIN_EMAIL;
  if (!targetEmail) {
    return { success: false, message: 'No recipient email configured' };
  }

  const html = buildHtmlTemplate({
    preheader: `Student list file "${params.fileName}" attached/uploaded (${params.recordCount} students).`,
    headerTitle: 'Student List Upload Notification',
    badgeText: 'Batch File Attached',
    badgeColor: 'blue',
    recipientName: params.uploadedBy || 'OSAS Administrator',
    introParagraph: `A student roster document/spreadsheet has been attached and uploaded in the OSAS Student Registration module:`,
    detailsTable: [
      { label: 'File Name', value: params.fileName, isHighlight: true },
      { label: 'File Size', value: params.fileSize },
      { label: 'Parsed Student Records', value: `${params.recordCount} students`, isHighlight: true },
      { label: 'Uploaded By', value: params.uploadedBy || 'Princess Ann T. Ruzol (OSAS Officer)' },
      { label: 'Date & Time', value: new Date().toLocaleString() },
    ],
    contentParagraphs: [
      `The uploaded student list has been processed and staged for account creation and review.`,
    ],
    securityNotice: 'This is an automated administrative notification from the DCC OSAS Management System.',
  });

  return await sendEmail({
    to: targetEmail,
    subject: `📁 [OSAS Registration] Student List Attached: ${params.fileName} (${params.recordCount} students)`,
    html,
    category: 'REGISTRATION',
  });
}


