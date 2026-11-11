# STU-SERVE — Dingalan Community College OSAS Management System

A comprehensive, production-ready Student Affairs & Services management portal featuring Role-Based Access (OSAS Administrator, Student, Guidance Counselor), Emergency Safety Reporting, Academic Scholarships, Dormitory Management, Disciplinary Records & Sanction Slips, Appointments, Automated Email Dispatching, and Live Firebase Firestore Persistence.

---

## 🚀 Running Locally

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes with Node.js)

### Steps
1. **Extract the ZIP file** to your preferred folder on your computer.
2. Open a terminal / command prompt inside the project folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser at `http://localhost:3000`.

---

## 🌐 Deploying to Netlify

### Method 1: Automatic Deployment via GitHub (Recommended)
1. Push this extracted repository to your GitHub account:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of STU-SERVE OSAS System"
   git branch -M main
   git remote add origin https://github.com/your-username/your-repo-name.git
   git push -u origin main
   ```
2. Go to [Netlify](https://app.netlify.com/) and click **Add new site > Import an existing project > GitHub**.
3. Select your repository. Netlify will automatically detect `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Click **Deploy Site**.

### Method 2: Manual Drag & Drop (Netlify Drop)
1. Run local build inside the extracted folder:
   ```bash
   npm install
   npm run build
   ```
2. Go to [Netlify Drop](https://app.netlify.com/drop).
3. Drag and drop the generated **`dist`** folder into the upload area.

---

## ⚙️ Environment Variables (Optional)
If you want to configure custom SMTP for email notifications (e.g. appointment approvals, disciplinary notices, scholarship confirmations), add these environment variables in Netlify (**Site settings > Environment variables**) or in your `.env` file:

- `SMTP_HOST` (e.g. `smtp.gmail.com`)
- `SMTP_PORT` (e.g. `587`)
- `SMTP_USER` (your email address)
- `SMTP_PASS` (your Google App Password)
- `SENDER_NAME` ("Dingalan Community College - OSAS")
- `RESEND_API_KEY` (optional fallback)
- `BREVO_API_KEY` (optional fallback)

---

## 📁 Key File Structure
- `src/` — React 19 SPA source code (Components, Admin Modules, Student Modules, Guidance Modules, Modals, Services)
- `public/` — Static assets (College Logo, Manifest, PWA icons, `_redirects`)
- `netlify/` — Serverless backend functions (`netlify/functions/send-email.ts`)
- `firebase-applet-config.json` — Live Firebase credentials & Firestore configuration
- `netlify.toml` — Netlify build and routing definitions
- `package.json` — Node.js package manifests and build scripts
