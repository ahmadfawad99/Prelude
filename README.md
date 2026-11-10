# PreSales Tool

End-to-end presales platform — inquiries, AI call summaries, WBS, and project
plans in one place. See [`docs/`](docs/) for the requirements, data model, and
architecture.

- [01 — Requirements & NFRs](docs/01-requirements-and-nfr.md)
- [02 — Project Plan template & data model](docs/02-project-plan-template-and-data-model.md)
- [03 — Architecture & Phase-1 plan](docs/03-architecture-and-phase-1-plan.md)

## Stack

Next.js 15 (App Router) · TypeScript · Prisma + PostgreSQL · BullMQ + Redis ·
Auth.js (Google SSO) · Tailwind · TanStack Query/Table.

## Local development

Prerequisites: Node 20+, Docker.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   then set AUTH_SECRET (npx auth secret), AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET

# 3. Start Postgres + Redis
npm run docker:up

# 4. Create the database schema and seed the rate card
npm run db:push
npm run db:seed

# 5. Run the app (and, in a second terminal, the worker)
npm run dev
npm run worker
```

App: http://localhost:3000 — the **first user to sign in becomes ADMIN**.

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `build` / `start` | Next.js |
| `worker` | BullMQ background worker |
| `db:push` / `db:migrate` / `db:seed` / `db:studio` | Prisma |
| `docker:up` / `docker:down` | Postgres + Redis |
| `lint` / `typecheck` | Quality gates |

## Status

Milestone 0 (foundation) complete: auth, RBAC, schema, worker, app shell.
Roadmap in [docs/03](docs/03-architecture-and-phase-1-plan.md) §7.
