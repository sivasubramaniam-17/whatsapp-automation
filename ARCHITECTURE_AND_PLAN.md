# WhatsApp Automation SaaS — Architecture & Plan

A multi-tenant WhatsApp automation platform sold to companies across sectors
(real estate, agencies, etc.). Delivered as a **web app (Next.js)** and a
**mobile app (Flutter)** sharing **one backend**.

---

## 1. Guiding Decisions

### 1.1 WhatsApp integration — Official Cloud API ("free + safe")
We use **Meta's WhatsApp Business Cloud API**. This is the only route that is
both **safe** (won't get client numbers banned) and **effectively free** for the
core features.

| Message type | Who starts it | Cost |
|---|---|---|
| **Service** (customer messages first, reply within 24h window) | Customer | **Free, unlimited** → powers chatbot + inbox |
| **Utility** template (order updates, reminders) | Business | Small per-message fee |
| **Marketing** template (promos, broadcasts) | Business | Per-message fee (Meta-approved templates) |
| **Authentication** template (OTP) | Business | Per-message fee |

**Key point:** marketing broadcast fees are a **passthrough cost billed to the
client**, not to us. Our chatbot, auto-replies, and shared inbox run on free
service conversations.

**Rejected:** whatsapp-web.js / Baileys / Selenium. Free but violates WhatsApp
ToS → client numbers get banned → destroys a paid product. Not used.

### 1.2 "One project" reality
Next.js and Flutter are different stacks and cannot be a single codebase. The
correct design is **one product, one shared backend, two clients**:

```
   Next.js (web dashboard) ─┐
                            ├─▶  Shared Backend API ──▶ WhatsApp Cloud API
   Flutter (mobile app)  ───┘         (multi-tenant)  ◀── Meta Webhooks
```

Both clients call the **same REST/GraphQL API**. All the real value lives in the
backend.

### 1.3 Multi-tenancy from day one
Each customer company = one **tenant**. Every row of data (contacts, messages,
campaigns) is scoped by `tenant_id`. This is what lets us sell the same product
to real estate firms and agencies simultaneously with isolated data.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript + Tailwind** | Dashboard, SSR, fast |
| Mobile app | **Flutter (Dart)** | One codebase for iOS + Android |
| Backend API | **Node.js + NestJS** (or Next.js API routes to start) | Structured, scalable, TS end-to-end |
| Database | **PostgreSQL** (Supabase or Neon free tier) | Relational, multi-tenant, row-level security |
| ORM | **Prisma** | Type-safe schema + migrations |
| Auth | **JWT + refresh tokens** (or Supabase Auth / Clerk) | Works for web + mobile |
| Queue / jobs | **BullMQ + Redis** | Broadcast batching, rate limits, retries |
| Realtime (inbox) | **WebSockets / Pusher / Supabase Realtime** | Live incoming messages |
| File storage | **S3 / Supabase Storage** | Media (images, PDFs) |
| Hosting | Vercel (web) + Render/Railway/Fly (backend) + managed Postgres/Redis | Free tiers to start |

---

## 3. High-Level Architecture

```
┌───────────────┐     ┌───────────────┐
│  Next.js Web  │     │ Flutter Mobile│
└───────┬───────┘     └───────┬───────┘
        │  HTTPS (REST/GraphQL + WebSocket)
        └──────────┬──────────┘
                   ▼
        ┌────────────────────────┐
        │   Backend API (NestJS) │
        │  ┌──────────────────┐  │
        │  │ Auth & Tenants   │  │
        │  │ Contacts / CRM   │  │
        │  │ Campaigns        │  │
        │  │ Chatbot engine   │  │
        │  │ Inbox / messages │  │
        │  │ Webhook handler  │  │
        │  └──────────────────┘  │
        └───┬───────────┬────────┘
            │           │
     ┌──────▼────┐  ┌───▼─────┐    ┌──────────────┐
     │ Postgres  │  │  Redis  │◀──▶│ BullMQ workers│
     └───────────┘  └─────────┘    │ (broadcasts) │
            ▲                       └──────┬───────┘
            │                              │
            │        ┌─────────────────────▼──────┐
   Incoming │        │   WhatsApp Cloud API (Meta) │
   webhooks └────────┤   send + receive messages   │
                     └─────────────────────────────┘
```

**Two flows:**
- **Outbound:** client triggers broadcast/reply → API → BullMQ worker (respects
  rate limits) → Cloud API → WhatsApp user.
- **Inbound:** WhatsApp user messages → Meta webhook → backend → chatbot engine
  decides auto-reply OR routes to shared inbox → pushed live to web/mobile.

---

## 4. Core Features (v1)

All four selected features are in v1:

### 4.1 Contacts & CRM
- Import contacts (CSV / manual), tags, segments, custom fields.
- Per-tenant lead pipeline (New → Contacted → Qualified → Won/Lost).
- Opt-in / opt-out tracking (required for compliance).

### 4.2 Chatbot / auto-replies
- Visual flow builder (keyword triggers → responses → buttons).
- Business-hours auto-reply, welcome message, lead-qualification questions.
- Handoff to human (moves conversation into shared inbox).
- Runs on **free** service conversations.

### 4.3 Bulk broadcast / campaigns
- Select segment → pick approved template → schedule/send.
- Worker queue batches sends, respects Meta rate limits & messaging tiers.
- Delivery/read status tracking per recipient.
- Billing/usage counter (marketing messages are billable to the client).

### 4.4 Shared team inbox
- All conversations for a tenant in one place.
- Multiple agents, assignment, internal notes, canned responses.
- Realtime updates via WebSocket.
- Respects the 24-hour service window (warns when a template is required).

---

## 5. Data Model (core tables, all scoped by tenant_id)

```
tenants        (id, name, plan, waba_id, phone_number_id, ...)
users          (id, tenant_id, email, role[owner|admin|agent], ...)
contacts       (id, tenant_id, wa_phone, name, tags[], stage, opt_in, ...)
conversations  (id, tenant_id, contact_id, assigned_user_id, status,
                last_message_at, window_expires_at)
messages       (id, tenant_id, conversation_id, direction[in|out],
                type, content, template_name, status, wa_message_id, ...)
campaigns      (id, tenant_id, name, template_name, segment, status,
                scheduled_at, sent/delivered/read counts)
chatbot_flows  (id, tenant_id, name, trigger, steps_json, active)
templates      (id, tenant_id, name, category, status[approved|pending], body)
```

Multi-tenant isolation enforced at the query layer (and DB row-level security
if using Supabase/Postgres RLS).

---

## 6. WhatsApp / Meta Onboarding Requirements

To go live each client needs (we build the wizard to guide them):
1. A **Meta Business Manager** account.
2. A **WhatsApp Business Account (WABA)**.
3. A **phone number** not currently on a personal WhatsApp app.
4. **Business verification** (for higher sending tiers).
5. **Message templates** submitted to Meta for approval (marketing/utility).

We register as a **Meta Tech Provider** so clients can onboard via **Embedded
Signup** (they connect their own WABA through our dashboard in a few clicks).

---

## 7. Compliance (do not skip — protects the business)
- **Opt-in required** before marketing messages; store proof + timestamp.
- Honor **opt-out / STOP** automatically.
- Respect the **24-hour service window** (outside it, only templates allowed).
- Per-tenant data isolation + privacy policy.
- Don't buy/scrape contact lists → gets WABA banned.

---

## 8. Roadmap / Phases

**Phase 0 — Foundations (backend first)**
- Repo structure (monorepo: `/backend`, `/web`, `/mobile`).
- Auth, tenants, users, roles.
- Cloud API sandbox connection + webhook receiver.

**Phase 1 — Messaging core**
- Send/receive messages, conversation model, 24h window logic.
- Shared inbox (web) with realtime.

**Phase 2 — Contacts & CRM**
- Import, tags, segments, pipeline.

**Phase 3 — Broadcasts**
- Templates, campaign builder, queue workers, delivery tracking, usage/billing.

**Phase 4 — Chatbot**
- Flow builder, triggers, human handoff.

**Phase 5 — Mobile app (Flutter)**
- Inbox, notifications, quick send against the same API.

**Phase 6 — Go-to-market**
- Embedded signup, plans/pricing, per-vertical templates (real estate, agencies).

---

## 9. Monetization
- **Subscription tiers** (Starter / Pro / Business) by agents, contacts, features.
- **Message usage** passthrough + margin on marketing broadcasts.
- **Per-vertical template packs** as an upsell (real estate listings, agency
  follow-ups, etc.).

---

## 10. Repo Structure (proposed monorepo)

```
automation/
├── backend/          # NestJS API + workers + Prisma
│   ├── src/
│   ├── prisma/
│   └── ...
├── web/              # Next.js dashboard
├── mobile/           # Flutter app
├── packages/
│   └── shared-types/ # shared TS types / API contracts
└── ARCHITECTURE_AND_PLAN.md
```

---

## Next step
Recommended: scaffold **Phase 0** — the backend (auth + tenants + Cloud API
sandbox + webhook). Everything else builds on it.
