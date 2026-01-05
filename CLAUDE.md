# Frost

Simple deployment platform. Docker-only, single-user.

## Stack
- Bun + Next.js 16
- SQLite + Kysely
- Tailwind + shadcn/ui

## Commands
```bash
bun run dev          # start dev server
bun run build        # production build
bun run db:gen       # regenerate db types (run after schema changes)
```

## Test locally
```bash
# create project using local fixture
curl -X POST localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"test","repo_url":"./test/fixtures/simple-node","port":3000}'

# deploy
curl -X POST localhost:3000/api/projects/{id}/deploy

# check status
curl localhost:3000/api/deployments/{id}
```

## Structure
- `src/lib/db.ts` - database (Kysely + better-sqlite3)
- `src/lib/docker.ts` - docker build/run/stop
- `src/lib/deployer.ts` - deploy orchestration
- `src/app/api/` - REST API routes
- `schema/` - SQL migrations
- `test/fixtures/` - test apps with Dockerfiles

## Database
SQLite at `data/frost.db`. Auto-migrates on startup.

Tables: `projects`, `deployments`

Types in `src/lib/db-types.ts` are auto-generated. Never modify manually.

## Deploy flow
1. Clone repo
2. Docker build
3. Stop old container
4. Run new container
5. Health check

## Conventions
- Use bun, not node/npm/pnpm
- Image names lowercase: `frost-{projectid}:{sha}`
- Container names: `frost-{projectid}`
- Host ports: 10000-20000 range
- Page-specific components in `_components/` folder next to page.tsx
- Shared components in `src/components/`
