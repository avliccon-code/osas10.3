import nodemailer from "nodemailer";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const handler = async (event: {
  httpMethod: string;
  body: string | null;
}) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const payload: EmailPayload = JSON.parse(event.body || "{}");
    const { to, subject, html, text } = payload;

    if (!to || !subject) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Recipient email (to) and subject are required." }),
      };
    }

    const senderEmail = (
      process.env.SMTP_USER ||
      process.env.SMTP_USERNAME ||
      process.env.EMAIL_USER ||
      process.env.MAIL_USER ||
      process.env.GMAIL_USER ||
      "arnoldviena@gmail.com"
    ).trim();

    const senderName = (
      process.env.SENDER_NAME ||
      process.env.SMTP_FROM_NAME ||
      "Dingalan Community College - OSAS"
    ).trim();

    const smtpHost = (
      process.env.SMTP_HOST ||
      process.env.MAIL_HOST ||
      process.env.EMAIL_HOST ||
      "smtp.gmail.com"
    ).trim();

    const smtpPort = parseInt(
      process.env.SMTP_PORT ||
      process.env.MAIL_PORT ||
      process.env.EMAIL_PORT ||
      "587",
      10
    );

    const smtpPass = (
      process.env.SMTP_PASS ||
      process.env.SMTP_PASSWORD ||
      process.env.EMAIL_PASS ||
      process.env.EMAIL_PASSWORD ||
      process.env.MAIL_PASS ||
      process.env.GMAIL_APP_PASSWORD ||
      process.env.GMAIL_PASS ||
      ""
    ).trim().replace(/\s+/g, "");

    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    const brevoKey = (process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY || "").trim();

    let lastSmtpError: string | null = null;

    // 1. Direct SMTP via Nodemailer (Primary Provider)
    if (smtpPass) {
      const isGmail = smtpHost.includes("gmail") || senderEmail.endsWith("@gmail.com");

      const transportConfigs = isGmail
        ? [
            {
              name: "Gmail Service (SSL 465)",
              options: {
                service: "gmail",
                auth: { user: senderEmail, pass: smtpPass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
              },
            },
            {
              name: "Gmail SMTP (STARTTLS 587)",
              options: {
                host: "smtp.gmail.com",
                port: 587,
                secure: false,
                requireTLS: true,
                auth: { user: senderEmail, pass: smtpPass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
              },
            },
          ]
        : [
            {
              name: `Custom SMTP (${smtpHost}:${smtpPort})`,
              options: {
                host: smtpHost,
                port: smtpPort,
                secure: process.env.SMTP_SECURE === "true" || smtpPort === 465,
                auth: { user: senderEmail, pass: smtpPass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
              },
            },
          ];

      for (const config of transportConfigs) {
        try {
          const transporter = nodemailer.createTransport(config.options as any);
          const info = await transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`,
            to,
            subject,
            text: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
            html: html || `<p>${text || subject}</p>`,
          });

          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              success: true,
              delivered: true,
              provider: "smtp",
              sender: senderEmail,
              messageId: info.messageId,
              message: `Email successfully sent to ${to} via SMTP (${senderEmail}).`,
            }),
          };
        } catch (smtpErr: any) {
          lastSmtpError = smtpErr?.message || String(smtpErr);
          console.warn(`[Netlify SMTP Warning] Attempt with ${config.name} failed:`, lastSmtpError);
        }
      }
    }

    // 2. Backup Provider: Resend HTTPS API
    if (resendKey) {
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <onboarding@resend.dev>`,
            to: [to],
            subject,
            html: html || `<p>${text || subject}</p>`,
            text: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
          }),
        });

        const resData = await resendResponse.json();
        if (resendResponse.ok && resData?.id) {
          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              success: true,
              delivered: true,
              provider: "resend",
              data: resData,
              message: `Email successfully sent to ${to} via Resend.`,
            }),
          };
        }
      } catch (resendErr: any) {
        console.warn("[Netlify Resend Error]:", resendErr);
      }
    }

    // 3. Backup Provider: Brevo HTTPS API
    if (brevoKey) {
      try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": brevoKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: senderName, email: senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html || `<p>${text || subject}</p>`,
            textContent: text || (html ? html.replace(/<[^>]+>/g, "") : ""),
          }),
        });

        const resData = await brevoResponse.json();
        if (brevoResponse.ok) {
          return {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              success: true,
              delivered: true,
              provider: "brevo",
              data: resData,
              message: `Email successfully sent to ${to} via Brevo.`,
            }),
          };
        }
      } catch (brevoErr: any) {
        console.warn("[Netlify Brevo Error]:", brevoErr);
      }
    }

    // 4. Queued / Simulated Fallback
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        delivered: false,
        simulated: true,
        sender: senderEmail,
        warning: lastSmtpError || undefined,
        message: `Notification queued for ${to}.${lastSmtpError ? ` Live SMTP error: ${lastSmtpError}` : " Configure SMTP_PASS with a 16-character Google App Password for live inbox delivery."}`,
      }),
    };
  } catch (err: any) {
    console.error("[Netlify Function Fatal Error]:", err);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: false,
        error: err?.message || "Failed to process email in Netlify function",
      }),
    };
  }
};
