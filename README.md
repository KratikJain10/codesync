# ⚡ CodeSync

> Real-time collaborative code editor — write, run, and debug code together.

CodeSync lets teams code in the same workspace simultaneously. Open a room, share the link, and start building. No downloads, no setup — just open and code.

---

## ✨ What You Can Do

| Feature | Description |
|---------|-------------|
| **Real-Time Editing** | Everyone types at once — changes appear instantly, no conflicts |
| **Code Execution** | Run JavaScript, Python, C++, Java, Go, Rust right in the browser |
| **Built-in Chat** | Message your team without leaving the editor |
| **Inline Comments** | Comment on specific lines, resolve threads |
| **Multi-File Projects** | File explorer, tabs, drag-and-drop upload |
| **Project Templates** | Start from Algorithm Practice, Web App, Python Data Science, etc. |
| **Room Management** | Public/private rooms, password protection, member roles |
| **GitHub Login** | One-click sign in with GitHub OAuth |
| **Code Formatting** | One-click Prettier formatting for JS, TS, HTML, CSS |
| **Activity Dashboard** | GitHub-style heatmap, room stats, analytics |
| **Dark/Light Theme** | Full theme support |
| **Live Preview** | HTML/CSS live preview in split view |
| **Version History** | Track and restore file versions |
| **Export/Import** | Download rooms as ZIP, fork public rooms |
| **Quick Search** | Instant file switching and action search |

---

## 🛠️ Tech Stack

**Frontend:** Next.js 16 · Monaco Editor · Yjs (CRDT) · Socket.io · TypeScript  
**Backend:** Node.js · Express · Prisma · PostgreSQL · Redis · BullMQ  
**Infrastructure:** Docker · Docker Compose

---

## 📁 Project Structure

```
codesync/
├── client/                  # Next.js frontend
│   ├── src/app/            # Pages (dashboard, room, settings, admin)
│   ├── src/components/     # Toast, LivePreview
│   ├── src/hooks/          # useAuth, useTheme, useSocket
│   └── src/lib/            # API client
│
├── server/                  # Express backend
│   ├── src/routes/         # Auth, rooms, files, comments, snippets, execution, format
│   ├── src/execution/      # BullMQ queue + Docker/local code runner
│   ├── src/socket/         # Socket.io chat & presence
│   ├── src/yjs/            # Yjs CRDT WebSocket server
│   ├── src/prisma/         # Database schema
│   └── src/__tests__/      # Jest API tests
│
├── docker-compose.yml       # Full stack (Postgres + Redis + Server + Client)
└── .env.example             # Environment template
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Local Development

```bash
# 1. Clone
git clone https://github.com/kratikjain10/codesync.git
cd codesync

# 2. Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# 3. Configure environment
cp .env.example server/.env
# Edit server/.env with your database URL and secrets

# 4. Setup database
cd server
npx prisma db push --schema=src/prisma/schema.prisma
npx prisma generate --schema=src/prisma/schema.prisma
cd ..

# 5. Run
cd server && npm run dev &
cd client && npm run dev
```

Visit **http://localhost:3000** 🎉

### With Docker (recommended)

```bash
# One command — starts Postgres, Redis, Server, Client
docker compose up --build
```

---

## 🔑 GitHub OAuth Setup

1. Go to **https://github.com/settings/developers** → New OAuth App
2. Set **Authorization callback URL** to: `http://localhost:4000/api/auth/github/callback`
3. Copy **Client ID** and **Client Secret** to `server/.env`:

```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

---

## 🧪 Testing

```bash
cd server && npm test
```

---

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get profile |
| GET | `/api/auth/github` | GitHub OAuth |
| PATCH | `/api/auth/profile` | Update profile |
| POST | `/api/auth/change-password` | Change password |

### Rooms
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List rooms |
| POST | `/api/rooms` | Create room |
| GET | `/api/rooms/:slug` | Room details |
| PATCH | `/api/rooms/:slug` | Update room |
| DELETE | `/api/rooms/:slug` | Delete room |
| POST | `/api/rooms/:slug/join` | Join room |
| POST | `/api/rooms/:slug/fork` | Fork room |

### Code Execution
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/execute` | Submit code |
| GET | `/api/execute/:jobId` | Poll result |
| GET | `/api/execute/languages` | List supported languages |

### Files, Comments, Snippets
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/rooms/:slug/files` | Create file |
| PUT | `/api/rooms/:slug/files/:id` | Update file |
| DELETE | `/api/rooms/:slug/files/:id` | Delete file |
| GET/POST | `/api/rooms/:slug/files/:id/comments` | Comments |
| GET/POST | `/api/snippets` | Snippets |
| POST | `/api/format` | Format code |

---

## 📝 License

MIT
