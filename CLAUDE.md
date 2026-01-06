# Frost

Simple deployment platform. Docker-only, single-user.

## Concepts

**Project** - container for related services. Has project-level env vars inherited by all services.

**Service** - deployable workload within a project. Two deploy types:
- `repo`: builds from git repo (repo_url, branch, dockerfile_path)
- `image`: pulls pre-built image (image_url)

**IMPORTANT**: Apps must listen on `PORT` env var (default 8080). Pre-built images like nginx/whoami that ignore PORT won't work. Use images that respect PORT (e.g., `gcr.io/google-samples/hello-app:1.0`).

Services communicate via Docker network using service name as hostname.

**Domain** - custom domain attached to a service. Multiple domains per service supported. Types:
- `proxy`: routes traffic to service
- `redirect`: 301/307 redirect to another domain

**Deployment** - immutable record of a service deployment. Status: pending → cloning/pulling → building → deploying → running/failed. Tracks container_id, host_port, build_log.

**Settings** - key-value store for domain, email (Let's Encrypt), SSL config.

## Test VPS
- IP: 65.21.180.49
- Domain: frost.j4labs.se
- Test service domain: testapp.frost.j4labs.se (A record points to VPS)
- SSH: `ssh root@65.21.180.49`
- Install password: `hejsan123`
- **Always enable "Use staging certificates" when setting up SSL** to avoid Let's Encrypt rate limits

Fresh install (after VPS rebuild):
```bash
ssh root@65.21.180.49 "curl -fsSL https://raw.githubusercontent.com/elitan/frost/main/install.sh -o /tmp/install.sh && chmod +x /tmp/install.sh && echo 'hejsan123' | /tmp/install.sh"
```

Update existing install:
```bash
ssh root@65.21.180.49 "/opt/frost/update.sh"
```

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

Tables: `projects`, `services`, `deployments`, `domains`, `settings`

Types in `src/lib/db-types.ts` are auto-generated. Never modify manually.

## Deploy flow
1. Clone repo (repo type) or pull image (image type)
2. Docker build with merged env vars (project + service)
3. Create project network if needed
4. Run new container on network (hostname = service name)
5. Health check
6. Stop previous deployment

## Conventions
- Breaking backward compatibility is OK - early development phase
- Use bun, not node/npm/pnpm
- Image names: `frost-{serviceid}:{sha}`
- Container names: `frost-{serviceid}`
- Network names: `frost-net-{projectid}`
- Host ports: 10000-20000 range
- Page-specific components in `_components/` folder next to page.tsx
- Shared components in `src/components/`
- When unsure about design decisions, do web searches to see how Vercel/Cloud Run handle it

## Git Conventions

**Commit messages** - use conventional commits format:
- `feat: add dark mode` - new feature
- `fix: resolve login redirect` - bug fix
- `docs: update readme` - documentation
- `refactor: simplify deploy logic` - code restructure
- `chore: update deps` - maintenance

Keep messages short (<50 chars title). Body optional for context.
