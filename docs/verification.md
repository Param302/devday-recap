# Implementation milestone verification

Verified in the selected cloud environment on 2026-10-19 with Node 24.19.0 and installed Chromium.

| Check                   | Result                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`         | Passed: strict TypeScript check and Vite static production build. JS 271 KB / 84 KB gzip; CSS 18 KB / 5 KB gzip.                                                       |
| `npm test`              | Passed: 7 domain/adapter tests.                                                                                                                                        |
| `npm run test:browser`  | Passed: 9 browser tests: desktop 1440 × 1000, mobile 390 × 844 and shared-mode UI 1100 × 950.                                                                          |
| Browser runtime/console | No page errors or console errors in the complete signing/search/edit/remove flow.                                                                                      |
| Overflow                | No document overflow at widths 320, 390, 700 and 1440; signing dialog additionally checked at 320.                                                                     |
| Placement               | Current page retained; arrow-key position selection; exact normalized style persisted across viewport resizing, publication and edit in demo.                          |
| Form/link checks        | Visibility acknowledgement, three named styles, ink selection, profile allowlist validation and signature collision rejection exercised.                               |
| Motion                  | Page animation uses `rotateX` around top origin; reduced-motion switches without transform. Card uses `touch-action: pan-y`, with no touch/wheel gesture interception. |
| Public/demo boundary    | Independent demo sessions, refresh reset, no localStorage; public API failures cannot return fixtures; demo/unreviewed imports rejected by public snapshot validation. |
| `npm run check:release` | Intentionally blocked: artwork unavailable, writing regions unverified, persistent API unconfigured.                                                                   |
| Visual fidelity         | Blocked; original source pixels unavailable. See `design-qa.md`.                                                                                                       |
| Real backend acceptance | 14 local D1 integration tests passed; hosted dispatch authentication and deployment remain unverified.                                                                 |

Browser evidence, all explicit demo data:

- `evidence/desktop-demo.png`
- `evidence/mobile-demo.png`
- `evidence/desktop-editor.png`
- `evidence/mobile-editor.png`

The screenshots show the missing-artwork state and working demo editor. They do not demonstrate the original print artwork or compliance with approved mockup pixels. Fixed-artwork collision clearance remains unverified; current writing-zone tests cover only the provisional demo zone and signature-to-signature collisions.

Issues found and fixed during this milestone: keyboard Enter activating the editor transition; signing during an unfinished page flip; edited signatures remaining hidden after save; blocked position taps over disabled signature elements; indistinguishable font option labels. The passing browser run exercises the resulting signing flow, including choosing Dancing Script and plum ink.

No deployment, infrastructure provisioning, production publication, attendee import, Space creation or change to security settings occurred.

## Backend implementation milestone

- `npm run check:server`: passed strict server/schema/test TypeScript checking.
- `npm run test:server`: **14 passed**, using actual Miniflare D1/R2 and generated migrations. Tests cover runtime restart persistence, identity ownership, forged browser headers, same-origin validation, atomic collisions, concurrent idempotency, stale versions, safe input limits, persistent quotas, private reports, moderator approval/hiding/audit, organizer-only page creation, source card/page provenance, changed-image rejection, explicit import review, client pending/public separation and checked-in artwork readiness gates.
- `npm test`: **7 passed** after client changes.
- `npm run test:browser`: **9 passed**. The added shared-mode browser test connects the real HTTP client/UI to actual local D1 through a test transport: own pending records survive reload, anonymous/other users cannot see them, moderator approval makes them public, reports are stored privately, and the owner can remove the record later.
- `npm run build`: passed; static client bundle 271 KB / 84 KB gzip. The D1 backend is separate server code, not bundled as a browser database.
- `npm run check:release`: intentionally blocked on original artwork, writing-zone review, API/runtime configuration and official Sites identity helper/server route integration.

Additional evidence: `evidence/private-pending-test.png` shows a clearly named synthetic test signature and its private review state. No real attendee, photo or identity token appears. The test identity callback is local test infrastructure, not a mocked claim of hosted ChatGPT sign-in success.

The official Sites starter/helper source is unavailable through this execution environment's skill resource interface. `server/sites.ts` accepts the actual helpers at the integration boundary; no substitute OAuth/login implementation, raw-header authentication or platform API has been invented. Hosted auth verification, canonical runtime packaging and formal visual QA remain blocked. Exact configuration/approval requirements are listed in `docs/sites-backend.md`.
