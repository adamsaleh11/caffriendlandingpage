---
name: ticket
description: Handle a caffriend-backend ticket end to end — assess it, implement it, verify it. Use for any pasted ticket, feature, change or bug report in this repository.
---

Read `AGENTS.md` once per session; it holds the permanent laws. This is the only workflow skill.
One agent, one pass, one checkpoint. Do not announce phases or write stage reports.

## 1. Assess (read-only, one checkpoint)

Run `scripts/ai/preflight.sh` once at ticket start; resolve blockers it reports.
Read `.ai/system/architecture-decisions.md` once. Then `rg` for the affected module in
`.ai/system/repository-map.md` and read that section only. Trace controller → service → Prisma in
source and confirm module registration. If the change is client-observable, `rg` the affected routes
in `.ai/system/public-contracts.md`. Never dump a whole map or a `.json` index into context.

Then print exactly this and stop for a go-ahead:

```
TICKET    one sentence, in the user's terms
BEHAVIOR  given / when / then, one line each (for a bug: input, expected, observed)
FILES     path — what changes there
TESTS     spec files that will prove it
RISK      matched rows from the table below, or "none"
UNKNOWN   the one question that blocks correct implementation, or "none"
```

Ask only about ambiguity that would change behavior or scope. Never invent a product requirement or
frontend behavior; `UNKNOWN` is not permission to guess. Skip the checkpoint only if the user said to.

## 2. Implement

For each behavior: write one failing test through the public interface, confirm it fails for the
intended reason, then make the smallest change that passes. Run only the affected spec:
`npm test -- --runInBand --runTestsByPath src/<path>.spec.ts`.

For a bug: reproduce deterministically first, name the causal line with `file:line` evidence, keep
the reproduction as the regression test, then fix. A missing provider or fixture error is not a
reproduction.

Narrow inline stubs only; restore changed environment variables. No real AppModule, database, network
or vendor calls, and no shared fixture infrastructure. Match existing NestJS structure. Before adding
a symbol, check whether existing code already does the job.

## 3. Verify

Inspect this ticket's diff once, in one pass, covering both correctness and minimality:

- Reachable error and null paths, retries, concurrent writes, transaction boundaries, authorization,
  response leakage, other callers.
- Every addition: would removing it break an accepted requirement or a necessary test? If not, remove
  it. Dead code, speculative abstractions, unrelated churn go now.
- Each matched row of the risk table below.

Then run `scripts/ai/verify.sh --with-security` **once**, after the final edit. Reuse that result;
never rerun the same gate for a separate "handoff". `INTRODUCED_FAILURE` must be fixed.
`BASELINE_FAILURE` is pre-existing and is reported, never called a pass. `AUTOMATION_FAILURE` means
repair the harness — never weaken a check, skip a test, suppress lint or edit the baseline.
If architecture or contracts changed, follow the refresh procedure in `.ai/system/verification-map.md`.

## Risk checks

Apply these yourself against this ticket's diff. There are no subagents and no separate review skills.

| If the diff touches | Check |
|---|---|
| `prisma/schema.prisma`, Prisma service | Uniqueness, nullability, relations, `onDelete`, index coverage for new queries |
| `prisma/migrations/**` | Forward-safe against a live DB this repo cannot inspect: no destructive default, no unguarded backfill, no long lock. Never edit an applied migration |
| Controllers, DTOs, `ResponseService`, `src/main.ts` | Routes, methods, validators, envelope, status codes, identifiers, pagination. Preserve existing spellings (`/prompts/update/promptS`, `/basic-details/question:id`, `targetuserId`) |
| Gateways, `src/websocket/**` | Event names, payload shape, guard coverage |
| Guards, JWT, social login, payment, subscription | Authn/authz on every new path, secret handling, what the response exposes |
| Transactions, counters, matching, media, notifications, resume jobs | Race windows, retry safety, in-memory state assumptions, transaction boundaries |
| `package.json`, lockfile, Docker, entrypoint | Build and container story is unverified here — say so rather than claiming it ships |

Deterministic output from `scripts/ai/*.sh` outranks any opinion, including your own.

## Report

What changed, the test and gate results (quoted, not paraphrased), and any material limitation or
unresolved finding. No stage templates, no full logs, no item-by-item inventories.

## Documentation-only tickets

Skip preflight, baseline, product tests and knowledge refresh. Read only the instructions being
edited, review the diff, run `git diff --check`. Preserve unrelated working-tree edits.
