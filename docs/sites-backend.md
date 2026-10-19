# Supported Sites backend assessment

Inspected on 2026-10-19. This is an implementation assessment, not a deployed backend. No Site registration, resource provisioning, migration application, access-policy change, identity change or deployment was performed.

## Supported platform capabilities

The current Sites skill's Storage, Identity and Secrets references and Vinext starter README explicitly support:

- **D1 structured persistence**: declare the logical binding in `.openai/hosting.json` (the starter normally uses `DB`). Sites provisions and connects hosted resources during its supported workflow. The starter includes `db/index.ts`, an empty `db/schema.ts`, Drizzle generation and local D1 migration support.
- **R2 file storage**: optional `BUCKET` binding accessed server-side via the Worker environment. This fits future private original card photos, not yet supplied. Leave unused R2 bindings null until the photo workflow is implemented.
- **Durable visitor identity**: dispatch supplies `oai-authenticated-user-id` and email to signed-in requests. The user ID is stable within the same Site. Use the ID, not email, as the ownership key.
- **Public reading with authenticated writing**: public Sites may receive anonymous requests. Server routes can require identity for sign/publish/edit/remove while keeping browsing public. Sign-in must use the starter's server-only helpers and top-level navigation to the dispatch-owned route. Do not create OAuth endpoints or trust client-supplied identity.
- **Local backend development**: the portable Vinext starter supports local bindings, D1 migration application and loopback-only mock sign-in. Local and hosted databases are separate. Local development does not require deploying a Site.

A separate external database or identity provider is therefore **not required**. No claim is made that the current static React/Vite app already has these features.

## Recommended implementation continuation

1. Preserve the current frontend and evidence. Adapt it into the supported Vinext starter using the Sites source workflow; keep approved assets and the single-card interaction.
2. Implement same-origin routes from `backend-contract.md`. Use site-scoped user IDs for ownership; remove the public client’s dependence on session-only bearer capabilities once authenticated ownership is in place. Keep the explicit demo adapter separate.
3. Model pages, signatures, idempotency receipts, bounded rate-limit counters, private reports, and review/audit records in D1. Keep demo fixtures out of migrations and public seed data. Register source image provenance for future imports without fabricating records.
4. Generate and inspect schema-only migrations. Apply them only to the local preview database for testing. Use a single conditional insert/update or a reviewed database transaction strategy to enforce collision and idempotency checks atomically under concurrent requests. Do not implement create-table statements in request handlers.
5. Implement real request validation, rate limits, owner authorization and moderation/report handling. Platform storage and sign-in do not automatically provide application moderation or abuse protection. Organizer authorization still needs an explicit approved policy; signing in alone does not prove workspace or organizer membership.
6. Run server acceptance tests locally, including two independent users, cross-session edit/remove, overlapping concurrent writes, spoofed identity attempts, rejected demo/unreviewed imports, private reports and throttling. Use the starter's mock identity only for local loopback development; never bundle it into production.
7. Only after review and needed approval, register a private Site, preserve its returned project ID, declare the D1 binding, synchronize/package source and deploy through the supported Sites tools. Do not invent project IDs, manually provision services, apply hosted migrations or change access policies during the inspection phase.

## Remaining decisions and limits

- No supported Site project has been selected/registered, so there is no hosted database or verified runtime identity for this app yet.
- Whether visitors must sign in to publish changes the signing flow and should be confirmed before enabling public writes. ChatGPT sign-in is the supported option; anonymous owner capabilities would need their own durable recovery design.
- Moderator identities/access policy and pre- versus post-publication review remain undefined. A public launch needs actual moderation operations, not only health flags.
- The exact artwork still needs to be supplied and its writing regions verified. Storage support does not remove that design blocker.

Sources inspected: Sites `references/storage.md`, `references/identity-and-secrets.md`, `templates/vinext-starter/README.md`, and `templates/worker-esm-starter/README.md`. The Worker ESM starter has a different embedded-asset constraint and is not the selected recommendation for preserving this app's standalone original artwork assets and adding structured persistence.
