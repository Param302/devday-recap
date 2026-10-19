# Supported Sites backend assessment

Inspected on 2026-10-19. The application D1 backend is now implemented and locally tested; the canonical Sites runtime remains to be integrated. No Site registration, hosted resource provisioning, hosted migration application, access-policy change or deployment was performed. Generated migrations were applied only to isolated local test databases.

## Supported platform capabilities

The current Sites skill's Storage, Identity and Secrets references and Vinext starter README explicitly support:

- **D1 structured persistence**: declare the logical binding in `.openai/hosting.json` (the starter normally uses `DB`). Sites provisions and connects hosted resources during its supported workflow. The starter includes `db/index.ts`, an empty `db/schema.ts`, Drizzle generation and local D1 migration support.
- **R2 file storage**: optional `BUCKET` binding accessed server-side via the Worker environment. This fits future private original card photos, not yet supplied. Leave unused R2 bindings null until the photo workflow is implemented.
- **Durable visitor identity**: dispatch supplies `oai-authenticated-user-id` and email to signed-in requests. The user ID is stable within the same Site. Use the ID, not email, as the ownership key.
- **Public reading with authenticated writing**: public Sites may receive anonymous requests. Server routes can require identity for sign/publish/edit/remove while keeping browsing public. Sign-in must use the starter's server-only helpers and top-level navigation to the dispatch-owned route. Do not create OAuth endpoints or trust client-supplied identity.
- **Local backend development**: the portable Vinext starter supports local bindings, D1 migration application and loopback-only mock sign-in. Local and hosted databases are separate. Local development does not require deploying a Site.

A separate external database or identity provider is therefore **not required**. No claim is made that the current static React/Vite app already has these features.

## Implemented locally

`server/api.ts` implements D1 persistence, durable account ownership, pending publication, organizer approval/rejection/hiding, private reports, optimistic versions, atomic position reservations, idempotency and persistent rate limits. `db/schema.ts` and generated `drizzle/` migrations model the data, private provenance, original-image registry and review audit. The shared client uses same-origin ChatGPT sessions, not bearer capabilities, and provides private pending/own-record management separately from public search/browsing.

`server/sites.ts` is the composition entry point. It accepts the real server-only `getChatGPTUser` and `chatGPTSignInPath` functions from the official starter; it does not recreate them or read untrusted identity headers. Checked-in artwork metadata controls writing readiness, with no request/env bypass. The local tests use actual Miniflare D1/R2 and explicitly synthetic identity callbacks. Hosted sign-in has not been verified.

## Exact local integration blocker

The Sites plugin is absent from the execution environment's local plugin directories. Reading its supported documentation works, but these required code resources return `failed to read skill resource`:

- `scripts/project-setup.mjs`
- `scripts/site-workflow.mjs`
- `templates/vinext-starter/vite.config.ts`
- `templates/vinext-starter/app/chatgpt-auth.ts`

Attempts used the known Sites package's complete skill resource paths. This is unavailable source, not a permission denial. The canonical starter/identity implementation has not been guessed or substituted. Supply the supported starter/helper bundle (or make its resources available), then preserve its `sites()` runtime integration and route identity requests through those exact official helpers. The current Vite frontend and D1 API tests remain runnable independently.

## Configuration and approval needed for deployment

1. Supply the official Sites starter/helpers and integrate its server route with `createSitesGuestbook(env, { getChatGPTUser, chatGPTSignInPath })`. Use a dynamic, server-only API route; preserve the starter's auth and build integrations. Do not implement dispatch-owned sign-in/callback routes.
2. Select/register a private Site only after the needed approval; retain the **returned** project ID. Use the official source helper and its actual manifest schema. No project ID or non-null hosting binding JSON shape has been invented in this checkout.
3. Configure the logical D1 binding **DB**. Use the generated schema-only migrations, inspect them and run canonical starter builds/local migrations before any hosted publication. The backend never creates tables in request handlers. No external database credential is required for this binding.
4. Set server-only **YWH_MODERATOR_USER_IDS** to a JSON array of up to 20 actual **Site-scoped ChatGPT user IDs**. Values must come from authenticated identity in that Site, not guessed GitHub names or email addresses. Empty configuration disables publication. Review the chosen organizer access policy and staffing before launch.
5. Use **VITE_GUESTBOOK_API=/api** in the frontend build. Keep runtime configuration out of browser secrets. No OpenAI API key is required; no OCR service has been implemented.
6. Supply/import the exact original version-3 PDF, verify the safe writing zone against actual artwork, and complete visual QA. `server/sites.ts` keeps writes disabled while that checked-in readiness proof is absent.
7. The implemented publication policy requires ChatGPT sign-in for writes and organizer review before publication. Confirm that product/access policy and retention policy, then verify actual dispatch authentication, ownership and moderation through the canonical runtime.
8. Approve provisioning/publication before Sites applies hosted migrations or deploys. New Sites begin private; changing to public reading is a separate audience decision. Keep the supplied existing audience unless a change is explicitly authorized.
9. **BUCKET** is optional and should remain unused/null until original-photo storage is approved and sources exist. Its eventual use enables private original-image registration/import review. No real photos, uploaded files or attendee imports currently exist.

## Remaining integration sequence

1. Preserve the current frontend, D1 application code, generated migrations and evidence while opening the supported Vinext starter through the Sites workflow once its source is available.
2. Connect a dynamic server-only API route to the official identity helpers and `createSitesGuestbook`. Preserve the starter's `sites()` integration, binding declaration format and local migration commands. Do not replace hosted authentication.
3. Run the existing application tests through that runtime, verify real dispatch sign-in and configured organizer access, then review the operational moderation and retention policy. Local application tests do not establish the hosted identity boundary.
4. Complete original-artwork verification and visual QA. Obtain needed approval before registering a Site, provisioning bindings, applying hosted migrations, changing audience or publishing.

## Remaining decisions and limits

- No supported Site project has been selected/registered, so there is no hosted database or verified runtime identity for this app yet.
- The implemented default is ChatGPT sign-in for writes with durable account ownership, and organizer approval before public visibility. Confirm that policy before launch.
- Actual moderator IDs, retention and moderation operations remain to be configured/approved; application authorization exists but is not a staffed hosted moderation service. The organizer API is implemented; a dedicated visual review console is not yet included.
- The exact artwork still needs to be supplied and its writing regions verified. Storage support does not remove that design blocker.

Sources inspected: Sites `references/storage.md`, `references/identity-and-secrets.md`, `templates/vinext-starter/README.md`, and `templates/worker-esm-starter/README.md`. The Worker ESM starter has a different embedded-asset constraint and is not the selected recommendation for preserving this app's standalone original artwork assets and adding structured persistence.
