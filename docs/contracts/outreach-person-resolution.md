# Contract: resolving an outreach email to a person

**Status:** proposed — frontend is not built against this yet.
**Audience:** backend.
**Why:** today, inviting someone by email mints a bare `Person` carrying nothing but a
display name guessed from the email local-part. When that email belongs to someone the
sender is already connected with on Caffriend, the system already knows their name, job
title, company and location — and throws all of it away.

---

## 1. Two bugs to fix first

This feature is not worth building until these are fixed: it writes richer people into a
list that currently does not show them.

### 1.1 `GET /crm/people` omits people the workspace has

In workspace `20ec0248-82f4-414a-8a6d-d41d2573c8c5`:

| Person | `organizationId` | In `GET /crm/people`? | In `GET /crm/people/:id`? |
|---|---|---|---|
| Ignacio Fernandez | set | yes | yes |
| Shilpatel821 (`944520e4…`) | `null` | **no** | yes, `200` |
| Shilpatel821 (`4a7aa183…`) | `null` | **no** | yes, `200` |

Both missing rows have `archivedAt: null` and the correct `workspaceId`, and both are
referenced by an open engagement. The list returns `nextCursor: null`, so this is not
pagination, and `?search=` by both name and email returns empty too.

**Hypothesis:** the list query inner-joins the organization table, so a person with no
organization is dropped. That fits all three rows, but n=3 — please confirm against the
actual query rather than taking it as diagnosed.

The user-visible bug: *"I invited someone and they never appeared in People."*

### 1.2 Repeated person creation on the same email

The two `Shilpatel821` rows are duplicates — same email, same workspace, created two days
apart. The client calls `POST /crm/people` with a fresh `X-Idempotency-Key` each time the
composer's preview is rendered, so the key never dedupes. Fixing this properly needs the
server side of §2.3: the client must be able to find an existing person by email and reuse
it. A uniqueness constraint on `(workspaceId, lower(email))` would also stop it at the
source — say whether you want that, since it changes what a duplicate POST returns.

---

## 2. What we need

### 2.1 Endpoint

```
POST /workspaces/:workspaceId/crm/people/resolve
```

Batch, not per-address: the invite composer routinely sends to many recipients at once, and
a request per recipient is the fan-out we deliberately removed from the pipeline board.

**Request**

```json
{ "emails": ["sam.jones@acme.com", "nobody@example.com"] }
```

Emails are matched case-insensitively. Cap the batch at 100; reject larger with `400`.

**Response** — `200`, one entry per requested email, same order:

```json
{
  "items": [
    {
      "email": "sam.jones@acme.com",
      "status": "CONNECTION",
      "userId": "8f14e45f-…",
      "existingPersonId": null,
      "profile": {
        "displayName": "Sam Jones",
        "title": "Staff Engineer",
        "company": "Acme",
        "organizationId": "647fa3fc-…",
        "location": "Toronto",
        "sourceUrl": "https://www.linkedin.com/in/samjones",
        "image": "https://…/avatar.jpg"
      }
    },
    {
      "email": "nobody@example.com",
      "status": "NO_ACCOUNT",
      "userId": null,
      "existingPersonId": null,
      "profile": null
    }
  ]
}
```

### 2.2 `status` — exactly three values

| `status` | Meaning | `profile` |
|---|---|---|
| `CONNECTION` | Has a Caffriend account **and** is an accepted connection of the requesting user | populated |
| `ACCOUNT_NOT_CONNECTED` | Has a Caffriend account, but is **not** connected to the requesting user | `null` |
| `NO_ACCOUNT` | No Caffriend account for this email | `null` |

These three drive the alerts the sender sees, so they must stay distinct and must never be
collapsed into a boolean.

### 2.3 `existingPersonId`

If the workspace already has a non-archived `Person` with this email, return its id. The
client will reuse that record instead of creating a second one. This is what actually fixes
§1.2. Return `null` when there is none.

### 2.4 Privacy: `ACCOUNT_NOT_CONNECTED` returns no profile

**This is the part to get right.** A sender must not be able to harvest job title, employer,
location and photo for any email address they can type, simply by pasting addresses into the
invite box. That is an email-enumeration oracle over your whole user base.

So for `ACCOUNT_NOT_CONNECTED`, return the status and nothing else — no name, no `userId`
if you would rather not, no profile. The sender learns only "this person is on Caffriend",
which is what they need to decide whether to connect first.

If even that is considered too much disclosure, say so and we will drop
`ACCOUNT_NOT_CONNECTED` and fold it into `NO_ACCOUNT`. Worth rate-limiting this endpoint
per user regardless.

### 2.5 Field mapping

`profile` fields are named for the `Person` record they populate, so the client copies them
across without a translation table:

| `profile` field | Source on the connected user | Person field |
|---|---|---|
| `displayName` | first + last name | `displayName` |
| `title` | `jobTitle` | `title` |
| `company` | `company` | — resolves `organizationId` |
| `organizationId` | matched org in **this workspace**, else `null` | `organizationId` |
| `location` | `location` | `location` |
| `sourceUrl` | `linkedInUrl`, else `websiteUrl` | `sourceUrl` |
| `image` | profile image | display only |

Rules:

- Every field is nullable. Omit what you do not have — **do not substitute a placeholder**,
  and never send `"Unknown"`. A null means "not recorded" and the client renders it as such.
- `sourceUrl` must be `https`. The client rejects anything else.
- `organizationId` only when an organization already exists in that workspace. Do not create
  one as a side effect of a lookup; the client will create it explicitly if the user wants it.
- No phone, no billing, no contact fields beyond the above.

### 2.6 `sourceCategory`

A person created from a resolved connection should be distinguishable from one typed in by
hand. We would like `sourceCategory: "CONNECTION"`. **Please confirm the enum accepts a new
value** — if it does not, we will keep sending `MANUAL` and this is a non-blocking nicety.

### 2.7 Errors

| Case | Response |
|---|---|
| Caller not a member of the workspace | `403` |
| More than 100 emails | `400` |
| Malformed email in the list | entry with `status: "NO_ACCOUNT"`, not a `400` for the whole batch |

A failure of this endpoint must never block sending an invitation. The client treats it as
best-effort enrichment and falls back to today's behaviour.

---

## 3. What the frontend will do with it

So the shape is judged against real use:

1. On opening the invite composer, resolve all recipient emails in one call.
2. `CONNECTION` → pre-fill the new person from `profile`; reuse `existingPersonId` when set.
3. `ACCOUNT_NOT_CONNECTED` → create the bare person as today, plus an inline note:
   *"On Caffriend, but not connected to you — connect to message them before you meet."*
4. `NO_ACCOUNT` → create the bare person as today, plus:
   *"No Caffriend account — they will answer from the email link as a guest."*
5. Endpoint unavailable → today's behaviour exactly, no alerts, invitation still sends.

---

## 4. Open questions

1. Is §1.1 the organization join, or something else?
2. Do you want a `(workspaceId, lower(email))` uniqueness constraint on `Person`?
3. Is `ACCOUNT_NOT_CONNECTED` acceptable disclosure, or should it fold into `NO_ACCOUNT`?
4. Can `sourceCategory` take `CONNECTION`?
