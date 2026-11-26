# Free-Tier Production Deployment Guide

This guide walks through deploying TestPilot to production using **100% free-tier cloud services** with automatic SSL certificates, custom domain support, and zero upfront infrastructure cost.

---

## Architecture Mapping

| Component | Recommended Free Provider | Config File |
|---|---|---|
| **Web Frontend** (`@testpilot/web`) | Vercel (Hobby Plan) | [`apps/web/vercel.json`](../apps/web/vercel.json) |
| **Backend API** (`@testpilot/api`) | Render (Free Docker Web Service) or Fly.io | [`render.yaml`](../render.yaml), [`fly.api.toml`](../fly.api.toml) |
| **PostgreSQL + Storage** | Supabase (Free Tier) | `.env.production.example` |
| **Redis (BullMQ)** | Upstash (Free Serverless Redis) | `REDIS_URL=rediss://...` |
| **Authentication** | Clerk (Free Tier) | Clerk Dashboard |
| **Container Images** | GitHub Container Registry (`ghcr.io`) | [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml) |

---

## Step 1: Provision Free Managed Services

### 1.1 Supabase (PostgreSQL + Artifact Storage)
1. Create a free project at [supabase.com](https://supabase.com).
2. In **Project Settings → Database**, copy:
   - **Transaction Pooler URI** (port `6543`, `?pgbouncer=true`) → set as `DATABASE_URL`.
   - **Direct Connection URI** (port `5432`) → set as `DIRECT_URL`.
3. In **Storage**, create a private bucket named `testpilot-artifacts`.
4. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from **Project Settings → API**.

### 1.2 Upstash (Serverless Redis)
1. Create a free Redis database at [upstash.com](https://upstash.com) (enable TLS).
2. Copy the **`rediss://`** connection URL → set as `REDIS_URL`.
   - TestPilot automatically parses `REDIS_URL` and enables TLS when the scheme is `rediss://`.

### 1.3 Clerk & OpenRouter
1. Create an application at [clerk.com](https://clerk.com) and copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
2. Create an API key at [openrouter.ai](https://openrouter.ai) (`OPENROUTER_API_KEY`) for `:free` models.
3. Generate a 32-byte AES-256-GCM encryption key:
   ```bash
   openssl rand -hex 32
   ```

---

## Step 2: Deploy the Backend API (Render Free Tier)

1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), click **New → Blueprint** and select this repository.
3. Render detects [`render.yaml`](../render.yaml) and builds [`apps/api/Dockerfile`](../apps/api/Dockerfile).
4. Fill in the prompted environment variables (`DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `OPENROUTER_API_KEY`, `APP_BASE_URL`, `CORS_ORIGIN`).
5. Render automatically provisions a `https://<your-api>.onrender.com` URL with TLS/SSL and polls `/api/v1/health`.

> **Alternative — Fly.io:**
> ```bash
> flyctl launch --config fly.api.toml --no-deploy
> flyctl secrets set DATABASE_URL="..." DIRECT_URL="..." REDIS_URL="rediss://..." CREDENTIAL_ENCRYPTION_KEY="..."
> flyctl deploy --config fly.api.toml
> ```

---

## Step 3: Deploy the Web Frontend (Vercel Free Tier)

1. Import the repository at [vercel.com/new](https://vercel.com/new).
2. Set **Root Directory** to `apps/web` (Vercel uses [`apps/web/vercel.json`](../apps/web/vercel.json)).
3. Add Environment Variables:
   - `NEXT_PUBLIC_API_URL=https://<your-api-domain>/api/v1`
   - `INTERNAL_API_URL=https://<your-api-domain>/api/v1`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...`
   - `CLERK_SECRET_KEY=sk_...`
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
4. Deploy! Vercel automatically provisions HTTPS/SSL.
5. Update `CORS_ORIGIN` and `APP_BASE_URL` on your API service to match your Vercel URL.

---

## Step 4: Custom Domain & SSL Setup

1. **Vercel (Web):** Go to **Project Settings → Domains**, add `testpilot.yourdomain.com`, and create the `CNAME` record (`cname.vercel-dns.com`) in your DNS provider. SSL is issued automatically via Let's Encrypt.
2. **Render / Fly.io (API):** Add `api.testpilot.yourdomain.com` under **Custom Domains** and create the `CNAME` record shown by your host. SSL is issued automatically.
3. **GitHub App Webhook:** Set your GitHub App Webhook URL to `https://api.testpilot.yourdomain.com/api/v1/github/webhook` and configure `GITHUB_WEBHOOK_SECRET`.

---

## Step 5: Automated Docker Image Publishing (`ghcr.io`)

Pushing to `main` or tagging `v*` triggers [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml), publishing:
- `ghcr.io/<owner>/testpilot-api:latest`
- `ghcr.io/<owner>/testpilot-web:latest`
