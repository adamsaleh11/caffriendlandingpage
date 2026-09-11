# Ticket 4.5B — Web coffee-chat booking and LiveKit calls

Status: the call journey (`/meet/{inviteToken}`) and organizer meeting management
(`/app/{workspaceId}/meetings/{meetingId}`) are implemented and verified against mocks. The
coffee-chat booking journey and web Google sign-in remain blocked on integration contracts. See
"Implementation status" for the story-by-story position.

## Problem Statement

A Caffriend account holder can share a coffee-chat invitation, but a desktop recipient cannot complete the native coffee-chat booking and calling experience on caffriend.com. The native project's web invite route currently redirects toward the app/store. Recipients need a complete browser experience, including those who do not create an account.

The original ticket covered joining existing CRM meetings. The agreed scope also includes the consumer coffee-link booking journey. These are distinct existing API surfaces; using CRM meeting creation as a substitute for native coffee-chat booking would not meet the requirement.

## Solution

An account holder shares a coffee-chat invitation through email or a message. The recipient opens a public Caffriend page showing safe sender information and availability. Use the supplied Google Calendar appointment page as the visual reference: organizer information, meeting details, month calendar, available time buttons, and a clear timezone. Preserve Caffriend branding and the existing iOS booking behavior.

Offer sign-up, Google sign-in, and continuing as a guest. Guests can book and join without creating an account. Account holders use the same coffee-link and booking APIs as iOS. After selecting duration and an available time, the recipient confirms the booking and receives a clear confirmation. Joining later opens camera/microphone preview and then the shared LiveKit call. Public pages never load the CRM shell or private CRM data.

## User Stories

1. As an account holder, I want to share a coffee-chat invitation by email or message, so that someone can book with me.
2. As a recipient, I want the link to open on desktop, so that I can finish without installing an app.
3. As a recipient, I want to see who invited me, so that I understand the invitation.
4. As a recipient, I want a calendar with available times, so that I can choose a suitable appointment.
5. As a recipient, I want to choose a supported duration, so that the booking fits the sender's availability.
6. As a recipient, I want an explicit timezone, so that I understand when the chat occurs.
7. As an account holder, I want to sign in with Google, so that the booking uses my existing account.
8. As a new recipient, I want optional sign-up, so that I can keep using Caffriend with an account.
9. As a guest, I want to book and join without an account, so that accepting an invitation stays simple.
10. As a recipient, I want my selection preserved through authentication, so that I do not restart unnecessarily.
11. As an account holder, I want bookings to use the iOS APIs, so that web and native reflect the same booking.
12. As a recipient, I want confirmation only after server acceptance, so that I know the booking is real.
13. As a recipient, I want unavailable or newly occupied slots handled honestly, so that I can select another time.
14. As a recipient, I want refresh and repeated submission to avoid duplicate bookings or invitations.
15. As an invitee, I want invalid or unavailable invitations to refuse access safely.
16. As an invitee, I want too-early and ended calls explained accurately, so that I know whether I can join.
17. As a caller, I want camera and microphone preview, so that I can prepare before joining.
18. As a caller, I want permission guidance, so that I can recover from denied device access.
19. As a caller, I want supported device selection, so that I can use the appropriate microphone and camera.
20. As a caller, I want local and remote video, participant names, and active-speaker indication.
21. As a caller, I want mute and camera controls, so that I control my participation.
22. As a caller, I want honest connecting, reconnecting, and disconnected states.
23. As a caller, I want Leave to stop media and return to a safe completion screen.
24. As an organizer, I want to review a meeting and its attendees, so that I can manage it.
25. As an organizer, I want to copy its invite link and open its provider event when supported.
26. As an organizer, I want confirmed reschedule and cancel actions, so that accidental changes are prevented.
27. As an organizer, I want failed changes rolled back and uncertain outcomes reconciled with the server.
28. As an organizer, I want authorized audit history, so that I can review meeting actions.
29. As a guest, I want no workspace or CRM data exposed to my browser.
30. As a caller, I want invitation and call credentials excluded from analytics, logs, and persistent browser storage.
31. As a keyboard user, I want labeled controls and predictable focus through booking, dialogs, and calling.
32. As a tablet or desktop user, I want usable layouts without clipped controls or horizontal overflow.
33. As a site visitor, I want the existing landing page unchanged.
34. As an iOS user, I want an app handoff only when its universal-link contract is verified, with web always available.

## Implementation Decisions

- Scope is this Next.js repository only. Native and backend repositories remain unmodified.
- Preserve the requested `/meet/{inviteToken}` call entry and `/app/{workspaceId}/meetings/{meetingId}` authenticated meeting entry. The existing native `/invite/{code}` represents a coffee link, not a CRM meeting invitation. Verify the generated share URL and hosting ownership before routing coffee links on web; do not reinterpret one credential as the other.
- Use the existing same-origin Next.js server boundary for account sessions and backend requests. Login JWTs remain encrypted in HttpOnly cookies. Public invitation operations require a separate allowlisted boundary that does not fetch workspace data.
- Use the LiveKit web/React SDK. Rooms and credentials come from the server. Neither refresh nor Join creates a meeting client-side.
- Use explicit safe projections. Public metadata may include only approved sender and booking details, never CRM records or identifiers.
- Account-based coffee-link finalization and booking must use the native API semantics. Do not create a parallel CRM booking and claim native compatibility.
- Guests require no account. Name collection is required by the supplied LiveKit contract. Guest email collection and verification were not agreed and must not be silently imposed as an account substitute.
- Optional sign-up and Google authentication must resolve to the existing Caffriend identity and resume the original invitation safely. The current web shell has password login only; a verified web-compatible authentication contract is required.
- The supplied CRM resolve endpoint returns only `purpose`, `startsAt`, `endsAt`, `timezone`, `requiresDisplayName`, and `requiresTermsAcceptance`. Organizer identity and meeting status are not present. Do not fabricate them.
- The supplied CRM resolve contract intentionally merges unknown, revoked, expired, cancelled, and non-LiveKit invitations into `404 Invitation unavailable`. Test each cause, but use the same safe public state where the server does not distinguish it.
- The supplied CRM token endpoint accepts invitation token, display name, and accepted terms; it returns a LiveKit token and URL and creates a fresh guest identity. That endpoint alone does not establish native account identity or guest coffee-chat booking compatibility.
- Keep LiveKit credentials in memory only; clear them and stop tracks when leaving. Do not include credentials in exception messages, telemetry, or new navigation URLs. The invitation entry URL necessarily contains its opaque invite credential; redact that path in ingress/APM logs and use no-referrer/no-store protections.
- Confirm destructive organizer actions. Treat HTTP success with failure statuses such as `CANCEL_FAILED` as failure. Reconcile timeout outcomes before retrying; roll back any optimistic presentation.
- No automatic app/store redirects. No iOS handoff until Ticket 4.5C is verified.
- Apply availability, slot-conflict, timezone, duration, authorization, and booking-idempotency rules on the server. A browser-generated slot is not proof that it can be booked.

## Testing Decisions

The primary seam is the browser journey against the real Next.js routes and server boundary, using the existing Playwright harness. Mock only backend services and the LiveKit/media boundary. Tests assert visible behavior, public responses, navigation, media cleanup, and absence of private data. Do not assert component internals or create fake backend contracts solely to make tests pass.

Use strict vertical TDD: one failing behavior test, observe its intended failure, add the minimum implementation, verify green, and refactor only while green.

Proposed sequence after contracts are verified:

1. Resolve a valid coffee invitation and render its safe availability without CRM requests or data.
2. Select a duration/time and complete a guest booking without any account creation.
3. Complete the same journey using account sign-in and native booking semantics.
4. Exercise expired/revoked/invalid links, occupied slots, unauthorized access, offline errors, and retries without duplicate bookings.
5. Resolve a booked call and obtain server-issued credentials; verify refresh never creates a meeting or room.
6. Exercise device preview, denial recovery, Join, controls, participants, reconnect, terminal failure, and Leave.
7. Exercise organizer review, copy link, provider navigation, audit, confirmed reschedule/cancel, rollback, and server reconciliation.
8. Verify credential non-persistence, public CRM isolation, keyboard/focus, accessible labels/contrast, responsive layouts, web fallback, and landing regression.

Reuse the existing accessibility, security, recovery, and landing test patterns. Disable production networking in automated tests, including provider authentication, media services, analytics, and email delivery. Run the full repository test suite, typecheck, lint, and production build after implementation.

Staging smoke requires controlled accounts and real Google/Outlook invitations: account and guest booking, two-browser calls, rejected/cancelled links, reconnection, reschedule/cancel, and inspection of logs, analytics, browser storage, and navigation for leakage. Report staging separately from mocks. Mock success is insufficient for a calling go decision.

## Implementation status

Recorded on 2026-09-11 against this repository. "Verified" means proven by a test in `tests/` that
fails when the behaviour is removed; every test runs against the deterministic mock backend in
`tests/backend.mjs` and the mocked LiveKit/media boundary. No staging or real-provider run is
claimed.

### Implemented and verified

The public call journey at `/meet/{inviteToken}` — stories 15 to 23 and 29 to 33.

| Behaviour | Where | Proven by |
| --- | --- | --- |
| Safe public resolve, no CRM shell or workspace data | `src/app/api/meet/resolve/route.ts` | `tests/meetings.spec.ts` |
| Unavailable/expired/revoked links merged into one safe state | same | `tests/meetings.spec.ts` |
| Upstream failure does not surface the backend's own message | same | `tests/meetings.spec.ts` |
| Offline detection and a retry that recovers | `src/components/meet/Meeting.tsx` | `tests/meetings.spec.ts` |
| Device preview, permission-denial recovery, camera-off join | `src/components/meet/Preview.tsx` | `tests/meetings.spec.ts` |
| Pre-join microphone and camera selection, carried into the call | `src/components/meet/Preview.tsx`, `Call.tsx` | `tests/meetings.spec.ts` |
| Server-issued credentials only; refresh creates no meeting or room | `src/app/api/meet/token/route.ts` | `tests/meetings.spec.ts` |
| Connecting / reconnecting / disconnected / terminal states | `src/components/meet/Call.tsx` | `tests/meetings.spec.ts` |
| Mute, camera, device selection, participants, active speaker | same | `tests/meetings.spec.ts` |
| Leave stops media and reaches a safe completion screen | same | `tests/meetings.spec.ts` |
| Credentials absent from URL, `localStorage` and `sessionStorage` | whole journey | `tests/meetings.spec.ts` |
| No app-store or custom-scheme handoff | `src/app/meet/[inviteToken]/page.tsx` | `tests/meetings.spec.ts` |
| `no-store`, `no-referrer`, `noindex` on the invitation entry | same | `tests/meetings.spec.ts` |
| Keyboard order through the join controls, visible focus ring | `src/app/meet/meet.css` | `tests/meetings.spec.ts` |
| No axe violations, loaded and error states | whole page | `tests/accessibility.spec.ts` |
| 1280/1024/768/390 with no horizontal overflow, booking and call | `src/app/meet/meet.css` | `tests/accessibility.spec.ts` |
| Landing page unchanged | — | `tests/landing.spec.ts` |

Organizer meeting management at `/app/{workspaceId}/meetings/{meetingId}` — stories 24, 26, 27, 28
in full, and 25 in part.

| Behaviour | Where | Proven by |
| --- | --- | --- |
| Review purpose, status, start/end, timezone, agenda, location | `src/components/crm/MeetingPage.tsx` | `tests/organizer.spec.ts` |
| Copy the server-issued invite link; never assembled in the browser | `src/app/api/crm/[...segments]/route.ts` | `tests/organizer.spec.ts` |
| Confirmed reschedule, optimistic, reconciled with the server | `src/components/crm/MeetingPage.tsx` | `tests/organizer.spec.ts` |
| Failed reschedule rolls back to the server's time | same | `tests/organizer.spec.ts` |
| Confirmed cancellation, with `CANCEL_FAILED` treated as failure | same | `tests/organizer.spec.ts` |
| Dismissing a destructive dialog writes nothing | same | `tests/organizer.spec.ts` |
| Audit history, paged and filtered to this meeting | `src/app/api/crm/[...segments]/route.ts` | `tests/organizer.spec.ts` |
| Join offered only while the server says the meeting is scheduled | `src/lib/contracts.ts` | `tests/organizer.spec.ts` |
| Page is private; a signed-out visitor learns nothing | `src/app/app/[[...segments]]/page.tsx` | `tests/organizer.spec.ts` |
| No axe violations, page and both dialogs; Escape restores focus | `src/components/crm/MeetingPage.tsx` | `tests/accessibility.spec.ts` |
| 1280/1024/768/390 with no horizontal overflow | `src/app/crm.css` | `tests/accessibility.spec.ts` |

### Not implemented — blocked on contract

| Stories | Blocked by |
| --- | --- |
| 1-6, 9-14 — coffee-link resolve, availability, duration, guest booking | Contracts 1, 2, 6. No coffee-link booking endpoint exists in the backend's `crm-calendar` module; `POST /meetings/join/*` join an already-scheduled meeting and do not book one |
| 7, 8, 10 — Google sign-in, sign-up, resuming the invitation | Contract 4. The backend exposes `POST /user/login` (password) only |
| 11 — account booking with native semantics | Contracts 1, 3 |
| 24 (attendees), 25 (provider event) | The backend's `meetings` projection in `crm.records.ts` omits `invitees` and `providerEventId`. Both columns exist on the `Meeting` model but are not caller-visible, so the page says attendees are managed in the provider's calendar rather than inventing a list |
| 34 — iOS handoff | Ticket 4.5C, out of scope here |

Nothing above was stubbed against an invented endpoint.

### Correction to the previous revision of this document

An earlier revision recorded the organizer API as unavailable. That was wrong: it is implemented in
the `Caffriend-backend` repository on branch `codex/ticket-2-backend-api-mcp-calendars`
(`src/modules/crm-calendar/calendar.controller.ts`), which is checked out beside this repository but
was not found when that revision was written. Stories 24 to 28 were blocked only by that oversight,
except for the two projection gaps noted above, and are now implemented.

### Deployment requirement not satisfiable in this repository

Ingress and APM must redact the `/meet/{inviteToken}` path segment, which necessarily carries the
opaque invitation credential. The application sets `no-store` and `no-referrer` on that entry; it
cannot redact an external log pipeline. Track this with the equivalent redaction items in
`docs/ticket-4-integration-notes.md`.

The audit list this page reads (`GET /workspaces/:id/audit-events`) accepts only
`cursor`, `limit`, `search` and `pipelineId`, so it cannot filter by target. The server boundary
follows pages and filters to this meeting, bounded at 20 requests or 50 matching rows. A workspace
with a long audit log may therefore show only recent activity. A server-side target filter would
remove the bound and the wasted paging.

### Release verdict

Unchanged: NO-GO for web calling. The call journey passes against mocks only. The staging smoke
listed under Testing Decisions — controlled accounts, real invitations, two-browser calls,
reconnection, and inspection of real logs, analytics and storage — has not been run, and mock
success is not a calling go decision.

## Out of Scope

- Backend and React Native code changes in this task.
- Recording, transcription, screen sharing, backgrounds, in-call chat, and moderation.
- An invented iOS universal-link path or forced app installation.
- Landing-page redesign and unrelated CRM work.
- Adding payments or changing native paid-chat rules without an explicit supported contract; paid availability must not be silently booked as free.

## Further Notes

### Evidence and readiness

The user supplied a backend meeting API description from branch `codex/ticket-2-backend-api-mcp-calendars`. It is described as derived from implementation, not a previously finalized 4.5A contract. It establishes the documented CRM resolve/token and organizer APIs but not their connection to native coffee-chat bookings.

Native source inspection found coffee-link create/resolve/finalize, availability selection, and acceptance calls. The published native snapshot identifies `POST /calendar/accept-event` as guarded by `AuthGuard`; its provenance is backend commit `80b04a77ea7419c5613bbefcc21453b107eccee7`. Source inspection is evidence of client behavior, not a replacement for a current backend contract.

Contract freshness check on 2026-09-11 exited 1: `Contract refresh failed: Backend published snapshot is stale/dirty; regenerate in backend-owned task`.

### Required integration contracts before implementation

1. A current published coffee-link and calendar contract, including exact runtime envelopes, errors, auth, availability timezone semantics, booking identity, and retries.
2. A guest can resolve a coffee link, select a valid slot, and confirm a booking without account creation. The server enforces invitation scope, slot availability, and duplicate prevention. Endpoint, payload, response, and errors are not yet specified.
3. Native account bookings and guest bookings expose an authorized path to the same call, with a verified mapping between coffee link, accepted booking, and LiveKit room. This mapping is not yet specified. No client-side ID substitution is allowed.
4. Web-compatible Google sign-in and sign-up contracts that establish the same account identity as iOS and safely resume the invitation.
5. Safe public sender details and authenticated attendee/provider-event projections required by the UI. The supplied CRM projection does not provide all these fields.
6. Guest return/join authorization after booking and canonical share-link routing on caffriend.com. Do not invent persistent guest credentials or assume all holders of an unrelated link are authorized.

These are contract gaps, not requests to reduce the agreed product behavior. The task cannot be reported implemented until they are resolved and the full journey passes verification.

Issue tracker and triage configuration are not supplied. This spec is saved locally; publishing requires the `/setup-matt-pocock-skills` configuration described by the requested to-spec skill. No issue has been published or labeled ready-for-agent.

Current web-calling release verdict: NO-GO. No implementation or staging verification is claimed by this document.
