# 🆓 CodeSync — Free Deployment Guide

Deploy CodeSync for **$0/month** using free tiers.

---

## Recommended Free Stack

| Service | Provider | Free Tier |
|---------|----------|-----------|
| **Frontend** | [Vercel](https://vercel.com) | Unlimited for hobby |
| **Backend** | [Render](https://render.com) | 750 hrs/month web service |
| **Database** | [Supabase](https://supabase.com) | 500MB PostgreSQL |
| **Redis** | [Upstash](https://upstash.com) | 10K commands/day |

---

## Step 1: Setup Supabase (PostgreSQL)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region, set a database password
3. Once created, go to **Settings → Database → Connection string → URI**
4. Copy it — looks like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

---

## Step 2: Setup Upstash (Redis)

1. Go to [upstash.com](https://upstash.com) → Create Database
2. Choose **Global**, select a region
3. Copy the **Redis URL** — looks like: `rediss://default:[password]@[host]:6379`

---

## Step 3: Deploy Backend on Render

1. Go to [render.com](https://render.com) → New → **Web Service**
2. Connect your GitHub repo → select `codesync`
3. Configure:
   - **Name**: `codesync-api`
   - **Root Directory**: `server`
   - **Build Command**: `npm ci && npx prisma generate --schema=src/prisma/schema.prisma && npm run build`
   - **Start Command**: `npx prisma db push --schema=src/prisma/schema.prisma --skip-generate && node dist/index.js`
   - **Instance Type**: Free
4. Add **Environment Variables**:
   ```
   DATABASE_URL       = (paste Supabase connection string)
   REDIS_URL          = (paste Upstash Redis URL)
   JWT_SECRET         = (run: openssl rand -hex 32)
   SERVER_PORT        = 4000
   SERVER_URL         = https://codesync-api.onrender.com
   CLIENT_URL         = https://codesync.vercel.app
   NODE_ENV           = production
   GITHUB_CLIENT_ID   = (your GitHub OAuth client ID)
   GITHUB_CLIENT_SECRET = (your GitHub OAuth secret)
   ```
5. Click **Create Web Service**

> ⚠️ Render free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s.

---

## Step 4: Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → Add New → **Project**
2. Import your `codesync` GitHub repo
3. Configure:
   - **Framework**: Next.js
   - **Root Directory**: `client`
4. Add **Environment Variable**:
   ```
   NEXT_PUBLIC_API_URL = https://codesync-api.onrender.com
   ```
5. Click **Deploy**

Your frontend will be at `https://codesync.vercel.app` (or your custom domain).

---

## Step 5: GitHub OAuth (Production)

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Edit your OAuth App:
   - **Homepage URL**: `https://codesync.vercel.app`
   - **Callback URL**: `https://codesync-api.onrender.com/api/auth/github/callback`

---

## Step 6: Verify

- [ ] Visit `https://codesync.vercel.app` — landing page loads
- [ ] Sign up → dashboard loads
- [ ] Create room → editor works
- [ ] Run code → terminal shows output
- [ ] GitHub login → OAuth redirects correctly

---

## Free Tier Limitations

| Provider | Limitation | Workaround |
|----------|-----------|------------|
| **Render** | Sleeps after 15 min idle, 750 hrs/month | Use [cron-job.org](https://cron-job.org) to ping every 14 min |
| **Supabase** | 500MB storage, pauses after 1 week inactive | Log in monthly to keep active |
| **Upstash** | 10K commands/day | Sufficient for dev/demo use |
| **Vercel** | 100GB bandwidth/month | More than enough for a SaaS |

---

## Upgrade Path

When you outgrow free tiers:

| Scale | Solution | Cost |
|-------|----------|------|
| **MVP** | Keep current free stack | $0/month |
| **100 users** | Render Starter ($7) + Supabase Pro ($25) | ~$32/month |
| **1000+ users** | VPS (Hetzner $5) + Docker Compose | ~$5/month |
| **Production** | AWS/GCP + managed DB + CDN | ~$50+/month |
