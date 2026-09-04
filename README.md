# WhatsApp Automation SaaS

Multi-tenant WhatsApp automation platform. Built on the **official WhatsApp
Cloud API** (safe for paying clients; free for chatbot/inbox service messages).

- **Backend + Web dashboard:** Next.js (App Router) — this repo root.
- **Mobile app:** Flutter (in `/mobile`, added in Phase 5) — calls the same API.
- See [ARCHITECTURE_AND_PLAN.md](./ARCHITECTURE_AND_PLAN.md) for the full plan.

## Phase 0 (this scaffold)

Auth + multi-tenancy + WhatsApp Cloud API send/receive.

```
app/api/
  auth/register    POST   create company (tenant) + owner user
  auth/login       POST   -> JWT
  auth/me          GET    current user + tenant           (Bearer auth)
  tenant           GET    company + WhatsApp status        (Bearer auth)
  tenant           PATCH  update company / connect WhatsApp(owner|admin)
  whatsapp/send    POST   send text or template message    (Bearer auth)
  whatsapp/webhook GET    Meta verification handshake
  whatsapp/webhook POST   inbound messages + status updates
  health           GET    health check
lib/
  prisma.ts        Prisma client singleton
  auth.ts          JWT (jose) + bcrypt password hashing
  whatsapp.ts      Cloud API client + webhook signature check
  http.ts          response helpers + requireAuth guard
prisma/schema.prisma  Tenant, User, Contact, Conversation, Message
```

## Setup

```bash
# 1. install deps
npm install

# 2. configure env
cp .env.example .env      # then fill in DATABASE_URL, JWT_SECRET, WHATSAPP_*

# 3. create the database schema
npm run prisma:generate
npm run prisma:migrate    # needs a running Postgres from DATABASE_URL

# 4. run
npm run dev               # http://localhost:4000
```

## Quick test (no WhatsApp needed)

```bash
# register a company + owner
curl -X POST http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"Acme Realty","email":"me@acme.com","password":"password123"}'

# -> copy the "token", then:
curl http://localhost:4000/api/auth/me -H "Authorization: Bearer <token>"
```

## Connecting WhatsApp (sandbox)

1. Create an app at [developers.facebook.com](https://developers.facebook.com) →
   add the **WhatsApp** product.
2. Copy the **temporary access token** + **test phone number id** into `.env`
   (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`), or `PATCH /api/tenant`
   to store them per-tenant.
3. Set the **webhook** URL to `https://<your-public-url>/api/whatsapp/webhook`
   and the verify token to `WHATSAPP_WEBHOOK_VERIFY_TOKEN`. Use a tunnel
   (ngrok/cloudflared) for local dev.
4. `POST /api/whatsapp/send` with a template to a test recipient.

## Next phases

CRM → broadcasts (queue) → chatbot flows → Flutter app. See the plan doc.
# whatsapp-automation
