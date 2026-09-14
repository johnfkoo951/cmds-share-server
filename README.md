# cmds-share-server

> 🇬🇧 English · [🇰🇷 한국어](README.ko.md)

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
| `GET·POST /v1/tokens` | admin token | List / issue member tokens |
| `PATCH·DELETE /v1/tokens/{id}` | admin token | Enable, disable, relabel, delete |
| `POST /v1/tokens/adopt` | admin token | Move a `CMDS_API_TOKENS` entry into the table, same secret |
| `GET /{shortId}` | public | Serve shared note (404 / 410 expired·revoked / counts views) |
| `GET /f/css/…`, `GET /f/assets/…` | public | Content-addressed files, immutable cache |
| `GET /health` | public | Health check |
| `GET /api/cron/purge` | `CRON_SECRET` | Daily purge of expired shares (7-day grace) |

## Members and tokens

Tokens are issued from the dashboard's **Members** tab (admin only): type a name, press
*Issue token*, hand the member the secret. The tab also shows, per token, whether it has
ever been used, when it was last used, and how many notes its holder has published — so an
unused or stale credential is visible rather than inferred.

Only a sha256 hash is stored. The raw secret appears once, at issue time; a lost token is
deleted and reissued, not recovered.

`CMDS_API_TOKENS` still authenticates, as a fallback, so nothing breaks for members issued a
token before the table existed. Those entries are listed in the Members tab with an **Adopt**
button that copies them into the database under the same secret — the member changes nothing
on their side. Once every entry is adopted, clear the env var and redeploy.

## Setup

1. Supabase project → run the files in `supabase/migrations/` in order → create **private** bucket `share-files`
2. Env (see `.env.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_BASE_URL`, `CRON_SECRET`, and `CMDS_API_TOKENS` with one bootstrap admin entry (`name*:token`) so there is a way in before any token has been issued
3. `vercel deploy --prod` + Cloudflare CNAME `share → cname.vercel-dns.com`

Policy knobs (slug collision / expiry page / view-count filter) live in `src/lib/policy.ts`.

---

Author: Yohan Koo (CMDSPACE) · https://cmdspace.work
