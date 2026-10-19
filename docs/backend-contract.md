# Application backend contract

The application API in `server/api.ts` is implemented against Cloudflare D1 and locally tested using Miniflare D1/R2. `server/sites.ts` composes it with the official Sites identity helpers supplied by a server route. **Canonical Sites runtime/auth integration remains blocked:** the official starter/helper source files are unavailable through the current skill resource interface. No Site, hosted resources or deployment exists.

The default UI remains an explicit in-memory demo. The HTTP adapter never falls back to fixtures. No original attendees, photos or OCR output were seeded.

## Identity and requests

Browsing is anonymous-compatible. Signing, editing, removing and reporting require the stable per-Site `userId` returned by Sites' server-only `getChatGPTUser()`. Neither email, browser JSON, raw identity headers nor bearer tokens establish ownership. `/api/me` provides durable account ownership across sessions/devices. Capability tokens remain only in the isolated demo; the HTTP adapter sends none.

Writes require exact same-origin Origin, reject cross-site fetch context, accept JSON only, cap bodies at 8 KiB and reject unknown fields. Responses use no-store; no permissive CORS is emitted. Hosted dispatch authentication still needs end-to-end verification after canonical integration. Tests inject trusted synthetic identities, not production login tokens.

## Application API

These are this app's routes, not Sites platform endpoints.

| Route                               | Behavior                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET /api/health                     | ChatGPT identity/review-required mode and actual application capabilities. Writes require verified artwork and configured moderators.                                           |
| GET /api/guestbook                  | Approved public signatures and pages only; no owners, submission keys, reports, pending records or photo bytes.                                                                 |
| GET /api/me                         | Private sign-in state, official-helper sign-in path, moderator flag and own pending/public/rejected signatures with versions.                                                   |
| POST /api/signatures                | draft, idempotencyKey and consent=true; reserves an existing-page position and returns pending.                                                                                 |
| PATCH /api/signatures/:id           | draft, version and consent=true; same account/original page only; edit returns to review.                                                                                       |
| DELETE /api/signatures/:id          | Current version, same account; removes visibility and scrubs name/social/provenance content, retaining an idempotency tombstone.                                                |
| POST /api/signatures/:id/reports    | Private 5–500-character reason; authenticated, deduplicated and rate limited.                                                                                                   |
| GET /api/moderation                 | Configured organizers only: pending signatures and open reports, up to 100 each. Processing entries exposes the next queued entries.                                            |
| POST /api/moderation/pages          | Organizer-only creation of stable page ID/order and optional actual source identities. Always uses delhincr-print-v3. No visitor Add page action.                               |
| POST /api/moderation/signatures/:id | approve, reject or hide; current version and review note required. Hide removes a reported public signature. Review and audit are transactional.                                |
| POST /api/moderation/reports/:id    | Organizer-only resolved/dismissed decision and note.                                                                                                                            |
| POST /api/moderation/sources        | Registers an existing private R2 PNG/JPEG after checking actual bytes against supplied SHA-256; preserves physical card and page IDs separately. No upload or fabricated photo. |
| POST /api/moderation/imports        | Creates a pending candidate from registered sourceId, normalized draft, actual extraction metadata and idempotency key. No automatic OCR/publication.                           |

Import approval also requires explicit confirmTranscription=true and confirmConsent=true, and rechecks the original R2 object checksum. Missing/changed original bytes block approval. A human must review before confirming. Provenance retains source card/page, original asset/hash, extracted text/handles, actual confidence or null, and review status.

## Integrity and limits

- Bound SQL parameters; names 2–28 characters; allowlisted font/ink; up to two validated HTTPS profiles with URL-derived labels. Unsupported protocols/domains/credentials/ports, controls, markup and out-of-zone coordinates are rejected server-side.
- Collision checks are inside create/update SQL, covering pending and public reservations. Concurrent visitors cannot claim the same space. No signature is moved silently.
- Unique owner/idempotency keys reject changed payloads, coalesce concurrent retries and prevent removed records from being resurrected.
- Persistent atomic D1 quotas: 5 new visitor submissions/hour/account, 10 report attempts/hour/account, 60 mutation attempts/hour/account, plus 120 mutations/minute globally. Expired counters are pruned. This is bounded application abuse control, not comprehensive distributed-attack protection.
- Version checks reject stale owner writes and competing review decisions. D1 batch commits review and audit together.
- Schema constraints reject demo provenance and public unreviewed imports. Generated migrations are schema-only, with no attendees, page seeds or source records.
- Removal scrubs signature content while minimal tombstones and existing private reports/audits remain. Retention and operational moderation policy need organizer approval before launch.

## Validation and remaining work

Run `npm run check:server` and `npm run test:server`. Tests use real local Miniflare D1, generated migrations, synthetic users and a one-pixel synthetic PNG. All fixtures are isolated and removed. Persistence is tested by restarting the runtime over the same temporary database; this is not browser storage or a mocked repository.

Still required: canonical Sites starter/helper source and route integration; actual dispatch sign-in verification; exact artwork and verified writing regions; real moderator Site user IDs; organizer workflow/retention review; and approval before hosted provisioning/deployment. No external backend/identity provider is inherently required.

Primary references: [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [D1 database and batch](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Miniflare D1](https://developers.cloudflare.com/workers/testing/miniflare/storage/d1/), and the Sites Storage, Identity and Secrets and Vinext starter references.
