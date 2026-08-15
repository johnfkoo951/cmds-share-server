# cmds-share-server

Governance server for the [CMDS Share](https://github.com/johnfkoo951/cmds-share) Obsidian plugin — hosts shared notes at **share.cmdspace.work** with a server-side registry (view counts, expiry enforcement, revocation).

> Part of the [CMDSPACE](https://cmdspace.work) ecosystem. By CMDSPACE.

## Stack

Next.js (App Router) + Supabase (Postgres + private Storage) + Vercel (`icn1`).

## API

| Route | Auth | Purpose |
|---|---|---|
| `POST /v1/file/upload` | `x-cmds-token` | Upload HTML/CSS/asset (raw bytes + `x-cmds-*` meta headers) |
| `POST /v1/file/delete` | `x-cmds-token` | Delete file + registry row |
| `GET /v1/notes?vaultId=` | `x-cmds-token` | Share registry list (CMS reconcile) |
| `POST /v1/notes/revoke` | `x-cmds-token` | Soft revoke / restore |
| `GET /{shortId}` | public | Serve shared note (404 / 410 expired·revoked / counts views) |
| `GET /f/css/…`, `GET /f/assets/…` | public | Content-addressed files, immutable cache |
| `GET /health` | public | Health check |
| `GET /api/cron/purge` | `CRON_SECRET` | Daily purge of expired shares (7-day grace) |

## Setup

1. Supabase project → run `supabase/migrations/0001_init.sql` → create **private** bucket `share-files`
2. Env (see `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CMDS_API_TOKENS` (comma-separated device tokens), `PUBLIC_BASE_URL`, `CRON_SECRET`
3. `vercel deploy --prod` + Cloudflare CNAME `share → cname.vercel-dns.com`

Policy knobs (slug collision / expiry page / view-count filter) live in `src/lib/policy.ts`.

---

Author: Yohan Koo (CMDSPACE) · https://cmdspace.work
