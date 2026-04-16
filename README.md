# 🎯 InternTrack — Gmail-Powered Internship Application Tracker

Automatically scans your Gmail inbox(es) for internship emails, extracts company/role/status using AI, and displays everything in a clean dashboard. Supports multiple Gmail accounts.

---

## What You Need (All Free Except Anthropic API)

- [Node.js](https://nodejs.org) installed on your computer (v18+)
- A [Google Cloud](https://console.cloud.google.com) account (free)
- A [Vercel](https://vercel.com) account (free)
- A [GitHub](https://github.com) account (free)
- An [Anthropic API key](https://console.anthropic.com) (~$1–2/month for scanning)

---

## Step 1 — Get Your Google OAuth Credentials

This lets users sign in with Gmail.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"** → name it `InternTrack` → **Create**
3. In the left sidebar: **APIs & Services → Library**
4. Search for **"Gmail API"** → click it → click **Enable**
5. Go to **APIs & Services → OAuth consent screen**
   - User Type: **External** → Create
   - App name: `InternTrack`
   - User support email: your email
   - Developer contact: your email
   - Click **Save and Continue** through all steps
   - On **Test users** page: click **+ Add Users** → add your Gmail address(es)
   - Click **Save and Continue**
6. Go to **APIs & Services → Credentials**
   - Click **+ Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `InternTrack Web`
   - Authorized redirect URIs — add ALL of these:
     ```
     http://localhost:3000/api/auth/callback/google
     https://YOUR-APP-NAME.vercel.app/api/auth/callback/google
     ```
     (You'll get the Vercel URL in Step 4 — you can add it later)
   - Click **Create**
7. Copy your **Client ID** and **Client Secret** — you'll need these

---

## Step 2 — Get Your Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)
5. Add a small amount of credit (~$5) — scanning 30 emails costs about $0.05

---

## Step 3 — Set Up the Project Locally

```bash
# 1. Download the project folder to your computer

# 2. Open terminal in the project folder
cd internship-tracker

# 3. Install dependencies
npm install

# 4. Create your environment file
cp .env.example .env.local
```

Now open `.env.local` in any text editor and fill it in:

```env
GOOGLE_CLIENT_ID=paste_your_client_id_here
GOOGLE_CLIENT_SECRET=paste_your_client_secret_here
NEXTAUTH_SECRET=run_this_in_terminal_to_generate_one
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=paste_your_anthropic_key_here
```

**To generate NEXTAUTH_SECRET**, run in terminal:
```bash
openssl rand -base64 32
```
Copy the output and paste it as the value.

**Test it locally:**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) — you should see the dashboard!

---

## Step 4 — Deploy to Vercel (Free Hosting)

### Option A: Deploy via GitHub (Recommended)

1. Create a new repo on [github.com](https://github.com/new)
2. Upload the project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/internship-tracker.git
   git push -u origin main
   ```
3. Go to [vercel.com](https://vercel.com) → **New Project**
4. Import your GitHub repo
5. In **Environment Variables**, add all 5 from your `.env.local`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` → set this to `https://YOUR-APP.vercel.app` (Vercel gives you this URL)
   - `ANTHROPIC_API_KEY`
6. Click **Deploy**

### Option B: Deploy via Vercel CLI
```bash
npm i -g vercel
vercel
# Follow prompts, then add env variables in the Vercel dashboard
```

---

## Step 5 — Add Your Vercel URL to Google Cloud

1. Go back to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services → Credentials → your OAuth client**
3. Under **Authorized redirect URIs**, add:
   ```
   https://YOUR-APP-NAME.vercel.app/api/auth/callback/google
   ```
4. Click **Save**

---

## Using the App

1. Visit your Vercel URL
2. Click **"+ Add Gmail Account"** — sign in with Google
3. Repeat for any other Gmail accounts you want to track
4. Click **"⚡ Scan All Inboxes"** — the AI will scan your emails
5. Applications appear automatically with company, role, status, and link
6. Use the status dropdown to manually update any application
7. Click **"⬇ Export CSV"** to download everything

### How Status Detection Works

The AI reads email subjects and snippets to determine status:
- Confirmation emails → **Applied**
- "We'd like to schedule a call" → **Phone Screen**
- "Interview invitation" → **Interview**
- "Final round" → **Final Round**
- "Offer letter / congratulations" → **Offer Received**
- "Unfortunately / other candidates" → **Rejected**
- "Waitlist / future consideration" → **Waitlisted**

---

## FAQ

**Q: Is my email data stored anywhere?**
A: No. Emails are scanned in real-time and only the extracted data (company, role, status) is saved in your browser's local storage. Nothing is stored on any server.

**Q: How often should I scan?**
A: Once a week is usually enough. Click "Scan All Inboxes" any time you want to check for updates.

**Q: Can I add a non-Gmail account (Outlook, Yahoo)?**
A: Not currently — only Gmail is supported. If you forward emails from other accounts to Gmail, those will be picked up.

**Q: What if an application is detected incorrectly?**
A: Use the status dropdown on any card to manually correct it, or click ✕ to remove it.

---

## Project Structure

```
internship-tracker/
├── pages/
│   ├── index.js              # Main dashboard UI
│   ├── _app.js               # App wrapper
│   └── api/
│       ├── auth/
│       │   └── [...nextauth].js  # Google OAuth handler
│       └── scan.js           # Gmail scan + Claude AI classification
├── styles/
│   └── globals.css           # Global styles
├── .env.example              # Environment variables template
├── next.config.js
├── tailwind.config.js
├── vercel.json
└── package.json
```
