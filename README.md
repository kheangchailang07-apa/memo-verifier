# Memo Verifier

Short onboarding guide for new developers.

## What this project is

Internal **memo / policy acknowledgement system**.

- **Frontend:** React 19 + Vite + Tailwind (`frontend/`)
- **Backend:** Express + TypeScript + Sequelize + MySQL (`backend/`)
- **Storage:** AWS S3 for PDFs and signature images
- **Notifications:** Telegram bot reminders
- **Two instances:** APA1 and APA2 share code but use separate env/ports/DBs

## Repository tree

```
memo-verifier/
├── frontend/                 React SPA
│   ├── src/
│   │   ├── App.tsx           Root state, tabs, auth gating
│   │   ├── components/       Screens + modals (memo board, HR queue, audit, etc.)
│   │   ├── utils/
│   │   │   ├── api.ts        fetch wrapper, cookies, 401 refresh
│   │   │   ├── services.ts   Typed API calls per domain
│   │   │   ├── signature.ts  Signature drawing/export
│   │   │   └── pdfExport.ts  PDF generation
│   │   ├── types/            Shared TypeScript types
│   │   └── data/             Defaults + sample/demo data
│   ├── vite.config.ts        Dev proxy + per-mode settings
│   └── ecosystem.config.cjs  PM2 preview processes
│
├── backend/                  REST API
│   ├── src/
│   │   ├── index.ts          Server bootstrap, CORS, rate limit, mount /api
│   │   ├── routes/           URL -> controller mapping
│   │   ├── controllers/      Request handling / business logic
│   │   ├── models/           Sequelize models (User, Memo, Ack, Policy, ...)
│   │   ├── middlewares/      JWT auth, roles, API key
│   │   ├── services/         S3, Telegram, signature storage, HTTP
│   │   ├── config/           env loader, DB connection
│   │   ├── utils/            Crypto, password, signature helpers
│   │   └── database.ts       Schema sync / bootstrap
│   ├── scripts/              One-off migrations (S3 PDFs/signatures)
│   └── ecosystem.config.cjs  PM2 backend processes
│
├── README.md                 This guide
└── FLOWCHART.md              Mermaid diagrams
```

## Frontend — key points

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Loads data, restores session, renders tab (`handbook`, `memos`, `hr-queue`, `workflow`, `telegram-config`, `access-control`, `audit-log`) |
| `src/utils/api.ts` | Base URL, `fetch`, JSON parsing, auto refresh on 401 |
| `src/utils/services.ts` | `authService`, `memosService`, `acksService`, etc. |
| `src/components/` | One file per screen/modal; keep UI logic here |
| `src/data/` | Default permissions, status colors, demo seed data |

API base:

- **Dev:** `/api` → Vite proxies to local backend
- **Build:** `${VITE_PUBLIC_API_URL}/api` → e.g. `https://memoapi.apa1-eva.com/api`

## Backend — key points

| Path | Purpose |
| --- | --- |
| `src/index.ts` | Helmet, CORS, cookies, rate limit, `/health`, `/api`, `/signatures_memo` |
| `src/routes/index.ts` | Mounts `/auth`, `/users`, `/memos`, `/acks`, `/policies`, `/pdfs`, `/bot`, `/audit`, ... |
| `src/controllers/` | Validate input, read/write models, write audit logs |
| `src/models/` | Sequelize tables and relationships |
| `src/middlewares/auth.ts` | `authenticateJWT`, `requireRole(...)` |
| `src/services/signatureStorage.ts` | Upload/serve signature images via S3 |
| `src/services/telegram.ts` | Bot messages and reminders |

Auth: JWT access cookie (15 min) + refresh cookie (7 days), `httpOnly`.

## Main roles

`admin`, `hr`, `manager`, `staff` — permissions are stored in `RolePermissions` and enforced by `requireRole` plus per-controller checks.

## Environment files

| App | Frontend env | Backend env | Frontend port | Backend port |
| --- | --- | --- | --- | --- |
| APA1 | `.env.apa1` | `.env` / `.env1` | 3366 | 5422 |
| APA2 | `.env.apa2` | `.env2` / `env_app2/.env` | 3367 | 5423 |

Important backend env vars:

- `FRONTEND_URL` — CORS allow-list (comma separated)
- `PUBLIC_BASE_URL` — public origin used in generated URLs
- `DB_*` — MySQL connection
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET`
- `AWS_*` — S3 bucket/region
- `PASSWORD_ENCRYPTION_KEY` — must never change without migration

Never commit real `.env` values or secrets.

## Run locally

```bash
# Backend (APA1)
cd backend
npm install
npm run dev1        # nodemon + tsx, port 5422

# Frontend (APA1)
cd frontend
npm install
npm run dev1        # vite, port 3366
```

APA2 equivalents: `npm run dev2` in both folders (ports 3367 / 5423).

## Build & serve

```bash
cd frontend
npm run build1      # -> dist1, calls https://memoapi.apa1-eva.com/api
npm run build2      # -> dist2
npm run serve1      # pm2 start memo-frontend1 (vite preview)
npm run serve2

cd backend
npm run build
npm run start       # or serve1 / serve2 with pm2
```

## Conventions

- Keep API calls in `services.ts`, never call `fetch` directly from components.
- Add a route in `routes/`, logic in `controllers/`, types in `models/`.
- Log security-relevant actions to `AuditLog`.
- Store files in S3; store only keys/URLs in MySQL.
- Restart the backend after changing `.env`; rebuild the frontend after changing `VITE_*`.
