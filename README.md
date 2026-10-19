# You Were Here

A DevDay Community DelhiNCR signature tent card. React + TypeScript + Vite, self-hosted handwriting fonts, and DOM/CSS rotation about the top binding. No heavy 3D runtime.

**Status: implementation in progress, not ready for public release.** The exact PDF and approval mockups resolve in Library, but this execution environment's proxy refuses their download hosts (HTTP 403). The UI explicitly shows the unavailable artwork instead of recreating it. No original attendee signatures have been imported. A D1 application backend is implemented and locally tested; canonical Sites runtime/auth integration and hosted provisioning remain pending.

## Run

Node 22.18+ (Node 24 tested).

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
npm test
npm run test:browser
npm run check:server
npm run test:server
npm run build
```

The default is a visibly labeled **in-memory demo**. Refreshing discards additions. Nothing is saved to localStorage, sent to a server, or represented as a shared guestbook. Demo fixtures live only in `src/demo.ts`, and never enter the HTTP adapter.

## Implemented flow

- Browse one portrait page with top rings and up/down controls; a page rotates vertically around its top edge. Reduced motion switches pages without rotation. Card touch behavior preserves vertical scrolling; no swipe interception.
- Add yours starts on the current page. Tap or use arrow keys to choose a normalized position, then Enter or Use this spot opens the editor. Shift + arrow moves faster.
- Pick Caveat, Dancing Script or Kalam, one of four inks, and up to two safe HTTPS profile links. Confirm the visibility notice, preview on the same page, then explicitly add to the demo or publish through a configured backend.
- Search names/handles, open profile links, report a concern and edit/remove additions. Demo ownership is session-only and demo reports send nothing. The shared adapter uses authenticated ChatGPT ownership, separates private pending records and provides Your signatures for later management. D1 implements persistent account/global quotas.
- Mobile uses a near-full-width card, fixed Add yours CTA and a native dialog styled as a bottom sheet. Dialog focus/escape behavior is provided by the browser.

## Original artwork

Retain the PDF as the immutable source; render page 1 as one complete, unmodified image shared by every card page. Do not recreate its text, glyphs, colors or tags in HTML. The second PDF page remains in the retained source.

Source: Library `libfile_84c31d43628c819180e167ca822431bf`, file `file_0000000003808210890d82075c35ca15`, version **3**, `DevDay_Community_New_Delhi_A4_Print.pdf`.

Once supplied locally:

```sh
npm run assets:import -- /absolute/path/DevDay_Community_New_Delhi_A4_Print.pdf
```

The script requires PyMuPDF and records a SHA-256 checksum and exact page ratio. It does **not** certify the source version from its filename; verify the supplied Library identity/version before running it. Then measure the actual artwork, update `SAFE_ZONE` to verified clear space (or implement reviewed exclusion regions), and set `safeRegionsVerified` only after a visual review. The current writing zone is provisional and demo-only. Run `npm run check:release` to list configuration blockers.

Approved desktop: `libfile_2e779dec10f881919371cfda01aa804f`; mobile: `libfile_3d2e3757b47c81918449dff6c06d29cb`. Their original files must be available for source-to-implementation QA. `design-qa.md` records the current blocked status.

## Shared backend

The D1 backend in `server/api.ts` is locally tested for persistence, atomic reservations, validation, moderation/reports, identity ownership, idempotency and quotas. New submissions and edits require organizer review. `server/sites.ts` binds it to the official identity helper functions supplied by a canonical Sites server route. That integration is **blocked** because required official starter/helper source files are unavailable through this environment's skill resource interface. No alternative authentication stack or fake platform API was created.

Sites supports D1, optional R2 and ChatGPT sign-in; no separate external service is necessary. See [deployment configuration](docs/sites-backend.md) and [the API contract](docs/backend-contract.md). `VITE_GUESTBOOK_API=/api` selects the shared adapter after runtime integration. API failures never switch to fixtures. Nothing has been provisioned or deployed.

## Event-card imports

[The import model](docs/import-model.md) preserves source card/page identity, original-image provenance, transcription confidence and review status. No OCR, source photographs or attendee records were fabricated. Low-confidence handwriting must be reviewed before publishing.

## Sites compatibility

`npm run build` emits static `dist/`, suitable for the supported Sites static packaging workflow. The Vite dev script accepts required host/port flags. No Site has been registered, no hosting manifest identity has been invented, and nothing has been deployed. Future hosting must use the Sites skill and a returned project ID. Shared behavior can use Sites' supported Vinext/D1/identity workflow after local server implementation and the needed provisioning/deployment approval. Static hosting alone does not provide a persistent guestbook.

## Specification gap

The checkout was empty and contains no earlier 14-section Project specification. The requested ChatGPT Space/Page is unavailable to the parent thread. [Approved scope](docs/approved-scope.md) records the supplied implementation brief and unresolved gaps; it is repository documentation, not a substitute Space or a claim of full 14-section compliance.
