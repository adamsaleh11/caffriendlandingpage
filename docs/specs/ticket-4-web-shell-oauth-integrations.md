# Ticket 4 — Web shell, OAuth consent and integrations

## Problem Statement

Caffriend users need a desktop CRM that they enter after login without changing the public marketing site or replacing the native consumer app. They need to choose a workspace, navigate ordinary CRM areas, grant an MCP application scoped access, and optionally connect Google or Outlook calendars. Missing integrations and recoverable failures must not prevent ordinary CRM navigation.

## Solution

Keep the public landing page at `/`. Provide existing-account login at `/login` and a separate authenticated desktop CRM under `/app`. Deliver workspace entry, accessible navigation, purposeful business-page shell states, Settings integration controls, and MCP consent. Use the separately maintained backend for identity, workspace authorization, OAuth validation, provider token exchange and persistence.

This spec resolves remaining interview choices using repository evidence. No further design interview is required. Implementation remains to be performed.

## User Stories

1. As a visitor, I want the existing landing page, metadata, links and early-access form preserved, so that public behavior stays familiar.
2. As an existing Caffriend user, I want to log in with my existing credentials, so that I do not need another identity.
3. As a user, I want login validation and actionable authentication errors, so that I can correct mistakes.
4. As a signed-out user, I want protected links to send me through login, so that private workspace content is not exposed.
5. As a user following a CRM link, I want to resume that authorized destination after login, so that I can continue my task.
6. As a user with no workspaces, I want to create one, so that I can enter the CRM.
7. As a user creating a workspace, I want name validation and honest submission failures, so that I know whether creation succeeded.
8. As a user with one workspace, I want to enter it automatically, so that I avoid unnecessary selection.
9. As a user with several workspaces, I want my last valid selection restored, so that I can resume work.
10. As a user without a valid remembered workspace, I want an explicit chooser, so that I enter the intended workspace.
11. As a workspace user, I want to switch workspaces, so that I can work across authorized contexts.
12. As a user whose membership changed, I want unavailable access explained without disclosing another workspace, so that I can recover safely.
13. As a user, I want People, Pipeline, Inbox, Agents, Calendar and Settings navigation, so that I can understand and access the CRM.
14. As a user without AI or a calendar connection, I want all ordinary navigation available, so that optional integrations do not become prerequisites.
15. As a user viewing unfinished business areas, I want purposeful shell states without invented records or counts, so that I can trust what I see.
16. As a keyboard user, I want visible focus, labeled controls, a skip link and logical navigation order, so that I can operate the CRM.
17. As a tablet user, I want usable navigation and controls without horizontal overflow, so that I can work away from a desktop.
18. As a user, I want loading, empty, forbidden, not-found and retryable-error states, so that I understand the current situation.
19. As a user with an expired session, I want authenticated state cleared and login offered, so that I can recover safely.
20. As a user, I want a user menu and sign-out action, so that I control access on this browser.
21. As an MCP user, I want to see the verified requesting application, so that I know who is asking for access.
22. As an MCP user, I want to inspect requested scopes and sensitive-action warnings, so that I understand the grant.
23. As an MCP user, I want to confirm an eligible workspace, so that access is bound to the intended workspace.
24. As an MCP user, I want explicit offline-access consent when requested, so that continued access is intentional.
25. As an MCP user, I want Allow and Cancel, so that I control whether authorization proceeds.
26. As an MCP user with an invalid or expired request, I want a safe recovery state, so that I can restart from the requesting application.
27. As a workspace user, I want separate Google Calendar and Outlook Calendar connection actions, so that I can choose my provider.
28. As a user, I want to know which provider I am being redirected to, so that the connection flow is understandable.
29. As a user returning from a provider, I want accurate success, cancellation or failure feedback, so that I know what happened.
30. As a connected user, I want to select an available writable calendar, so that future calendar actions target the intended calendar.
31. As a connected user, I want to inspect the account identifier, selected calendar, granted access and last error, so that I can assess connection health.
32. As a connected user, I want to disconnect, so that Caffriend stops using that connection without deleting meeting history.
33. As a user whose provider is unavailable or unconfigured, I want an actionable status and an available CRM, so that I can continue working.
34. As a user, I want credentials and authorization codes excluded from page content, analytics and persistent browser history, so that connection flows limit exposure.

## Implementation Decisions

### Ownership and routes

- Implement in the existing Next.js repository. Keep the Expo native consumer app and backend in their separate repositories. No direct browser database or provider API access.
- Preserve `/`, including its existing metadata, fonts, content, public links, video and early-access submission behavior. Scope CRM styling and providers so they do not alter the landing page.
- Provide `/login`, `/app`, `/app/workspaces/new`, `/app/[workspaceId]/people`, `/app/[workspaceId]/pipeline`, `/app/[workspaceId]/inbox`, `/app/[workspaceId]/agents`, `/app/[workspaceId]/calendar`, `/app/[workspaceId]/settings` and `/oauth/authorize`.
- `/app` performs workspace entry or displays the workspace chooser. People is the default destination. Valid authorized deep links take precedence over the remembered workspace. Workspace switching keeps the current section when supported, otherwise enters People.
- Add the frontend server callback route `/crm-calendar/callback/[provider]`. This path exists on the frontend origin; the backend route with the same path remains on the backend origin.
- Business sections are purposeful shell states until Ticket 5. Settings implements calendar management. Do not fabricate records, metrics, account emails, connection health or completed features.

### Authentication and API boundary

- Use a same-origin Next.js server boundary and a centralized typed backend client. Forward the existing bearer JWT upstream; do not build a new identity system. Allowlist operations and backend origin; do not provide a general URL proxy.
- Login calls `POST /user/login` with `{email,password}`. The backend's email field also accepts a phone number. Device fields remain optional; do not fabricate native device identifiers. Decode the existing consumer response envelope explicitly and project only the minimal user identity needed by the shell. New workspace/CRM responses use their own documented shapes.
- Store the JWT only inside an authenticated-encrypted, HttpOnly, SameSite=Lax cookie, Secure in HTTPS environments, with a host-only scope and a maximum eight-hour absolute lifetime capped by upstream expiry. Use deployment-managed encryption material and an established maintained sealing implementation. Never put a plaintext JWT or the full user response in a cookie. No localStorage/sessionStorage bearer tokens and no silent extension of the backend's token lifetime.
- Browser code calls only same-origin web endpoints. Check same-origin Origin and CSRF protection on state-changing endpoints, including login/logout; allow only the intentional provider callback exception. Authenticated pages and responses are private/no-store.
- On upstream 401, expire the session, clear user/workspace/integration caches and remembered selection, and return to login through a validated internal destination. Treat 403 and 404 separately without clearing a valid session. Guard both page entry and server operations; a cookie's presence alone is not authorization.
- Accept only canonical internal CRM destinations for login return paths. Reject external/protocol-relative URLs, backslashes, control characters, encoded bypasses and unexpected routes. Default to `/app`. Keep opaque MCP request continuation in a separate short-lived protected cookie rather than embedding it in a login return URL.
- Sign-out clears the web session and client state, including other open tabs on notification or next activity. This is local web sign-out; the existing backend does not provide global revocation of its login JWT. Do not promise global device logout.
- Use server-only `CAFFRIEND_API_ORIGIN`, `CAFFRIEND_WEB_ORIGIN` and `CAFFRIEND_SESSION_SECRET`, documented by names only. HTTPS is required outside local development. Do not copy secrets from local environments into source.
- Preserve upstream idempotency conventions. Calendar select/disconnect require `Idempotency-Key`; reuse the same key for retries of the same submitted operation, and use a new key after input changes. Workspace creation has no observed idempotency contract: disable duplicate submission and reconcile an ambiguous response with a fresh workspace list before offering another creation.

### Workspace entry and shell

- `GET /workspaces` returns the authoritative workspace array. `POST /workspaces` accepts `{name}` and returns the created workspace; `GET /workspaces/:workspaceId` authorizes workspace entry. Names must contain non-whitespace text and be at most 200 characters.
- Zero workspaces leads to creation; one enters automatically; multiple restore a valid selection or show a chooser. Remember selection per authenticated session; revalidate it against the server. Clear stale selection when access changes.
- Workspace IDs must come from server data and be validated before use. A URL or remembered value never grants membership. Prevent stale responses from a previously selected workspace appearing after a switch.
- Provide semantic sidebar/navigation, active-page indication, workspace switcher, user/sign-out menu, loading feedback, recovery actions and a skip-to-content link. Menus must work with keyboard and Escape and return focus appropriately.
- Desktop-first layout uses a sidebar; tablet/narrow layouts use a collapsible navigation control. Verify at 1280, 1024, 768 and 390 CSS pixels. Do not replace the native app or add a mandatory app-download gate.

### MCP consent

- The backend authorization endpoint validates registered client, redirect, state, resource, scope and PKCE, then sends a five-minute opaque request to the frontend consent URL. Capture that request into protected short-lived continuation state and replace/redirect to a clean consent URL before rendering third-party resources.
- Retrieve `GET /oauth/consent?request=...` server-side, then submit `POST /oauth/consent` with `{request,workspaceId,approved,offlineConsent}`. No browser token exchange is implemented.
- Preserve the existing workspace-bound client model. Present only server-returned eligible workspaces; currently this means confirming one workspace. If none is eligible, show unavailable access and a local exit. Do not offer arbitrary workspaces or create a workspace to bypass client binding. This explicitly narrows the original ticket's general workspace-choice wording.
- Display requested scopes verbatim with readable explanations and the backend warnings. Explicitly distinguish immediately permitted notes/tasks from proposals requiring approval. Request explicit offline consent only when `offline_access` is requested; keep Allow disabled until all required consent is provided.
- The current consent response lacks requesting client identity. Required additive backend follow-up: return verified `client: {id,name}` from the registered client with the existing consent details. Until available, fail closed for Allow with an actionable unavailable state; never trust a query-string app name or invent an identity. Full consent acceptance requires this addition.
- Allow and Cancel use the backend's returned redirect, never a browser-supplied redirect URI. The backend remains the authority for exact registration matching. Require a valid HTTPS result and do not automatically follow upstream redirects in the server client. Complete with replacement navigation or a server redirect from the POST response; do not render the resulting authorization code in HTML or JSON sent to the browser app.
- If cancellation cannot be processed because membership/request validity is lost, exit locally without constructing a third-party redirect. Expired requests must restart at the requesting application; never silently renew or approve them.
- Use no-store and no-referrer policies. Exclude consent/callback parameters and authorization headers from application logs, telemetry and error reports; document equivalent ingress/APM redaction requirements. The receiving OAuth client controls its own history after navigation.

### Google and Outlook integration

- Use `GET /workspaces/:workspaceId/calendar-connections/status` for provider availability and paginated `GET /workspaces/:workspaceId/calendar-connections` for the caller's connections. Follow pagination so existing connections are not silently omitted.
- Connect calls `POST /workspaces/:workspaceId/calendar-connections/GOOGLE/connect` or `/MICROSOFT/connect`, which returns `{redirect}`. Validate the expected HTTPS provider authorization origin. Before navigation, store a bounded, encrypted five-minute pending flow containing provider, workspace and a hash of the returned state. Support several pending flows by state to avoid cross-tab mismatches; consume each once.
- Configure `CRM_GOOGLE_REDIRECT_URI` and `CRM_MICROSOFT_REDIRECT_URI` to the exact HTTPS frontend callback URLs, and register those same URLs with the providers. The backend token exchange already uses these configuration values, so the redirect URI supplied during authorization and exchange stays identical. This is a required deployment change, not a provider API call from the browser.
- On callback success, the frontend server validates the pending flow and provider, then relays state/code server-to-server to the existing backend callback. The backend still validates state, ownership, expiry and PKCE and performs the exchange. Parse its projected result without exposing codes or tokens, consume the pending flow and immediately redirect to clean Settings. Store only a short-lived non-secret result for feedback.
- On provider cancellation/error, consume the matching frontend pending flow and redirect to Settings with sanitized failure feedback; do not send an absent code to the backend. The unconsumed backend state expires naturally after five minutes. Never echo raw provider error descriptions into logs or HTML.
- Invalid, missing, replayed or wrong-provider state produces a safe error and no exchange. If the web session expired, retain only the validated non-secret recovery destination and ask for login/reconnection; do not preserve authorization codes for replay.
- A successful exchange returns `SELECT_CALENDAR`, not a fully configured connection. Fetch writable calendars using `GET /workspaces/:workspaceId/calendar-connections/:id/calendars`, and save with `POST .../:id/select` and `{calendarId}`. Re-fetch authoritative connection state after mutations. A timeout is unconfirmed until reconciliation, never automatically successful.
- Display the provider account identifier actually returned. Do not label an opaque ID as an email. Display selected calendar names when supplied by the calendar-list API, otherwise use the real ID or selection-needed state. Show projected status and sanitized `errorCode`; absent error data does not prove overall provider health.
- Current connection projection omits scopes. Required additive backend follow-up: expose stored granted `scopes: string[]` in the caller's safe calendar-connection projection, never token references. Until delivered, show “Granted access unavailable”; do not substitute configured/requested scopes. Full granted-access acceptance requires the projection addition.
- Disconnect uses `POST .../:id/disconnect` with idempotency protection, pending feedback and an explicit confirmation explaining that historical meetings remain. It erases/disables this connection; do not claim it revokes unrelated provider grants or cancels existing invitations.
- Missing provider configuration shows a disabled connect action with actionable feedback. All ordinary CRM navigation remains usable. Connecting, selection failure, disconnected, expired/error and retry states are distinct.

### Delivery and dependencies

- Tickets 1 and 2 are implemented in the nearby backend source, but their live deployment and provider registrations are unverified. Validate staging readiness separately; source-level CORS evidence is not a live smoke test.
- Backend source allows the production web origins and Authorization/Idempotency-Key. This design primarily uses server-to-server calls, but deployment origins, HTTPS, callback routing and ingress redaction must still be checked.
- Implement frontend changes in this repository. The two safe response additions are separately owned backend follow-ups and must be coordinated before end-to-end acceptance; they do not justify moving backend code into this repository. Mock their agreed shapes while clearly marking these dependencies.
- Repair the existing invalid package manifest trailing comma and configure working lint/test scripts as necessary for deterministic verification. Preserve the existing public application behavior.

## Testing Decisions

- Use the highest practical seam: real browser interactions against a locally running Next.js app whose configured backend origin points at a deterministic mock HTTP server. This exercises the server session boundary and upstream contracts; browser-only request interception is insufficient for server-side fetches.
- Add the smallest Playwright setup and mock backend harness. There are no existing application tests to extend; existing hook tests are not web-test precedent. Avoid snapshots of component internals and tests that mirror implementation structure.
- Assert observable outcomes: destination, visible state, accessible controls, HTTP operations at the mocked backend, cookies/security headers and absence of secrets in browser responses/URLs. Add focused pure security tests only where redirect/cookie/flow validation edge cases are clearer below the browser seam.
- Cover landing content/metadata, existing links/video and early-access success/failure without real email delivery. Isolate public email transport in test execution; do not contact Resend.
- Cover invalid login, success, failed upstream login, zero/one/multiple workspaces, creation validation/failure/ambiguous response, last-selection restoration, revoked membership, direct protected navigation and cross-workspace stale-response prevention.
- Cover expired/tampered cookies, upstream 401 state clearing, sign-out, CSRF rejection, valid deep links, external and encoded redirect attacks, and 403/404/retry states. Verify authenticated responses are not shared-cacheable and bearer tokens are not returned to browser JavaScript.
- Cover MCP requesting identity, workspace-bound eligibility, no eligible workspace, each scope explanation, required offline consent, Allow, Cancel, expiry, missing identity fail-closed behavior, malicious redirects and removal of request/code parameters from the web app's final URL.
- Cover Google and Microsoft connect redirects, disabled configuration, callback success, denial, provider/backend failure, replayed/mismatched state, expired session, calendar selection, scopes unavailable/available, account identifiers, disconnect/retry and paginated connections. Exercise the frontend server callback relay with the actual backend JSON shape in the mock.
- Verify navigation without AI/calendar, keyboard traversal and focus recovery, accessible names and active-page state. Use automated accessibility checks for core screens and manual browser inspection for keyboard behavior and tablet layout. Inspect desktop/tablet screenshots and long names/error text; fix overflow and focus issues.
- Run production build, typecheck, lint and deterministic tests. Do not claim real OAuth integration from mocks. Staging smoke tests require configured backend/provider applications and verify both callback URLs, token redaction, consent return and connection selection/disconnect.

## Out of Scope

- Landing redesign, native app changes, new backend identity, global JWT revocation, signup/password-recovery/social-login expansion, billing or SSO.
- Full People/Pipeline/Inbox/Agents/Calendar business screens, meeting creation or cancellation, CRM CRUD, provider synchronization, outreach and AI execution.
- Arbitrary-workspace OAuth clients, OAuth token exchange in browser code, database/provider API access from browser code, raw token displays or invented data.
- Backend schema changes, migrations, backend deployment, production publishing and provider app registration execution in the frontend implementation task. Required configuration and additive response dependencies are documented and coordinated separately.

## Further Notes

- The user's settled direction is explicit: the CRM is a separate authenticated page area entered after login; the backend remains in its separate repository. The user authorized resolving remaining questions without further interviewing.
- Authentication uses the recommended encrypted HttpOnly cookie boundary. This limits JavaScript token exposure but does not make XSS harmless and does not add upstream revocation. Document cookie lifetime, encryption-key operation, local logout limitations and required web security controls.
- The original workspace-choice acceptance is amended to confirmation of the server's eligible workspace for the current workspace-bound client contract. No other acceptance requirement is silently removed.
- Completion means public behavior is preserved; the authenticated shell and recovery flows work; consent and both calendar flows meet the specified safe contracts; tests/typecheck/lint/build pass; and deployment prerequisites and backend projection dependencies are recorded honestly. Missing projection additions or unverified provider configuration must be reported as remaining integration limitations, not described as completed end-to-end behavior.
