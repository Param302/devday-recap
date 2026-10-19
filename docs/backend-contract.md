# Backend contract — not yet implemented

The current repository contains a frontend adapter, not a server. Shared persistence, server rate limiting, moderation, reports and durable ownership are **not implemented**. Sites provides a supported implementation path using D1 and dispatch-owned ChatGPT sign-in; a separate external backend or identity provider is not required. Implement and test the server before enabling public mode, then obtain the needed approval before provisioning/deployment. No hosted resources have been created. Do not put service credentials in Vite environment variables or browser bundles. See [the Sites backend assessment](sites-backend.md).

## JSON API, same origin

`VITE_GUESTBOOK_API=/api` selects these endpoints. JSON errors must contain safe user-facing messages without internal details; the current client uses its own bounded error messages. Apply request body limits, appropriate status codes, same-origin protections, and no permissive credentialed CORS.

| Endpoint                           | Behavior                                                                                                                                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                  | `{ mode: "public", capabilities: { moderation: true, rateLimit: true, ownerControls: true } }`. Set only for actually implemented capabilities.                                                                                                      |
| `GET /api/guestbook`               | `{ pages: CardPage[], signatures: Signature[] }`; only approved public records, never drafts, owner secrets, demo fixtures, reports or original private photos.                                                                                      |
| `POST /api/signatures`             | `{ draft, idempotencyKey }`; explicit publication after consent. Respond with `{ signature, ownerToken }` or a pending moderation receipt requiring a future client state. Current client supports immediately public, server-approved records only. |
| `PATCH /api/signatures/:id`        | New draft. Verify the bearer owner capability, revalidate position/links and moderation. Respond with the updated public signature.                                                                                                                  |
| `DELETE /api/signatures/:id`       | Verify owner capability, remove public record, return 204. Retention/deletion policies need owner approval.                                                                                                                                          |
| `POST /api/signatures/:id/reports` | `{ reason }`, 5–500 characters; store privately, deduplicate/rate limit, enqueue moderator review. Return 204.                                                                                                                                       |

## Server requirements before public use

- Use a persistent store. Pre-create pages as an organizer action; visitors always sign an existing page. Store stable page IDs and normalized coordinates. No visitor Add page action.
- Validate and normalize every field independently of the client: 2–28-character name, allowed font/ink, maximum two allowlisted HTTPS social profiles, no credentials or nonstandard ports, no markup/control characters. Derive link labels from validated URLs. Validate finite coordinates and artwork clear-space bounds.
- Check collision bounds **atomically with the write**. Two concurrent visitors cannot claim the same space. Return a conflict requiring a new preview; never move a published signature silently.
- Enforce bounded request sizes, per-session/account and network rate limits, duplicate suppression and idempotency server-side. The demo's 10-second memory timer is not a security control.
- Moderate names/links and incoming reports. Supply organizer moderation access through an approved identity system; the frontend does not include an unsecured admin route. Decide and document pre- versus post-publication moderation. If using pending publication, implement a pending receipt state before enabling the client.
- Use high-entropy owner capabilities stored as hashes with expiry/revocation, or authenticated ownership. Never return capabilities in public snapshots, URLs, logs or analytics. The current UI holds owner tokens only in session memory. It can edit/remove in the same open session; a durable account/recovery mechanism is still a **launch blocker**. Do not claim recovery exists.
- Use appropriate same-origin CSRF/origin validation for cookie-authenticated actions. Restrict cache behavior for owner responses. Avoid third-party analytics and private report data in frontend errors.
- Reject demo provenance in all public ingestion paths. Event-card imports require original source image identity/hash, source card/page IDs, and explicit reviewed approval. Ambiguous handwriting stays pending.

## Acceptance checks to run against the real backend

1. Read a publication from two independent browsers; refresh both and verify persistence.
2. Submit two overlapping drafts concurrently; exactly one succeeds. Confirm normalized placement remains stable after a mobile/desktop resize.
3. Replay an idempotency key across timeouts; at most one record exists. Check uncertain mutation outcomes before retrying.
4. Call create/update/delete without or with another owner's capability; all unauthorized mutations fail. Test recovery, revocation and deletion after a new session.
5. Send abusive oversized bodies, invalid URLs, forged styles, invalid page IDs, out-of-bounds coordinates, unreviewed imports and demo records directly to the API. None may become public.
6. Trigger rate limiting and report/moderation actions. Confirm moderation changes appear in all readers and reports stay private.
7. Verify the exact original artwork and approved source mockups; no unreviewed writing region can be enabled.

No server acceptance tests have been run because no server exists yet.
