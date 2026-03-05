<div align="center">

# ⚡ CodeSync

### Write code together. In real-time.

A collaborative code editor where teams write, run, and debug code in the same workspace — no setup, no installs, just open a link and start building.

[![CI/CD](https://github.com/KratikJain10/codesync/actions/workflows/ci.yml/badge.svg)](https://github.com/KratikJain10/codesync/actions)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

[Features](#-features) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start) · [Deploy](#-deploy) · [API](#-api-reference)

</div>

---

## 🎯 What is CodeSync?

CodeSync is a **real-time collaborative code editor** built for teams who want to code together without the friction of screen sharing or turn-taking. Think Google Docs, but for code — with a built-in terminal, chat, and support for 10 programming languages.

**Perfect for:**
- 👨‍💻 **Pair Programming** — edit the same file with live cursors
- 🎓 **Coding Interviews** — watch candidates code in real-time
- 📚 **Teaching** — walk students through code with instant feedback
- 🚀 **Hackathons** — spin up a room, share a link, start building

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔄 Real-Time Collaboration
Everyone types at once — changes appear instantly with zero conflicts. Powered by **CRDT** (Conflict-free Replicated Data Types) for mathematically guaranteed consistency.

### ▶️ Multi-Language Execution
Run **JavaScript, Python, C++, Java, Go, Rust** and more in a secure sandbox. Results appear in seconds with stdin support.

### 💬 Built-in Chat
Message your team without leaving the editor. Full message history persists across sessions.

### 📝 Inline Code Comments
Comment on specific lines of code, start discussion threads, and resolve when done.

</td>
<td width="50%">

### 📁 Multi-File Projects
Full file explorer with tabs, drag-and-drop upload, and project export as ZIP. Create files in any language.

### 🎨 Project Templates
Start from **7 templates**: Algorithm Practice, Web App, Python Data Science, TypeScript Starter, Rust Playground, React App, and Interview Prep.

### 🔐 GitHub OAuth
One-click sign in with GitHub. Also supports email/password.

### 🖥️ Live Preview
HTML/CSS/JS projects get an instant split-pane preview that updates as you type.

</td>
</tr>
</table>

**And also:** Command Palette · Dark/Light Theme · Activity Heatmap · Version History · Room Forking · Code Formatting (Prettier) · Member Roles (Owner/Editor/Viewer) · Password-Protected Rooms · Code Snippets Library

---

## 🛠️ Tech Stack

<table>
<tr>
<td align="center" width="33%"><b>Frontend</b></td>
<td align="center" width="33%"><b>Backend</b></td>
<td align="center" width="33%"><b>Infrastructure</b></td>
</tr>
<tr>
<td>

- Next.js 16 (App Router)
- Monaco Editor
- Yjs (CRDT Engine)
- Socket.io Client
- TypeScript

</td>
<td>

- Node.js + Express
- Prisma ORM
- PostgreSQL
- Redis + BullMQ
- Socket.io + Yjs Server

</td>
<td>

- Docker + Compose
- Nginx (reverse proxy)
- GitHub Actions CI/CD
- PM2 (cluster mode)

</td>
</tr>
</table>

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph Client["Client (Next.js)"]
        UI["Monaco Editor"]
        YC["Yjs Client"]
        SC["Socket.io Client"]
    end

    subgraph Server["Server (Express)"]
        API["REST API"]
        WS["Socket.io"]
        YS["Yjs Server"]
        EX["Execution Engine"]
    end

    subgraph Queue["Job Queue"]
        BQ["BullMQ Workers"]
        DK["Docker Sandbox"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL"]
        RD["Redis"]
    end

    UI --> API
    YC <-->|"CRDT Sync"| YS
    SC <-->|"Chat & Cursors"| WS
    API --> PG
    API --> RD
    WS --> RD
    YS --> RD
    EX --> BQ
    BQ --> DK
    BQ --> RD
```

### Real-Time Collaboration Flow

```mermaid
sequenceDiagram
    participant A as User A
    participant Y as Yjs Server
    participant R as Redis
    participant B as User B

    A->>Y: Edit (CRDT update)
    Y->>R: Persist state
    Y->>B: Broadcast update
    B->>Y: Edit (CRDT update)
    Y->>R: Persist state
    Y->>A: Broadcast update
    Note over A,B: All changes merge automatically — zero conflicts
```

### Code Execution Pipeline

```mermaid
graph LR
    A["User clicks Run"] --> B["POST /api/execute"]
    B --> C{"BullMQ Queue"}
    C --> D["Worker picks job"]
    D --> E["Docker Sandbox\n50MB RAM | 0.5 CPU\nNo network | 10s timeout"]
    E --> F["stdout + stderr"]
    F --> G["Poll GET /api/execute/:id"]
    G --> H["Display in terminal"]
```

---

## 🚀 Quick Start

### With Docker (recommended)

```bash
git clone https://github.com/KratikJain10/codesync.git
cd codesync
cp .env.example server/.env    # edit with your secrets
docker compose up --build
```

Open **http://localhost:3000** → Sign up → Create a room → Start coding! 🎉

### Manual Setup

```bash
# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Setup database
cd server
cp ../.env.example .env        # edit DATABASE_URL
npx prisma db push --schema=src/prisma/schema.prisma
npx prisma generate --schema=src/prisma/schema.prisma

# Run (two terminals)
npm run dev                    # Terminal 1: server on :4000
cd ../client && npm run dev    # Terminal 2: client on :3000
```

---

## 🔑 Environment Variables

```env
# Required
DATABASE_URL="postgresql://user:pass@localhost:5432/codesync"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-64-char-secret"        # openssl rand -hex 32

# Server
SERVER_PORT=4000
SERVER_URL="http://localhost:4000"
CLIENT_URL="http://localhost:3000"

# GitHub OAuth (optional)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

---

## 🌐 Deploy

| Guide | Stack | Cost |
|-------|-------|------|
| [**DEPLOYMENT.md**](./DEPLOYMENT.md) | VPS + Docker Compose + Nginx + SSL | ~$5/mo |
| [**DEPLOYMENT_FREE.md**](./DEPLOYMENT_FREE.md) | Vercel + Render + Supabase + Upstash | **$0/mo** |

---

## 📡 API Reference

<details>
<summary><b>Auth</b> — signup, login, OAuth, profile</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register new user |
| `POST` | `/api/auth/login` | Login with email/password |
| `GET` | `/api/auth/me` | Get current user profile |
| `PATCH` | `/api/auth/profile` | Update username/avatar |
| `POST` | `/api/auth/change-password` | Change password |
| `GET` | `/api/auth/activity` | Activity heatmap data |
| `GET` | `/api/auth/github` | Start GitHub OAuth flow |
| `GET` | `/api/auth/github/callback` | OAuth callback handler |
</details>

<details>
<summary><b>Rooms</b> — create, join, fork, manage</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rooms` | List your rooms |
| `POST` | `/api/rooms` | Create room (with template) |
| `GET` | `/api/rooms/:slug` | Get room details |
| `PATCH` | `/api/rooms/:slug` | Update room settings |
| `DELETE` | `/api/rooms/:slug` | Delete room |
| `POST` | `/api/rooms/:slug/join` | Join room |
| `POST` | `/api/rooms/:slug/fork` | Fork a public room |
| `GET` | `/api/rooms/:slug/messages` | Get chat history |
| `GET` | `/api/rooms/:slug/export` | Download as ZIP |
</details>

<details>
<summary><b>Files</b> — create, update, delete</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/rooms/:slug/files` | Create file |
| `PUT` | `/api/rooms/:slug/files/:id` | Update file content |
| `DELETE` | `/api/rooms/:slug/files/:id` | Delete file |
</details>

<details>
<summary><b>Execution</b> — run code in sandbox</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/execute` | Submit code for execution |
| `GET` | `/api/execute/:jobId` | Poll execution result |
| `GET` | `/api/execute/languages` | List supported languages |
</details>

<details>
<summary><b>Other</b> — comments, snippets, formatting, versions</summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/rooms/:slug/files/:id/comments` | Inline comments |
| `PATCH` | `.../comments/:id/resolve` | Resolve comment thread |
| `GET/POST` | `/api/snippets` | Code snippets library |
| `POST` | `/api/format` | Prettier code formatting |
| `GET` | `/api/rooms/:slug/files/:id/versions` | Version history |
| `GET` | `/api/admin/stats` | Admin analytics |
</details>

---

## 🧪 Testing

```bash
cd server && npm test
```

Runs **19 API tests** covering authentication flows and room operations with Jest + Supertest.

---

## 📁 Project Structure

```
codesync/
├── client/                   # Next.js 16 frontend
│   ├── src/app/             # 7 pages (dashboard, room, settings, admin, login, signup, landing)
│   ├── src/components/      # Toast, LivePreview, CommandPalette, MarkdownPreview
│   ├── src/hooks/           # useAuth, useTheme
│   └── src/lib/             # API client with polling support
│
├── server/                   # Express + TypeScript backend
│   ├── src/routes/          # 10 route modules (auth, rooms, files, execution, format...)
│   ├── src/execution/       # BullMQ queue + Docker/local code runner
│   ├── src/services/        # Auth + Room service layer
│   ├── src/socket/          # Socket.io chat & cursor presence
│   ├── src/yjs/             # CRDT WebSocket server
│   └── src/__tests__/       # Jest API tests
│
├── docker-compose.yml        # Postgres + Redis + Server + Client
├── DEPLOYMENT.md             # VPS deployment guide
└── DEPLOYMENT_FREE.md        # Free tier deployment guide
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit (`git commit -m 'feat: add amazing feature'`)
4. Push (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

<div align="center">

## 📝 License

MIT — do whatever you want with it.

Built by [Kratik Jain](https://github.com/KratikJain10)

</div>
