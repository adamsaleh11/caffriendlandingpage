# Task: apply the four pending CRM migrations to the Caffriend database

Repository: `Caffriend-backend` (NestJS + Prisma).

## Context

`GET /workspaces` returns `500 {"statusCode":500,"message":"Internal server error"}` for an
authenticated user. `WorkspacesService.listWorkspaces` is a plain Prisma query against the
`Workspace` / `WorkspaceMember` tables. Those tables do not exist in the database, so Prisma throws.

`npx prisma migrate status` reports four unapplied migrations:

- `20260910000000_crm_foundation`
- `20260910010000_crm_rights_integrity`
- `20260910020000_crm_api`
- `20260910030000_caffriend_livekit_meetings`

The datasource is a live AWS RDS PostgreSQL instance
(`db.c0xqqquysof9.us-east-1.rds.amazonaws.com:5432`, database `postgres`, schema `public`) that also
serves the iOS app currently live on the App Store. Nothing has been applied yet.

## Impact analysis already performed (please re-verify, do not assume)

Every table these migrations `ALTER`, they also `CREATE` — the set of altered tables minus created
tables is empty. All 31 tables are new (`Workspace`, `WorkspaceMember`, `Person`, `Pipeline`,
`CalendarConnection`, the `OAuth*` set, `Meeting`, `SourceClaim`, `SourceArtifact`, and so on).

- No `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE FROM` anywhere in the four files.
- The five `DROP` statements are constraint relaxations (`DROP NOT NULL`, `DROP CONSTRAINT`) on
  `SourceClaim`, `SourceArtifact`, and `ExternalConversation` — tables created by this same batch,
  which do not exist in the database yet.
- The only contact with live data is three foreign keys pointing **at** `User` from new empty tables
  (including `DiscoveryPreference`), with `ON DELETE CASCADE`. `User` itself is neither altered nor
  backfilled.
- One `ALTER TYPE "CrmActorType" ADD VALUE IF NOT EXISTS 'GUEST'` — append-only, on a CRM enum.
- The `ACCESS EXCLUSIVE` lock in `crm_rights_integrity` is taken on `SourceClaim` / `SourceArtifact`
  while they are empty; the migration's own header notes this is why it is cheap.

Conclusion: no schema or data the shipped iOS app depends on is modified. The risk is operational,
not structural.

## What to do

1. **Take an RDS snapshot first** and confirm it completed before running anything.

2. **Run during a low-traffic window.** `crm_api` sets `lock_timeout = '3s'` and
   `statement_timeout = '30s'`; its header says to retry deployment when idle. Adding the FKs to
   `User` briefly locks that table, so a busy period risks a timeout mid-batch.

3. **Check for hand-applied schema before running.** `20260910030000_caffriend_livekit_meetings`
   carries the header *"Applied by hand: this repository does not run prisma migrate."* If any of
   that schema was already applied manually, Prisma's `_prisma_migrations` ledger disagrees with the
   live schema and `deploy` may halt. Confirm whether `Meeting`, `MeetingParticipant`, and
   `MeetingInvitation` already exist, and whether `CrmActorType` already contains `GUEST`. Every
   statement in that file is idempotent (`IF NOT EXISTS` / `ADD VALUE IF NOT EXISTS`), so a repeat
   run is safe, but the ledger may need `prisma migrate resolve --applied <name>` instead.

4. **Apply with `deploy`, never `dev`:**

   ```bash
   npx prisma migrate deploy
   ```

   `prisma migrate dev` must not be used here. It can reset the database when it detects drift,
   which against this instance would destroy production data. `deploy` only applies pending
   migrations and never resets.

5. **If it fails partway**, do not re-run blindly. `crm_foundation`, `crm_rights_integrity`, and
   `crm_api` are each wrapped in `BEGIN;` so a failed migration rolls itself back, but Prisma will
   mark it failed and block subsequent runs. Inspect `_prisma_migrations`, resolve the specific
   entry, then continue.

## Verification after applying

```bash
npx prisma migrate status          # expect: no pending migrations
```

Then, against the running API (port 4000 by default, `PORT` overrides):

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/user/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<account>","password":"<password>"}' | jq -r .data.token)

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/workspaces -w '\n%{http_code}\n'
```

Expect `200` with a JSON array (`[]` is correct for a user with no workspaces — the endpoint
working is the signal, not the contents).

## Regression check on the live app

The migrations do not touch its tables, but confirm anyway before considering this done: log in on
the iOS app and exercise the main flows that read `User` — sign-in, profile, matches, coffee chats.
Watch API logs for new errors on those endpoints.

## Out of scope

Do not modify the web frontend. The `500` it surfaces on `/workspaces` is the backend's own, passed
through unchanged, and it resolves once the migrations land.

One frontend bug was found and already fixed on that side: the calendar-connections proxy was
sending `?page=N` and reading `{data, totalPages}`, while this backend uses cursor pagination
(`?cursor=&limit=`, returning `{items, nextCursor}`) and rejects unknown query fields via
`exact(query, ['cursor','limit','search','pipelineId'])`. That endpoint returned `400 Unknown input
field` on every call. No backend change is needed for it.
