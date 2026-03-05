# 🚀 CodeSync — Deployment Guide

This guide covers deploying CodeSync to production using Docker Compose on a VPS (DigitalOcean, AWS EC2, Hetzner, etc.).

---

## Prerequisites

- A VPS with **2GB+ RAM**, Docker & Docker Compose installed
- A domain name (e.g., `codesync.yourdomain.com`)
- (Optional) GitHub OAuth App for social login

---

## 1. Server Setup

```bash
# SSH into your server
ssh user@your-server-ip

# Install Docker (if not installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in

# Clone the repo
git clone https://github.com/kratikjain10/codesync.git
cd codesync
```

---

## 2. Configure Environment

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```env
# Database — Docker handles this, use the compose internal URL
DATABASE_URL="postgresql://codesync:codesync_secret@postgres:5432/codesync"

# Redis
REDIS_URL="redis://redis:6379"

# JWT — CHANGE THIS to a random 64-char string
JWT_SECRET="generate-a-random-64-char-string-here"

# Server
SERVER_PORT=4000
SERVER_URL="https://api.yourdomain.com"
CLIENT_URL="https://yourdomain.com"

# GitHub OAuth (optional)
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
```

> **Generate a JWT secret:** `openssl rand -hex 32`

---

## 3. Update docker-compose.yml for Production

Edit `docker-compose.yml` — update these environment values:

```yaml
server:
  environment:
    DATABASE_URL: postgresql://codesync:codesync_secret@postgres:5432/codesync
    JWT_SECRET: your-64-char-random-secret
    SERVER_URL: https://api.yourdomain.com
    CLIENT_URL: https://yourdomain.com
    GITHUB_CLIENT_ID: your_id
    GITHUB_CLIENT_SECRET: your_secret

client:
  build:
    args:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com
```

---

## 4. Setup Reverse Proxy (Nginx)

Install Nginx:

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create `/etc/nginx/sites-available/codesync`:

```nginx
# Client (Next.js)
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}

# Server (API + WebSocket)
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and get SSL:

```bash
sudo ln -s /etc/nginx/sites-available/codesync /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL certificates (free via Let's Encrypt)
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

---

## 5. Deploy

```bash
cd ~/codesync

# Build and start everything
docker compose up -d --build

# Check logs
docker compose logs -f
```

---

## 6. GitHub OAuth (Production)

1. Go to **https://github.com/settings/developers**
2. Edit your OAuth App (or create new)
3. Set **Authorization callback URL** to:
   ```
   https://api.yourdomain.com/api/auth/github/callback
   ```
4. Update `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in your env
5. Restart: `docker compose down && docker compose up -d`

---

## 7. Post-Deployment Checklist

- [ ] Visit `https://yourdomain.com` — landing page loads
- [ ] Sign up with email — account creates, redirects to dashboard
- [ ] Sign in with GitHub — OAuth flow works
- [ ] Create a room — editor loads with template files
- [ ] Write and run code — terminal shows output
- [ ] Open room in two tabs — real-time sync works
- [ ] Chat in room — messages appear
- [ ] Format code — Prettier formatting works
- [ ] Check `/admin` — analytics load

---

## Common Commands

```bash
# Start in background
docker compose up -d --build

# View logs
docker compose logs -f server
docker compose logs -f client

# Restart
docker compose down && docker compose up -d

# Rebuild single service
docker compose up -d --build server

# Database access
docker compose exec postgres psql -U codesync

# Cleanup old images
docker system prune -af
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| **Port already in use** | `docker compose down` then retry, or check `lsof -i :4000` |
| **Database connection refused** | Wait for postgres healthcheck, check `docker compose logs postgres` |
| **Execution hangs** | Check Redis is running: `docker compose logs redis` |
| **GitHub OAuth fails** | Verify callback URL matches `SERVER_URL/api/auth/github/callback` |
| **No space on disk** | Run `docker system prune -af --volumes` |
| **SSL not working** | Run `sudo certbot renew` and check nginx config |
