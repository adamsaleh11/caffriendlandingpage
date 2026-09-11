# Ticket 5 — gaps between the ticket and the published backend contract

Recorded while implementing the web CRM. Each item is a requirement in Ticket 5 that
the backend contract does not currently support. None was worked around by inventing
a field: the UI states the limitation instead.

Source of truth read for every item: `Caffriend-backend`
`src/modules/crm/crm.records.ts`, `crm.service.ts`, `crm-oauth/oauth.service.ts`,
`crm-calendar/*`, `workspaces/workspaces.controller.ts`.

## 1. Agent daily limit — not in the contract

Ticket 5: *"Select Ticket 2 permissions and daily limit."*

`OAuthService.register` accepts exactly `['name', 'redirectUris', 'scopes']` and calls
`exact()`, which rejects any other field with `400 Unknown input field`. No `dailyLimit`
column, request field or enforcement exists anywhere in the backend.

Frontend behavior: the permission picker ships; the limit control does not. The form
says a per-day limit is not enforceable and points to revocation as the way to stop an
agent immediately.

Backend change required to close it: a per-agent request limit recorded at registration
and enforced on the authorization path.

## 2. One-time agent credential — no secret is issued

Ticket 5: *"One-time credential display with copy/acknowledge."*

Registration returns `{id, name, redirectUris, scopes}` only. There is no
`clientSecret` in the response, the Prisma select, or the schema: this is a public
client using PKCE.

Frontend behavior: the client ID is shown exactly once, in component state, cleared on
acknowledgement, and never written to storage, the URL, analytics or cache — the
handling the ticket asks for. The page states plainly that no client secret exists.

Backend change required only if confidential clients are wanted: issue and hash a
secret at registration and return it once.

## 3. Audit before/after values — not recorded

Ticket 5: *"Show ... readable before/after changes."*

The `auditEvent` projection is `actorType, actorMemberId, actorAgentId, action,
targetType, targetId, approvalId` plus `id/workspaceId/createdAt`. No previous or new
value is stored.

Frontend behavior: History shows actor, time, readable action, target, and the approval
and reason where one exists. It states that before/after values are not recorded rather
than reconstructing a diff from current records, which would invent history.

Backend change required to close it: persist a before/after payload per audit event.

## 4. Meeting attendees — not in the meeting projection

The `meetings` record exposes no attendee list, so a scheduled meeting cannot be
re-rendered with the people it was sent to. The confirmation screen shows the attendees
the human just entered, which is accurate at the moment of sending but cannot be
restored later.

## 5. Calendar connection granted scopes

Already recorded in `contracts.ts` before this ticket: `CalendarConnection.scopes` is a
pending additive projection. Settings renders "Granted access unavailable" until it ships.

## Not a gap

- **Pipelines and stages are not writable through the generic CRM path.** They have
  dedicated endpoints under `/workspaces/:id/pipelines`. Implemented against those.
- **Meeting proposals cannot be approved from the Inbox.** `review()` throws
  `Confirm the meeting through the human meeting endpoint`. This is deliberate and
  matches the ticket: agents may not create invitations. The Inbox says so and routes
  the reviewer to the Calendar screen.
