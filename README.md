# You Were Here

A DevDay Community DelhiNCR signature tent card. React + TypeScript + Vite, self-hosted handwriting fonts, and DOM/CSS rotation about the top binding. No heavy 3D runtime.

**Status: implementation in progress, not ready for public release.** The exact PDF and approval mockups resolve in Library, but this execution environment's proxy refuses their download hosts (HTTP 403). The UI explicitly shows the unavailable artwork instead of recreating it. No original attendee signatures have been imported. No persistent backend or service credentials exist in this repository.

## Run

Node 22.18+ (Node 24 tested).

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
npm test
npm run test:browser
npm run build
```

The default is a visibly labeled **in-memory demo**. Refreshing discards additions. Nothing is saved to localStorage, sent to a server, or represented as a shared guestbook. Demo fixtures live only in `src/demo.ts`, and never enter the HTTP adapter.

## Implemented flow

- Browse one portrait page with top rings and up/down controls; a page rotates vertically around its top edge. Reduced motion switches pages without rotation. Card touch behavior preserves vertical scrolling; no swipe interception.
- Add yours starts on the current page. Tap or use arrow keys to choose a normalized position, then Enter or Use this spot opens the editor. Shift + arrow moves faster.
- Pick Caveat, Dancing Script or Kalam, one of four inks, and up to two safe HTTPS profile links. Confirm the visibility notice, preview on the same page, then explicitly add to the demo or publish through a configured backend.
- Search names/handles across pages, open signature links, report a concern, edit/remove session-owned additions. Demo reports send nothing. The demo's local rate limit is a UX simulation, not abuse protection.
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

No backend has been provisioned, deployed or claimed. See [the contract](docs/backend-contract.md) for the required endpoints, persistent storage, atomic collision validation, moderation, rate limiting and owner recovery. `VITE_GUESTBOOK_API=/api` selects the same-origin HTTP adapter. An API failure never switches to sample data. Browser checks are defense in depth; the server must repeat all validation. Health capability flags cannot replace server acceptance tests.

## Event-card imports

[The import model](docs/import-model.md) preserves source card/page identity, original-image provenance, transcription confidence and review status. No OCR, source photographs or attendee records were fabricated. Low-confidence handwriting must be reviewed before publishing.

## Sites compatibility

`npm run build` emits static `dist/`, suitable for the supported Sites static packaging workflow. The Vite dev script accepts required host/port flags. No Site has been registered, no hosting manifest identity has been invented, and nothing has been deployed. Future hosting must use the Sites skill and a returned project ID; a shared backend requires separately approved infrastructure. Static hosting alone does not provide a persistent guestbook.

## Specification gap

The checkout was empty and contains no earlier 14-section Project specification. The requested ChatGPT Space/Page is unavailable to the parent thread. [Approved scope](docs/approved-scope.md) records the supplied implementation brief and unresolved gaps; it is repository documentation, not a substitute Space or a claim of full 14-section compliance.
