# Regression test plan

Run from the repo root with **pnpm** (npm is blocked).

| Command | What it covers |
| --- | --- |
| `pnpm test:db:setup` | Creates local `weepark_test` and applies Prisma migrations |
| `pnpm --filter weepark-backend test` | Backend Vitest (unit, property, integration, security, sockets, contracts, smoke) |
| `pnpm --filter weepark-frontend test` | Frontend form/API schema validation (no UI/RTL) |
| `pnpm test:security` | Security regression suite (the original 22 cases, moved under `backend/test/security/`) |
| `pnpm test:smoke` | Critical-path API smoke |
| `pnpm test:e2e` | Playwright — skipped until the UI redesign lands |
| `pnpm test:load` | k6 — **not** part of `pnpm test:all` |
| `pnpm test:all` | typecheck + lint + tests + build for backend and frontend |

## Preconditions

- Docker Postgres `weepark-postgres` is running (host port 5434).
- `backend/.env` has `DATABASE_URL` pointing at **localhost**. Tests rewrite the DB name to `*_test` and refuse remote URLs.
- Seeded Super Admin is only required for Playwright login against the dev stack, not for Vitest (fixtures use `@wptest.local`).

## Manual QA still required

- Real browser QR scan on a phone
- Email delivery (SMTP)
- Multi-valet live pickup on two devices
- Production TLS / Secure cookie behaviour behind HTTPS
