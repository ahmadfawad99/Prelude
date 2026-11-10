# Modules

Domain modules for the modular monolith (docs/03 §2). Each module owns its
domain logic and Prisma access; cross-module calls go through service
interfaces, not direct table reads.

| Module | Status | Milestone |
|---|---|---|
| `inquiries` | state machine implemented | 1 |
| `clients` | planned | 1 |
| `attachments` | planned | 1 |
| `summaries` | planned | 3 |
| `wbs` | planned | 4 |
| `rates` | seeded (see `prisma/seed.ts`) | 5 |
| `plans` | planned (derive engine) | 5 |
| `templates` | planned | 6 |
| `export` | planned | 6 |
| `kanban` | planned | 2 |
| `mail` | planned (Gmail read-only) | 7 |
| `jira` | planned (import) | 7 |
| `notifications` | planned | 7 |
| `activity` | planned | 1 |
| `ai` | planned (AiProvider abstraction) | 3 |

Shared infrastructure lives in `src/lib` (`db`, `queue`, `rbac`).
