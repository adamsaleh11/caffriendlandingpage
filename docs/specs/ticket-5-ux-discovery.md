# Ticket 5 — End-to-end CRM experience discovery

Status: interview in progress. Proposed answers are not accepted decisions. No product implementation is authorized by this interview. The final walkthrough requires the user's confirmation of shared understanding.

Source: user-supplied “Ticket 5 - Complete web CRM and cofounder pilot”, supplied 2026-09-11. Existing context: `CONTEXT.md`, Ticket 4 and Ticket 4.5B specifications and integration notes.

## Handoff Understanding Summary

### A. What Already Exists

The web repository has password sign-in, a workspace chooser/create flow, a CRM shell, calendar settings, an authenticated meeting detail page and a public LiveKit call journey. Existing documentation reports verification against mocks, not real-provider staging success. People, Pipeline, Inbox, Agents and Calendar currently render placeholder section content.

### B. What I Must Not Change

Preserve the public landing page at `/` and the native app. Keep CRM at `/app`. Manual CRM use must require neither AI nor a calendar. Agents propose meetings; humans confirm invitations. Render safe backend projections only. Preserve the distinct meanings of coffee-chat invitation, coffee-chat booking and call invitation.

### C. What I Am Responsible For

Interview the user about the entire intended experience, resolve terminology, document accepted decisions and present concrete walkthroughs covering success, recovery and restrictions. This task does not implement or release the product.

### D. Dependencies I Will Rely On

Tickets 1, 2 and 4; Ticket 3 for cross-product release. Backend-owned identity, workspace authorization, CRM records, rights enforcement, approval decisions, audit and provider scheduling. Existing same-origin web session and CRM boundaries. Exact Ticket 5 payloads and permissions still require contract inspection.

### E. Gaps / Ambiguities / Risks

Primary pilot use case; engagement semantics; connection between CRM meetings and the separately specified consumer coffee-link/LiveKit journeys; onboarding and daily workflow; collaboration and role experience; manual provenance entry; duplicate handling; approval transaction boundaries; meeting participant experience; recovery and integration unavailability. Existing docs flag missing safe projections and unverified staging configuration; their current upstream status must be checked rather than assumed.

### F. Assumptions I Will Use Unless Corrected

The pasted ticket supplies required product boundaries, not proof of completed implementation. “Tomorrow” is a relative deadline in the pasted ticket, not a verified release date. Recommendations remain proposals until answered. Existing coffee-chat scope is preserved while its relationship to Ticket 5 is clarified.

### G. Readiness Verdict

READY FOR GRILLING on product decisions. Contract-dependent questions await source inspection.

### H. Contract Conflicts Detected

Potential scope overlap: Ticket 5 names Google Meet, Teams and physical meetings, while Ticket 4.5B separately describes LiveKit calls and coffee-link booking. This is not yet an established contradiction. Existing documented backend projection gaps include attendee/provider-event fields, consent client identity and calendar granted scopes. No DTO compatibility is presumed.

## Integration points currently established

- CRM entry: `/app`; authenticated meeting page: `/app/{workspaceId}/meetings/{meetingId}`.
- Separate public call entry: `/meet/{inviteToken}`.
- Existing web boundaries: `/api/session`, `/api/crm/[...segments]`, `/api/consent` and `/api/meet/{resolve,token}`.
- Calendar callbacks: `/crm-calendar/callback/GOOGLE` and `/crm-calendar/callback/MICROSOFT`; MCP consent: `/oauth/authorize`.
- Server configuration: `CAFFRIEND_API_ORIGIN`, `CAFFRIEND_WEB_ORIGIN`, `CAFFRIEND_SESSION_SECRET`.
- Ticket 5 exact write payloads, enum values and permission matrix: pending source inspection, not invented here.
- Every primary screen needs loading, empty, partial, forbidden, not-found, success and recoverable-error states.

## What I Will Use Going Forward

Preserve the ticket's manual-first, optional-integration, human-confirmation and privacy boundaries. Ask about product decisions rather than facts discoverable from source. Record resolved vocabulary in `CONTEXT.md`, user-experience decisions here, and consequential trade-offs in ADRs where warranted.

## Design tree

1. Primary user and purpose → first-session outcome → entry, onboarding and daily return.
2. People / organizations / engagements → identity and duplicates → pipeline lifecycle → notes and tasks.
3. Workspace collaboration → roles, ownership, visibility and competing edits.
4. Manual provenance and AI intake → evidence and restrictions → approval/edit/rejection → resulting records and recovery.
5. Meeting product boundary → organizer and attendee journeys → availability, confirmation, reschedule/cancel and provider failures.
6. Optional agent setup → permissions and credential lifecycle → host handoff and audit.
7. Complete journeys → responsive/accessibility and empty/error states → pilot acceptance → shared-understanding confirmation.

## Round 1 — user answers and accepted decisions

- Q1: The primary use case is landing interviews at companies through coffee chats with employees. Agency client calls are a second use case the same user needs. Pipeline presets, workspace separation and the exact first-session experience are not yet decided.
- Q2: The user accepted distinct Person, Organization and Engagement concepts, including simultaneous purpose-specific engagements involving one person with independent pipeline positions and outcomes. Definitions recorded in `CONTEXT.md`.
- Q3: The user wants a CRM flow that accepts a recipient email address and sends a cold invitation email containing an email template, the sender's profile card preserving the iOS profile presentation, and Accept / Decline buttons. The email should preserve the iOS visual theme. This adds an outbound invitation journey; its relationship to direct scheduling and LiveKit is still unresolved.

## Backend handoff requested by user

Inspect existing email sending, profile, invitation and booking contracts. If APIs are missing, prepare a self-contained prompt for the backend repository before frontend implementation starts. Present it to the user, wait for their confirmation and follow their next instruction. Do not dispatch a new task or send invitation emails from this interview.

The user has requested email sending as a product capability, not authorized actual outreach in this session. The scope now includes user-initiated cold invitations; automated campaigns and follow-ups have not been requested.

## Round 2 — user answers and accepted decisions

- Q4: The user states “A booked meeting is accept” and asks to follow backend/iOS semantics. The email contains calendar date/time; Accept must result in a booked meeting, not merely indicate interest or begin an unrelated intake flow. Exact existing native semantics are under inspection.
- Q5: The user clarified that the email comes from the person sending the cold email: the sender's own email account, not a Caffriend sending address or the invited person's mailbox.
- Q6: The user accepted preview/personalization and requests a polished email template containing the short personal message, profile card, calendar date/time and meeting details, preserving the iOS visual theme.

## Source findings for the invitation handoff

Read-only inspection of adjacent backend checkout at `f39be35` found provider calendar invitation creation, but no generic outbound email service/template renderer or CRM recipient Accept/Decline API. Current calendar OAuth scopes do not grant mailbox sending. Branded invitations from a user's mailbox need backend work and mail authorization.

Coffee-link `finalize-match` creates a match/thread and returns `shouldPromptBookChat: true`; it does not book a meeting. Public CRM `/meetings/join/resolve` and `/meetings/join/token` join existing LiveKit meetings, not accept invitations or book slots.

The iOS public profile component includes identity/photos, professional and education details, social links, coffee-chat topics, prompts, projects, work experience and activity/rating information. The existing anonymous coffee-link profile is narrower. The authenticated profile serializer contains email/phone, so the branded email must use an explicitly safe projection of intended visible profile content rather than serialize that response wholesale.

Current published backend narrative and implementation disagree on delivered calendar features. The backend handoff must require refreshed contracts grounded in the implementation.

Native investigation completed: sender proposes one/multiple slots using `/calendar/availability`; initial Accept opens slot selection; confirmation calls authenticated `/calendar/accept-event`, creates `AcceptedEvent` and marks the appointment accepted. Native decline calls `DELETE /match/delete-pending/:appointmentId`, deleting the pending appointment/slots. Native booked events appear in the Caffriend calendar; this path does not create Google/Outlook events. Existing CRM `CONFIRMED` instead means provider event creation succeeded, not recipient acceptance. New integration must bridge these meanings explicitly and support external recipients without pretending existing authenticated APIs already do so.

Prepared `docs/specs/ticket-5-backend-invitation-prompt.md` for the requested backend handoff checkpoint. It marks accountless recipient actions, proposed-slot acceptance, no indefinite slot reservation and decline behavior as proposed details requiring confirmation. No backend task has been dispatched; no implementation or outreach has occurred. The remaining CRM design tree is still open.

Profile fields, visual styling and available backend/native behavior are factual investigation items, not questions for the user to reconstruct.

## Backend checkpoint — confirmed

The user confirmed the complete backend prompt and its proposed details, then reported that backend implementation is complete. Accountless recipient responses, selected-slot confirmation, availability revalidation without indefinite reservation, confirmed decline without a mandatory reason, and explicit native/CRM booking mapping are now accepted requirements. Backend completion is user-reported until source/contract verification; no live delivery or staging verification is inferred.

The broader UX interview continues. This confirmation settles the invitation handoff, not the outstanding CRM design tree or frontend implementation authorization.

## Backend verification after user confirmation

Read-only source inspection of clean backend HEAD `8bad8d1` confirms new `crm-outreach` implementation: own-mailbox authorization/status/revocation, invitation preview/send/status/revocation and public resolve/decision operations. Workspace routes include `POST meeting-outreach/preview`, `POST meeting-outreach`, `GET meeting-outreach/:id`; public actions are `POST /meeting-invitations/resolve` and `/meeting-invitations/decide`. Templates target web `/invitation/{token}`. No real-provider verification was performed in this interview.

Material discrepancies against the accepted handoff remain:

- `src/modules/crm-outreach/outreach.service.ts` acceptance creates a CRM `Meeting` with `BOOKED` status but does not provision the provider event/conference or map to native `AcceptedEvent`. Its inline comment explicitly distinguishes this from provider confirmation. The full booked-to-calendar/join journey is therefore not established.
- Availability revalidation considers workspace CRM meetings, not provider free/busy or native bookings. External calendar conflicts are not yet covered by this acceptance path.
- `src/modules/crm-outreach/template.ts` renders a text-based sender section without the available avatar and uses hardcoded warm brown colors. The profile projection omits topics/prompts. Full iOS profile-card/theme parity has not been met.
- Public decisions are guest-only. Existing-account identity mapping and reconciliation for an uncertain email-send outcome are not established by the new routes.

These are implementation gaps against confirmed decisions, not invitations to reduce the accepted scope. Frontend integration must not label an internal `BOOKED` row as provider-scheduled or infer a native booking. Preserve these items for backend follow-up while continuing independent product decisions.

## Round 3 — user answers and accepted decisions

- Q7: Separate Career and Agency workspaces, each with its own people, pipelines and access, under the same account.
- Q8: The user accepted last-used Pipeline as the CRM return destination, alongside an added requirement for five consumer desktop screens: Home, Connections, Upcoming Calls, Leaderboard and Profile.

## Added desktop presentation work

The user supplied a concrete implementation request targeting the existing Expo app hooks and components in the adjacent `Caffriend` repository. It adds a shared platform-gated desktop shell, table, URL-driven filter bar and reusable profile modal while retaining iOS presentation and existing query/API layers. Profile reuses the existing profile/edit components. No new dependencies, endpoints or data layer are allowed; duplicate wrappers and existing query-key defects must not be changed as collateral work.

Read `Caffriend/AGENTS.md` and `CLAUDE.md`, then ran `scripts/ai/preflight.sh` before application edits. Result: `preflight: BLOCKED`, with `Contract refresh failed: Backend published snapshot is stale/dirty; regenerate in backend-owned task`. No application code changed. Backend publication must be repaired by its owner before contract-dependent implementation. Placement/navigation between these consumer desktop screens and the separate Next.js workspace CRM remains an unresolved end-to-end product boundary; do not silently combine their data or permissions.
