# CouponCode — Secure Coupon Marketplace

A **mobile-optimized, production-ready** coupon marketplace built with **Next.js 16 App Router + TypeScript + Tailwind CSS + Supabase + Razorpay**.

Users browse available discount coupons, pay a small fee to unlock the full coupon code, and receive it securely. The raw coupon code is **never** exposed in public APIs — it is AES-256-GCM encrypted at rest and only decrypted server-side after payment is verified.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Security Architecture](#security-architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup (Supabase Migrations)](#database-setup-supabase-migrations)
- [Local Development](#local-development)
- [Build & Production](#build--production)
- [Running Tests](#running-tests)
- [Razorpay Webhook Configuration](#razorpay-webhook-configuration)
- [Admin Usage](#admin-usage)
- [Deployment Notes](#deployment-notes)
- [Performance & Scalability Notes](#performance--scalability-notes)
- [API Reference](#api-reference)

---

## Features

| Area | Details |
|---|---|
| **Browse** | Responsive card grid with live search + category filters |
| **Coupon modal** | Terms & Conditions list, masked code preview, unlock CTA |
| **Checkout** | Razorpay hosted checkout, auto-loads SDK |
| **Success/Reveal** | Confetti animation, decrypted code display, one-click copy |
| **Dashboard** | User's purchase history with on-demand reveal |
| **Admin** | Protected `/admin` form to add coupons with encrypted storage |
| **Security** | AES-256-GCM encryption, Razorpay webhook HMAC verification, Supabase RLS |
| **Testing** | Jest tests for payment verification, reveal auth, encryption |

---

## Architecture

```
Next.js App Router (TypeScript)
│
├── app/                       # Pages + API routes
│   ├── page.tsx               # Public browse page
│   ├── success/page.tsx       # Payment success + reveal
│   ├── dashboard/page.tsx     # User purchase history
│   ├── admin/page.tsx         # Admin coupon management
│   └── api/
│       ├── coupons/           # GET  – public listing (cached)
│       ├── orders/            # GET  – authenticated user orders
│       ├── payment/
│       │   ├── create-order/  # POST – create Razorpay order
│       │   └── webhook/       # POST – Razorpay webhook (HMAC verified)
│       ├── reveal/            # POST – decrypt code after ownership check
│       └── admin/coupons/     # POST – admin: create coupon
│
├── lib/
│   ├── crypto.server.ts       # AES-256-GCM encrypt/decrypt (server-only)
│   ├── razorpay.server.ts     # Razorpay client + signature verification
│   ├── rate-limit.ts          # Sliding-window in-memory rate limiter
│   └── supabase/              # Browser / server / admin Supabase clients
│
├── repositories/              # Data-access layer (SOLID: single responsibility)
│   ├── coupon.repository.ts
│   └── order.repository.ts
│
├── services/                  # Business logic layer
│   ├── coupon.service.ts
│   ├── order.service.ts
│   └── payment.service.ts
│
├── components/                # UI components
│   ├── ui/                    # Primitives (Button, Badge, Card, Input)
│   ├── coupon-card.tsx
│   ├── coupon-modal.tsx
│   ├── search-filter.tsx
│   ├── copy-button.tsx
│   └── confetti.tsx
│
├── types/index.ts             # Shared TypeScript types
├── migrations/001_initial.sql # Supabase SQL migration
└── __tests__/                 # Jest test suites
```

---

## Security Architecture

### Coupon Code Protection

```
Admin adds coupon
        │
        ▼
  coupon_code (raw)
        │  encryptCode() — AES-256-GCM, random IV
        ▼
  coupon_code_encrypted  ←── stored in DB (never sent to client)
  masked_code            ←── "IXI****" sent to public API
```

### Reveal Flow

```
User clicks "Unlock"
        │
        ▼ POST /api/payment/create-order
  [Auth check] → Create Razorpay order → Store pending order in DB
        │
        ▼ Razorpay Checkout (client-side SDK)
  User pays → Razorpay returns payment result
        │
        ▼ POST /api/payment/webhook (Razorpay server → your server)
  [HMAC signature verified] → Mark order SUCCESS (idempotent) → Mark coupon SOLD
        │
        ▼ POST /api/reveal  (authenticated user)
  [Auth check] → [Order ownership check] → decryptCode() → return plaintext
```

### Key Security Properties

- `coupon_code_encrypted` is **never** selected in any public API query (column-level REVOKE in SQL)
- `ENCRYPTION_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only env vars, never prefixed with `NEXT_PUBLIC_`
- Webhook signature verified with `crypto.timingSafeEqual` before processing
- Webhook handling is **idempotent** — re-delivery of the same event won't double-fulfill
- Supabase RLS policies: public read (safe fields only), users read own orders, admin-only writes
- Rate limiting on sensitive endpoints: `/api/payment/create-order` (10 req/min), `/api/reveal` (20 req/min)

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Razorpay](https://razorpay.com) account (test mode works)

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description | Client-safe? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | ❌ Server-only |
| `ENCRYPTION_KEY` | Secret for AES-256-GCM coupon code encryption | ❌ Server-only |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay key ID (for client SDK) | ✅ Yes |
| `RAZORPAY_KEY_ID` | Razorpay key ID (server) | ❌ Server-only |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret | ❌ Server-only |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret | ❌ Server-only |

**Generate a secure encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Database Setup (Supabase Migrations)

### Option A — Supabase SQL Editor (easiest)

1. Open your Supabase project → **SQL Editor**
2. Paste the contents of [`migrations/001_initial.sql`](migrations/001_initial.sql)
3. Click **Run**

### Option B — Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Push migration
supabase db push
```

### What the migration creates

- **`coupons`** table with encrypted code storage, masked code, status enum
- **`orders`** table with Razorpay order/payment IDs, payment status enum
- **`coupon_reveals_audit`** table for reveal tracking
- **Indexes** for status/category/expiry browsing, trigram search, user order timelines
- **RLS policies**: public read (safe fields), user reads own orders, admin writes
- **Column-level REVOKE** of `coupon_code_encrypted` from `anon` and `authenticated` roles
- **`updated_at` triggers** for automatic timestamp updates

### Setting admin role

To grant admin access, set the user's `app_metadata.role` to `"admin"` via the Supabase Auth dashboard or service role API:

```bash
# Via Supabase service role API
curl -X PATCH "https://your-project.supabase.co/auth/v1/admin/users/<user-id>" \
  -H "apikey: <service-role-key>" \
  -H "Authorization: ******" \
  -H "Content-Type: application/json" \
  -d '{"app_metadata": {"role": "admin"}}'
```

---

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Build & Production

```bash
npm run build
npm start
```

---

## Running Tests

```bash
npm test
```

Test suites cover:
- **`__tests__/crypto.test.ts`** — AES-256-GCM encrypt/decrypt round-trip, IV randomness, tamper detection, `maskCode`
- **`__tests__/payment-reveal.test.ts`** — Razorpay signature verification, reveal authorization (ownership check), payment service idempotency

---

## Razorpay Webhook Configuration

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com) → **Settings → Webhooks**
2. Click **Add New Webhook**
3. Set **Webhook URL**: `https://your-domain.com/api/payment/webhook`
4. Set a **Secret** — copy this to `RAZORPAY_WEBHOOK_SECRET` in your env
5. Enable these events:
   - `payment.captured`
   - `payment.failed`
6. Click **Save**

> The webhook handler verifies the `x-razorpay-signature` HMAC header before processing any event. Duplicate events are handled idempotently.

---

## Admin Usage

1. Sign in with a Supabase account that has `app_metadata.role = "admin"`
2. Navigate to `/admin`
3. Fill in brand, category, title, expiry, price, terms, and the **secret coupon code**
4. Click **Create Coupon** — the code is encrypted with AES-256-GCM before storage

---

## Deployment Notes

### Vercel (recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set all environment variables in **Vercel Dashboard → Project → Settings → Environment Variables**.

### Docker / Self-hosted

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Important deployment checklist

- [ ] All server-only env vars set (no `NEXT_PUBLIC_` for secrets)
- [ ] Supabase migration applied
- [ ] Razorpay webhook URL updated to production domain
- [ ] `RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard setting
- [ ] Supabase RLS enabled and policies applied
- [ ] Column-level revoke on `coupon_code_encrypted` verified

---

## Performance & Scalability Notes

The public coupon listing API (`/api/coupons`) is set to `revalidate = 30` seconds, enabling Next.js ISR-style caching at the edge. For sustained high throughput:

| Layer | Recommendation |
|---|---|
| **CDN** | Deploy behind Vercel Edge / Cloudflare — public browse endpoint is cache-friendly |
| **Database** | Use Supabase connection pooling (PgBouncer) for high concurrency |
| **Read scaling** | Add Supabase read replicas for browse/filter queries |
| **Rate limiting** | Current in-memory limiter works for single-instance; replace with Redis (e.g. Upstash) for multi-instance |
| **Webhook queue** | For very high payment volume, route webhooks through a queue (e.g. BullMQ, Inngest) |
| **Load testing** | Use k6 or Artillery before launch to identify bottlenecks |

> **Note:** True 10K req/s sustained throughput depends on infrastructure sizing (CDN configuration, DB connection pooling, horizontal scaling, load balancers), not application code alone. The code is designed to be stateless and horizontally scalable.

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/coupons` | Public | List coupons with search/category filters |
| `POST` | `/api/payment/create-order` | User | Create Razorpay order for a coupon |
| `POST` | `/api/payment/webhook` | Razorpay HMAC | Payment event handler |
| `POST` | `/api/reveal` | User | Reveal decrypted coupon code after purchase |
| `GET` | `/api/orders` | User | List user's orders |
| `POST` | `/api/admin/coupons` | Admin | Create a new coupon |
