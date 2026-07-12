# WeePark — Parking Management Platform

A production-ready, multi-tenant SaaS platform for managing corporate parking: sites, valets, organizations, employees, vehicles, a QR-driven parking flow, real-time pickup requests, analytics, and reports.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS 4, shadcn-style UI (Radix), Framer Motion, Lucide, Recharts, Socket.IO client |
| Backend | Node.js 20, Express 4, TypeScript, Prisma ORM, Socket.IO, Zod, JWT, Nodemailer, ExcelJS, Swagger |
| Database | PostgreSQL 16 |
| Infra | Docker, docker-compose, Nginx (frontend serving + API proxy) |

## User Roles

- **Super Admin** — full system control: sites, valets, organizations, all data.
- **Organization Admin** — manages only their own organization's employees, vehicles, and parking history.
- **Valet** — sees only assigned sites; accepts and completes pickup requests.
- **Employee** — uses the public QR page to park and request their car (no login required).

## Repository Layout

```
weepark_qr/
├── backend/            Express API (clean architecture)
│   ├── prisma/         Schema, migrations, seed
│   └── src/
│       ├── config/     env validation, prisma client, swagger spec
│       ├── controllers/
│       ├── routes/
│       ├── services/   business logic
│       ├── repositories/  data access (Prisma)
│       ├── middlewares/   auth, authorize, validate, rate limit, errors
│       ├── validators/    Zod schemas
│       ├── sockets/       Socket.IO setup + auth
│       ├── templates/     email templates
│       ├── types/
│       └── utils/
├── frontend/           React SPA
│   └── src/
│       ├── api/        API client + domain services
│       ├── components/ ui primitives, shared, layout
│       ├── context/    auth, theme
│       ├── hooks/
│       ├── lib/        axios, sockets, token store, utils
│       ├── pages/      feature pages (dashboard, sites, valets, ...)
│       └── types/
└── docker-compose.yml
```

## Quick Start (Development)

Prerequisites: Node.js 20+, Docker.

```bash
# 1. Start PostgreSQL (exposed on host port 5434)
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env          # fill in secrets (JWT, SMTP) as needed
npm install
npx prisma migrate dev        # create schema
npm run prisma:seed           # creates the Super Admin account
npm run dev                   # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Default Super Admin (change after first login, or override via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`):

- Email: `admin@weepark.io`
- Password: `Admin@1234`

API docs (Swagger): http://localhost:4000/api/docs

## Full Docker Deployment

Builds and runs Postgres + API + Nginx-served frontend:

```bash
JWT_ACCESS_SECRET=<random-32+chars> JWT_REFRESH_SECRET=<random-32+chars> \
  docker compose --profile full up -d --build
```

- Frontend: http://localhost:8080 (proxies `/api` and `/socket.io` to the backend)
- Backend: http://localhost:4000

Migrations are applied automatically on backend container start (`prisma migrate deploy`). Seed the admin once with:

```bash
docker compose exec backend npx prisma db seed
```

## Environment Variables (backend/.env)

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API port (default 4000) |
| `CLIENT_URL` | Frontend origin for CORS + email links |
| `API_URL` | Public API URL used in QR codes |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | 32+ char secrets |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | e.g. `15m`, `7d` |
| `SMTP_HOST/PORT/USER/PASS/FROM` | Nodemailer SMTP settings (emails are logged to console if unset) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | API rate limiting |

## Core Flows

### QR Parking Flow (public, no login)

1. Each site gets a unique code + downloadable QR pointing to `/parking/{siteCode}`.
2. Employee scans the QR, enters their vehicle number.
3. Known vehicle → employee/organization details auto-filled. Unknown → quick registration (employee + vehicle + organization pick).
4. "PARK MY VEHICLE" creates a `ParkingEntry` (status `PARKED`) and notifies the site's valets in real time.
5. The parked screen shows live duration and a large **GET MY CAR** button.

### Pickup Flow

1. GET MY CAR creates a `PickupRequest` (status `PENDING`) and instantly notifies every valet assigned to the site via Socket.IO.
2. Valet **accepts** → status `ACCEPTED`; retrieves the car; **completes** → pickup `COMPLETED`, parking entry `COMPLETED` with duration and handler recorded.
3. The employee's public page polls the entry and reflects each stage live.

### Notifications

Socket.IO rooms per user (`user:{id}`), per site (`site:{id}`), and per role (`role:{ROLE}`). The notification service uses a channel abstraction (`NotificationChannel`) so WhatsApp/SMS/Firebase/Twilio senders can be added without touching call sites. All notifications are also persisted for the in-app inbox.

## API Standards

- REST under `/api/v1`, public QR endpoints under `/api/v1/public`.
- Zod validation on body/query/params, global error handler, consistent `{ success, message, data, meta }` envelope.
- Pagination, search, sort, and filters on all list endpoints.
- CSV and Excel export at `/api/v1/parking/export/{csv,excel}`.
- Swagger UI at `/api/docs`.

## Security

Helmet, CORS allow-list, rate limiting (stricter for auth endpoints), JWT access + rotating refresh tokens (hashed at rest), bcrypt (12 rounds), role middleware, org-scoping enforced at the service layer, audit logs on all mutations.

## Scripts

Backend: `npm run dev`, `build`, `start`, `lint`, `typecheck`, `prisma:migrate`, `prisma:seed`, `prisma:studio`, plus `scripts/smoke.sh` (end-to-end API smoke test).

Frontend: `npm run dev`, `build`, `preview`, `lint`.

## Roadmap-Ready Architecture

The repository/service split, the notification channel abstraction, the public entry API, and normalized schema were designed so mobile apps, ANPR/RFID/FASTag ingestion, visitor passes, billing/subscriptions, and payment gateways can be added as new services + routes without reworking existing modules.
