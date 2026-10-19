# Sites runtime and backend

The official Sites 1.0.0 Vinext runtime is integrated and locally verified. The prior starter-source blocker was resolved by the parent supplying official source. No Site registration, hosted resource provisioning, hosted migrations, access-policy changes or deployment occurred.

## Official source and adaptations

The auth helper, Sites Vite plugin and MIT license match the parent's supplied SHA-256 hashes exactly. See `official-starter-provenance.json`. Source was first inspected in an empty sibling reference directory, then integrated without overwriting the existing D1 schema or guestbook implementation.

- `app/chatgpt-auth.ts` is the unmodified official server-only helper. `/api/[...path]` calls it and the application's `createSitesGuestbook`. There are no app-owned sign-in, sign-out or callback routes.
- `build/sites-vite-plugin.ts` and its license are unmodified. The `sites()` integration remains in `vite.config.ts`.
- The Worker uses the official `vinext/server/fetch-handler` contract. Connector context/preview wrappers are omitted because this app declares no connected apps. The unused `lib/connector-context.ts` and `lib/connector-contract.mjs` are therefore not required imports; those official companions would be needed before adding connected-app capabilities.
- Framework dependencies match the provided starter versions: Vinext 1.0.0-beta.5, Vite 8.0.13, Cloudflare Vite plugin 1.37.1, Wrangler 4.92.0, Next 16.3.4 and React 19.2.6.
- Official execution-profile/run-framework/environment helpers preserve portable and managed entry points. This environment used the portable profile. Managed Linux preview was not tested.
- `.openai/hosting.json` declares logical D1 `DB` and unused R2 `null`, using the provided starter's actual format. It has no project ID. The database UUID emitted for local simulation is the official starter placeholder, not a hosted resource.

The existing frontend lives in `src/App.tsx`. The canonical Site page explicitly uses `/api`; separate `dev:demo` and `build:demo` commands retain the browser-only demo. No frontend environment variable is needed for the canonical Site's API path.

## Local verification

The actual canonical runtime was tested through the official loopback-only development sign-in flow, without route interception or an injected identity callback. Tests verify rejected forged identity headers, top-level sign-in, HttpOnly/SameSite cookie behavior, reload persistence, sign-out, prefetch protection, unsafe-return handling, cross-origin rejection and D1 reads through the API route. Signed-in writes stay closed while original artwork is unverified.

This is the official **local preview simulation**, not a claim that hosted dispatch login has succeeded. Production client/server outputs were scanned and contain none of `__sites_local_auth`, `local_seedy` or `seedy@sites.test`. The official local mock is absent from production builds.

The D1 application tests separately verify persistence after runtime restart, atomic collisions/idempotency, account ownership, stale versions, quotas, private reports, organizer approval/hiding, audit and reviewed source imports. Local and hosted databases are distinct. No actual event attendees or photos were created.

## Run locally

For a self-contained demo:

```sh
npm run dev:demo -- --host 0.0.0.0 --port 4173 --strictPort
```

For the canonical runtime, first build:

```sh
npm run build
```

Apply each **pending** migration once to the local database using the official starter's command:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_sweet_shen.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_furry_white_tiger.sql
```

Both were applied only to this checkout's new local database during integration. Do not replay applied migrations or change applied SQL, snapshots or journals. Use the same `.wrangler/state` path as runtime preview.

Create an ignored `.dev.vars` from `.dev.vars.example` only if one does not already exist, then:

```sh
npm run dev -- --hostname 127.0.0.1 --port 4175
npm run test:runtime
```

The example grants organizer access to the official preview-only `local_seedy` user. Never use that ID in hosted configuration. Local mock sign-in is loopback-only; managed-profile previews do not enable it. The integration-created `.dev.vars` is removed after testing; existing user environment files are never overwritten.

`npm start` previews the built Worker locally through Wrangler; hosted dispatch owns real sign-in and is not simulated by that built-preview command.

## Configuration and approval still required

1. Complete the authorized original-artwork handoff. No alternate asset transfer was attempted during runtime integration. Import the exact version-3 PDF, verify clear writing regions and complete source-to-build visual QA before enabling signatures.
2. Obtain approval before creating/registering a private Site or provisioning resources. Retain only the actual returned project ID. Use the full official Sites source helper for synchronization/packaging and publishing; no custom deployment route has been substituted.
3. Provision/bind D1 **DB** through that supported workflow and apply the inspected schema-only migrations through Sites. No external database credentials are needed for the binding.
4. Configure server-only **YWH_MODERATOR_USER_IDS** as a JSON array of up to 20 actual **Site-scoped ChatGPT user IDs**, obtained from authenticated users in that Site. Do not guess GitHub names or email addresses. Empty configuration disables publication.
5. Confirm the chosen policy: anonymous public reading, ChatGPT sign-in for writes, organizer review before publication, and the documented retention policy. Assign real moderation operations; a dedicated visual organizer console is not yet included, though organizer API actions are implemented.
6. Verify hosted dispatch authentication/authorization after an approved private deployment. Changing the Site to public reading requires the audience decision; preserve existing audience unless explicitly authorized.
7. Leave **R2 null** until original-photo storage is approved and photos exist. A future **BUCKET** binding enables private registered-image verification/import review. No photo upload endpoint, OCR service, OpenAI API key or automatic import is present.

The artwork and hosted deployment approvals remain on hold. Local runtime/auth integration is complete; no mandatory runtime source imports remain missing.
