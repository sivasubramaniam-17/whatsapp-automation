# Deployment guide

Three parts to ship:
1. **Backend + Web dashboard** (one Next.js app) → **Vercel**
2. **WhatsApp webhook** → point Meta at the new URL
3. **Flutter app** → web hosting and/or the app stores

Your database (**Neon**) is already cloud-hosted, so nothing to move there.

---

## 1. Backend + Web dashboard → Vercel

### a. Push the repo to GitHub
```bash
cd /Users/siva/Documents/Siva/automation
git init
git add .
git commit -m "WhatsApp automation SaaS"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/whatsapp-automation.git
git branch -M main
git push -u origin main
```
> `.gitignore` already excludes `.env`, `node_modules`, `.next`, and Flutter build
> output, so no secrets are pushed.

### b. Import into Vercel
1. Go to **vercel.com** → **Add New… → Project** → import the GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Root directory: repo root.
3. Before deploying, add **Environment Variables** (Settings → Environment Variables):

| Name | Value |
|---|---|
| `DATABASE_URL` | your Neon **pooled** URL (the `-pooler` host) — best for serverless |
| `DIRECT_URL` | your Neon **direct** URL (no `-pooler`) — used by migrations |
| `JWT_SECRET` | a long random string (`openssl rand -base64 48`) |
| `WHATSAPP_API_BASE_URL` | `https://graph.facebook.com/v21.0` |
| `WHATSAPP_ACCESS_TOKEN` | your **permanent** System User token (not the 24h one) |
| `WHATSAPP_PHONE_NUMBER_ID` | your number id |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | your verify token |
| `WHATSAPP_APP_SECRET` | your Meta app secret |

> In production use the **pooled** `DATABASE_URL` (serverless opens many
> connections). The local-dev sandbox forced us onto the direct URL, but Vercel
> should use the pooler.

4. Click **Deploy**. The build runs `prisma generate && prisma migrate deploy &&
   next build`, so your schema is auto-applied to Neon on deploy.

Your app is now live at `https://<project>.vercel.app` — both the dashboard
(`/`) and the API (`/api/*`).

---

## 2. Point the WhatsApp webhook at production

1. Meta dashboard → WhatsApp → Configuration → Webhook → **Edit**:
   - **Callback URL:** `https://<project>.vercel.app/api/whatsapp/webhook`
   - **Verify token:** same `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - **Verify and save**, then subscribe to the **messages** field.
2. **Publish the app** (Meta dashboard → top toggle) so real customer messages
   are delivered (unpublished apps only get test webhooks).
3. Generate a **permanent System User token** (Business Settings → Users →
   System users → Generate token with `whatsapp_business_messaging` +
   `whatsapp_business_management`) and set it as `WHATSAPP_ACCESS_TOKEN` in Vercel.

No more cloudflared tunnel needed — Vercel is a stable public URL.

---

## 3. Flutter app

### Option A — Flutter Web (fastest)
```bash
cd mobile
flutter build web --dart-define=API_BASE_URL=https://<project>.vercel.app
```
Deploy the `build/web/` folder to any static host (Vercel, Netlify, Firebase
Hosting, Cloudflare Pages). On Vercel: new project, root `mobile/build/web`,
framework "Other".

### Option B — Native iOS / Android (app stores)
Needs the platform toolchains on your Mac:
- **Android:** install Android Studio → `cd mobile && flutter create --platforms=android .`
  → `flutter build appbundle --dart-define=API_BASE_URL=https://<project>.vercel.app`
  → upload the `.aab` to Google Play Console.
- **iOS:** install Xcode → `flutter create --platforms=ios .`
  → `flutter build ipa --dart-define=API_BASE_URL=https://<project>.vercel.app`
  → upload via Xcode/Transporter to App Store Connect.

Set `API_BASE_URL` to your Vercel URL so the app talks to production.

---

## Production notes / next hardening

- **Broadcasts & serverless timeouts:** the current sender runs in-process
  (`/api/campaigns/[id]/send`, `maxDuration = 300`). Vercel Hobby caps function
  duration (~60s); large broadcasts need **Vercel Pro** or, better, move sending
  to a **background queue** (BullMQ + Upstash Redis, or Vercel Cron + batching).
  The `CampaignRecipient` rows already model a durable queue for this.
- **Rotate secrets** that appeared in dev (Neon password, app secret).
- **Custom domain:** add one in Vercel → update the webhook URL + Flutter
  `API_BASE_URL` to match.
- **Backups / plan:** Neon has branching + PITR; enable what your plan offers.
