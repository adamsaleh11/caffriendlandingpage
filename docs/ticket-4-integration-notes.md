# Ticket 4 — deployment prerequisites and remaining integration limitations

This records what the frontend implementation assumes and what is *not* yet proven end to end.
Nothing here is a claim that real OAuth or provider integration has been exercised: every test in
this repository runs against a deterministic mock backend.

## Required server-only configuration

Documented by name only. Never copy real values into source or into a local `.env` that is committed.

| Name | Purpose |
| --- | --- |
| `CAFFRIEND_API_ORIGIN` | Backend origin for all server-to-server calls. HTTPS required outside local development. |
| `CAFFRIEND_WEB_ORIGIN` | Canonical frontend origin. Used for the same-origin check, cookie security and every internal redirect. HTTPS required in production. |
| `CAFFRIEND_SESSION_SECRET` | Deployment-managed sealing key for the encrypted session and flow cookies. Minimum 32 characters. |
| `EARLY_ACCESS_TRANSPORT` | Set to `inert` only in test execution, so the public early-access form never contacts Resend. |

## Required deployment changes (not performed here)

- Register the exact HTTPS frontend callback URLs with both providers and configure the backend's
  `CRM_GOOGLE_REDIRECT_URI` and `CRM_MICROSOFT_REDIRECT_URI` to those same URLs:
  - `https://<web-origin>/crm-calendar/callback/GOOGLE`
  - `https://<web-origin>/crm-calendar/callback/MICROSOFT`
  The redirect URI used during authorization and during the backend's token exchange must stay
  identical, so these three places have to agree.
- Point the backend's MCP consent URL at `https://<web-origin>/oauth/authorize`.
- Confirm the backend allows the production web origin and the `Authorization` and `Idempotency-Key`
  headers. The source-level CORS evidence from Tickets 1 and 2 is not a live smoke test.
- Configure ingress and APM redaction equivalent to the application's own: consent `request`
  parameters, provider `code`/`state` parameters and `Authorization` headers must not be logged.

## Backend response additions this frontend depends on

Both are additive, safe projections owned by the backend repository. Until they ship, the frontend
fails closed or says the data is unavailable rather than inventing it.

1. **Verified requesting client on the consent details.** `GET /oauth/consent` must return
   `client: { id, name }` from the registered client record. Until then `/oauth/authorize` renders
   "Requesting application unavailable" and offers no Allow button. A query-string application name
   is never trusted. **Full consent acceptance requires this.**
2. **Granted scopes on the calendar-connection projection.** The caller-safe connection projection
   must expose the stored granted `scopes: string[]` (never token references). Until then Settings
   shows "Granted access unavailable"; configured or requested scopes are deliberately not
   substituted. **Full granted-access acceptance requires this.**

## Known limitations, stated plainly

- Sign-out is local to this browser. The backend provides no global revocation of its login JWT, so
  the session cookie is cleared and other open tabs leave on notification or next activity. Nothing
  in the UI promises a device-wide logout.
- The encrypted HttpOnly cookie keeps the bearer token out of browser JavaScript. It does not make
  XSS harmless, and it adds no upstream revocation.
- Session lifetime is at most eight hours, further capped by the upstream token's own expiry. It is
  never silently extended.
- A timed-out calendar mutation is treated as unconfirmed and reconciled against the server, never
  reported as successful.
- An absent `errorCode` on a connection does not prove provider health, and the UI says so.
- Business sections (People, Pipeline, Inbox, Agents, Calendar) are purposeful shell states until
  Ticket 5. They show no records, counts or metrics.

## Staging smoke tests still to run

These need configured backend and provider applications and cannot be covered by the mock harness:
both callback URLs end to end, token and code redaction in real logs, a real MCP consent return, and
calendar selection and disconnect against live provider accounts.
