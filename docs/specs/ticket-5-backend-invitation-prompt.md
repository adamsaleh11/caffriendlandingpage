# Backend implementation prompt — personal-mailbox meeting invitations

Status: confirmed by the user, who reports that backend implementation is complete. Local contract verification is in progress. This is one dependency of the ongoing Ticket 5 UX interview, not the final CRM specification.

## Prompt to paste into the backend task

Implement the backend support for this Caffriend CRM journey in `Caffriend-backend`: a user enters/selects a recipient email and engagement, proposes meeting date/time(s), writes a short personal message, previews a polished Caffriend email containing their profile card and meeting details, and explicitly sends it from their own connected mailbox. The recipient can Accept or Decline. Acceptance of a selected proposed time creates a booked meeting; sending or opening the invitation does not.

Inspect this repository's instructions and current native contracts first. Preserve the shipped iOS behavior and avoid unrelated changes. Work only in the backend repository; publish a precise frontend integration handoff when complete. Do not send real cold emails, register public OAuth clients, deploy migrations or change production configuration as part of implementation. Use deterministic mocks; report real-provider verification separately.

### Confirmed product requirements

- Primary use: coffee chats with employees that can lead to job interviews. Agency client calls are also supported; do not hardcode career-only copy or pipeline stages.
- A Person may have multiple purpose-specific Engagements with independent pipeline positions. Associate the invitation with the authorized workspace, person and engagement without merging engagements by email address.
- The sender's own email account sends the invitation. A Caffriend-address email with Reply-To is not an equivalent substitute. Support Google and Microsoft account capabilities where available; unavailable or unregistered integrations must visibly fail closed.
- Provide a branded email template containing the user's personal short message, their iOS-style profile card, date/time, explicit timezone, duration, purpose/location or conference choice, and Accept/Decline actions. Preserve the public-facing content and theme of the iOS profile; do not invent a different profile or expose private CRM/native data. Preview must represent the actual outgoing content.
- Accept means a booked meeting, not interest, match creation, a page view or an AI proposal approval. Decline does not create a meeting. Invitation delivery, recipient decision and calendar/conference provisioning are distinct outcomes and must be represented honestly.
- Sender explicitly confirms sending. AI agents may draft/propose through the approval Inbox but cannot send mail or create invitations directly. Existing provenance, permitted-use, outreach restrictions and workspace permissions apply to this outbound action.
- Ordinary CRM remains usable without a calendar, mailbox connection or AI.

### Existing source evidence to verify and reuse

Inspection at backend HEAD `f39be35` found:

- Native `POST /calendar/availability` proposes candidate slots with a pending appointment; authenticated `POST /calendar/accept-event` selects an availability, creates an `AcceptedEvent` and sets the appointment's `isAccepted` flag. Inspect `src/modules/calendar/calendar.controller.ts`, `calendar.service.ts` and DTOs. This is the relevant pending-to-booked model.
- Native client `../Caffriend/components/MatchModal.tsx` calls `/calendar/accept-event`; `../Caffriend/api/calendarApi.tsx` exposes the API. Verify the active UI, not an unused/local-only acceptance modal.
- Native initial Accept opens the offered-slot selection flow; it does not immediately book. Confirmation after choosing a slot performs acceptance. Native booking appears in the Caffriend calendar and does not itself create a Google/Outlook event. Native decline uses `DELETE /match/delete-pending/:appointmentId`, deleting the pending appointment and slots; preserve shipped behavior while retaining the audit/decision history needed for new CRM invitations.
- `POST /coffee-links/:code/finalize-match` creates/reuses a match/thread and returns `shouldPromptBookChat: true`; it is not booking acceptance.
- CRM `src/modules/crm-calendar/calendar.controller.ts` supports availability and meeting creation/confirmation/retry/reschedule/cancel. The provider currently sends Google calendar invitations using `sendUpdates=all`, and Microsoft events include attendees. These are calendar invitations, not the new branded outbound mail.
- CRM meeting `CONFIRMED` currently describes successful provider creation, not recipient RSVP. Keep recipient acceptance distinct from that status; do not mislabel existing meetings or retrofit their meaning silently.
- `/meetings/join/resolve` and `/meetings/join/token` authorize joining already-created LiveKit meetings, not RSVP or booking.
- Current calendar OAuth scopes are insufficient for mailbox email sending. No general branded outbound email sender or external-recipient CRM Accept/Decline API was found.
- Native profile presentation lives in `../Caffriend/components/Profile/PublicProfileContent.tsx`, with theme tokens in `../Caffriend/constants/Colors.ts`. Existing anonymous coffee-link projection is too narrow for full profile parity. The authenticated `/user/profile/:id` serializer includes email/phone and must not be copied wholesale into public responses or email.
- The published `.ai/system/public-contracts.md` calendar narrative appeared stale relative to registered source. Refresh published contracts as part of completion.

### Implementation details confirmed by the user

The user confirmed this prompt, including the following proposed details, before reporting backend implementation complete.

1. Preserve the native model of one or more proposed slots. An email action opens an invitation-scoped page showing the proposed time(s); the recipient explicitly confirms one. GET/link previews never mutate a decision. A single proposed time needs no fresh time search.
2. Permit external recipients to accept/decline without creating an account, consistent with the existing web coffee-chat specification. Establish scoped recipient authorization without exposing workspace records, fabricating native user IDs or silently creating accounts. Preserve existing account identity for authenticated recipients where supported.
3. Pending invitations do not reserve a slot indefinitely. Revalidate availability and authorization atomically at acceptance. If the selected time is unavailable, do not mark accepted/booked; show any remaining valid proposed times or a clear unavailable result. Do not silently choose another time. If the native domain requires a different reservation rule, report the conflict rather than changing behavior silently.
4. Decline is terminal for that invitation and requires confirmation but no written reason. Further outreach is a fresh explicit sender action, not an automatic follow-up. No bulk campaigns, automatic reminders or email-open tracking.
5. Keep existing native acceptance behavior intact. If bridging guest CRM invitations into native booking requires a new explicit identity/booking mapping, implement and document that boundary. Do not equate `AcceptedEvent` and CRM `Meeting` identifiers or build competing bookings. The frontend needs one authoritative relationship among invitation, recipient decision, booking, calendar event and join destination.

### Backend scope

- Add/reuse server-owned Google/Microsoft mail authorization, connection inspection and revocation, exposing verified sending identity and actual granted capabilities. Request mail permission separately from calendar permission as required. Encrypt/redact credentials; never expose tokens to the frontend. Do not let the client forge From addresses.
- Add typed, workspace-authorized draft/preview/send/status operations and invitation-scoped public resolve/accept/decline operations. Backend owns exact routes and DTOs; publish them rather than assuming the frontend can infer them. Preview must not send mail, create a provider event or reserve a meeting. Validate recipient, ownership, content, allowed URLs, selected times, timezone and conference capability on the server.
- Produce an allowlisted sender profile projection using the same canonical public-facing profile fields as iOS. Include relevant populated identity, professional details, education, links, topics, prompts, projects and work history displayed by that profile; safely adapt to email HTML. Do not leak private contact fields, workspace records, consumer discovery data or credentials. Use escaped/sanitized content, a plain-text alternative and an email-compatible layout with accessible buttons. Make omitted/unsupported content explicit in the handoff rather than silently claiming full parity.
- Enforce existing outreach/rights rules at send and any later applicable action. Record sender identity, recipient, engagement, submitted content/version, selected slot, decision and provider outcome in readable audit data without logging invitation credentials.
- Make send and recipient decisions idempotent with explicit concurrency control. Repeated Send, Accept, webhook delivery or retry must not create duplicate emails, bookings or provider invitations. Bind recipient actions to the invitation and current version. Revoked, expired, cancelled, superseded and already-decided invitations need safe, stable responses.
- Distinguish provider acceptance of mail from confirmed delivery. A timeout is an unknown outcome requiring reconciliation, not permission to resend blindly. Publish truthful sent/failed/unknown states supported by the implementation.
- After recipient acceptance, coordinate booking and the selected supported calendar/conference provider. Validate Meet/Google and Teams/Microsoft compatibility and organizer/calendar authority. Never report successful scheduling or show fabricated event/join links after provisioning failure. Provide explicit retry/reconciliation behavior and avoid duplicate calendar events/invitations. Account for the initial branded outreach email versus the later actual calendar invitation as two different communications.
- Document how accepted bookings are represented to native and CRM consumers, including cancellation/reschedule implications. Preserve supported paid-native-booking checks; do not silently convert paid native availability into a free CRM booking.

### Verification and required handoff

Test sender authorization, tenant isolation, profile projection and template escaping; no mail from preview; granted mailbox scopes and revoked connections; native compatibility; guest/account acceptance; decline; invalid/expired/reused links; email-scanner GET safety; unavailable slots, timezone/DST and concurrent acceptance; duplicate send/accept prevention; rights blocks; provider timeout/retry and truthful outcomes; and no leaked secrets in browser-facing payloads/audit/logs.

Return a backend-owned integration contract with exact methods/paths, request and response examples, status enums, permission rules, idempotency/concurrency rules, public identity semantics, safe profile schema, error/recovery behavior, email preview representation, provider configuration names and callback requirements, migrations, tests actually run and remaining blockers. Refresh published snapshots. Explicitly distinguish implemented, mock-verified and staging-verified capabilities. Do not claim the frontend or full Ticket 5 complete.
