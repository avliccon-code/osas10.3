import dotenv from "dotenv";
import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";

// Load environment variables from .env and .env.example fallback
dotenv.config();
if (fs.existsSync(".env.example") && !process.env.SMTP_PASS) {
  dotenv.config({ path: ".env.example" });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // File persistence for central database
  const DATA_DIR = path.join(process.cwd(), "data");
  const DB_FILE = path.join(DATA_DIR, "db.json");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Memory cache of DB
  let dbStore: Record<string, any> = {};
  let lastUpdated = Date.now();

  const loadDbFromDisk = () => {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8").trim();
        if (raw) {
          dbStore = JSON.parse(raw);
        } else {
          dbStore = {};
          fs.writeFileSync(DB_FILE, JSON.stringify(dbStore, null, 2), "utf-8");
        }
      } catch (err) {
        console.warn("db.json was invalid or corrupt, resetting to empty store:", err);
        dbStore = {};
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(dbStore, null, 2), "utf-8");
        } catch (writeErr) {
          console.error("Error writing fallback db.json", writeErr);
        }
      }
    } else {
      dbStore = {};
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(dbStore, null, 2), "utf-8");
      } catch (writeErr) {
        console.error("Error creating initial db.json", writeErr);
      }
    }
  };

  loadDbFromDisk();

  const saveDbToDisk = () => {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(dbStore, null, 2), "utf-8");
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error("Error writing db.json", err);
    }
  };

  // API Route: Send Email via SMTP
  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, text } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: "Recipient email (to) and subject are required." });
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

    try {
      // 1. Direct Gmail / Custom SMTP (Primary provider when SMTP_PASS is configured)
      if (smtpPass) {
        const isGmail = smtpHost.includes("gmail") || senderEmail.endsWith("@gmail.com");

        // Primary configuration attempt
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

            console.log(`[SMTP Direct] Live email dispatched to ${to} via ${config.name} (MessageID: ${info.messageId})`);
            return res.json({
              success: true,
              delivered: true,
              provider: "smtp",
              sender: senderEmail,
              messageId: info.messageId,
              message: `Email successfully sent to ${to} via SMTP (${senderEmail}).`,
            });
          } catch (smtpErr: any) {
            lastSmtpError = smtpErr?.message || String(smtpErr);
            console.warn(`[SMTP Warning] Attempt with ${config.name} failed (${lastSmtpError}).`);
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
            console.log(`[Resend API] Live email dispatched to ${to} (ID: ${resData.id})`);
            return res.json({
              success: true,
              delivered: true,
              provider: "resend",
              data: resData,
              message: `Email successfully sent to ${to} via Resend.`,
            });
          } else {
            console.warn("[Resend Warning] Resend API error:", resData);
          }
        } catch (resendErr: any) {
          console.warn("[Resend Error]", resendErr);
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
            console.log(`[Brevo API] Live email dispatched to ${to}`);
            return res.json({
              success: true,
              delivered: true,
              provider: "brevo",
              data: resData,
              message: `Email successfully sent to ${to} via Brevo.`,
            });
          } else {
            console.warn("[Brevo Warning] Brevo API error:", resData);
          }
        } catch (brevoErr: any) {
          console.warn("[Brevo Error]", brevoErr);
        }
      }

      // Fallback: Simulation and In-App Logging when credentials are not configured or failed
      const failureReason = lastSmtpError ? ` (Last SMTP error: ${lastSmtpError})` : "";
      console.log(`[SMTP Queue] Notification queued for ${to} from ${senderEmail}: "${subject}"${failureReason}`);
      return res.json({
        success: true,
        delivered: false,
        simulated: true,
        sender: senderEmail,
        warning: lastSmtpError || undefined,
        message: `Notification queued for ${to}.${lastSmtpError ? ` Live SMTP dispatch encountered: ${lastSmtpError}` : " Configure SMTP_PASS with a 16-character Google App Password for live inbox delivery."}`,
      });
    } catch (err: any) {
      console.error("[SMTP Fatal Error]:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to dispatch email",
        sender: senderEmail,
      });
    }
  });

  // API Route: Serves mobile APK with exact binary package MIME type
  app.get(["/stu-serve-mobile.apk", "/dcc-osas-mobile.apk"], (req, res) => {
    let apkPath = path.join(process.cwd(), "public", "stu-serve-mobile.apk");
    if (!fs.existsSync(apkPath)) {
      apkPath = path.join(process.cwd(), "public", "dcc-osas-mobile.apk");
    }
    if (fs.existsSync(apkPath)) {
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", 'attachment; filename="STU-SERVE-Mobile-v2.1.0.apk"');
      return res.sendFile(apkPath);
    } else {
      return res.status(404).send("APK File not found");
    }
  });

  const mergeArrays = (existing: any[], incoming: any[]): any[] => {
    if (!Array.isArray(existing)) return incoming;
    if (!Array.isArray(incoming)) return existing;
    const map = new Map<string, any>();
    existing.forEach((item) => {
      if (item && typeof item === 'object' && item.id) {
        map.set(String(item.id), item);
      }
    });
    incoming.forEach((item) => {
      if (item && typeof item === 'object' && item.id) {
        const id = String(item.id);
        const ex = map.get(id);
        if (!ex) {
          map.set(id, item);
        } else {
          const incomingTime = item.updatedAt || 0;
          const exTime = ex.updatedAt || 0;
          if (incomingTime > exTime) {
            map.set(id, item);
          } else if (incomingTime === exTime) {
            const incomingPwdTime = item.passwordUpdatedAt ? new Date(item.passwordUpdatedAt).getTime() : 0;
            const exPwdTime = ex.passwordUpdatedAt ? new Date(ex.passwordUpdatedAt).getTime() : 0;
            if (incomingPwdTime >= exPwdTime) {
              map.set(id, item);
            }
          }
        }
      }
    });
    return Array.from(map.values());
  };

  // API Route: Get Centralized Database
  app.get("/api/db", (req, res) => {
    res.json({
      success: true,
      lastUpdated,
      data: dbStore,
    });
  });

  // API Route: Poll Centralized Database for updates since timestamp
  app.get("/api/db/poll", (req, res) => {
    const since = parseInt((req.query.since as string) || "0", 10);
    if (lastUpdated > since) {
      return res.json({
        updated: true,
        lastUpdated,
        data: dbStore,
      });
    }
    return res.json({
      updated: false,
      lastUpdated,
    });
  });

  // API Route: Sync/Update Centralized Database
  app.post("/api/db/sync", (req, res) => {
    let { key, value, fullSync } = req.body;

    if (fullSync && typeof fullSync === "object") {
      Object.keys(fullSync).forEach((k) => {
        if (k === "osas_current_user") return;
        dbStore[k] = fullSync[k];
      });
    } else if (key && key !== "osas_current_user") {
      dbStore[key] = value;
    }

    lastUpdated = Date.now();
    saveDbToDisk();

    return res.json({
      success: true,
      lastUpdated,
      data: dbStore,
    });
  });

  // API Route: Reset Centralized Database (Complete Data Reset)
  app.post("/api/db/reset", (req, res) => {
    dbStore = {
      osas_users: [
        {
          id: 'admin-1',
          fullName: 'Princess Ann T. Ruzol',
          email: 'arnoldviena@gmail.com',
          role: 'ADMIN',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
          createdAt: '2024-01-01',
        },
        {
          id: 'guidance-admin-1',
          fullName: 'Maria Mel B. Glemao',
          email: 'avliccon04@gmail.com',
          role: 'GUIDANCE_ADMIN',
          avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
          createdAt: '2024-01-01',
        },
      ],
      osas_announcements: [],
      osas_safety_reports: [],
      osas_scholarships: [],
      osas_scholarship_apps: [],
      osas_appointments: [],
      osas_disciplinary: [],
      osas_disciplinary_reports: [],
      osas_interventions: [],
      osas_dorm_rooms: [],
      osas_dorm_applicants: [],
      osas_dorm_reports: [],
      osas_feedbacks: [],
      osas_activity_logs: [],
      osas_notifications: [],
      osas_archive: [],
      osas_purged_ids: [],
      osas_restored_ids: [],
      osas_transaction_ratings: [],
      osas_evaluations: [],
      osas_email_logs: [],
      osas_password_reset_otps: [],
    };
    lastUpdated = Date.now();
    saveDbToDisk();
    return res.json({ success: true, message: 'Database reset successfully to empty state.' });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`DCC OSAS Centralized Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
