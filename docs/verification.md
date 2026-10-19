# Verification

Verified in the selected cloud environment on 2026-10-19 with Node 24.19.0 and installed Chromium. **33 focused checks pass.** Original artwork/approved mockup pixels are still unavailable and their transfer approval remains pending, so visual fidelity is not accepted.

| Check                     | Result                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`           | Passed strict TypeScript and the canonical Sites/Vinext Worker, RSC, SSR and client build. Routes `/` and `/api/:path+` emitted.                     |
| `npm run build:demo`      | Passed the separate browser-only preview build to `dist-demo/`.                                                                                      |
| `npm test`                | 7 domain/adapter tests passed.                                                                                                                       |
| `npm run check:server`    | Server/schema/integration-test TypeScript checking passed.                                                                                           |
| `npm run test:server`     | 14 real local Miniflare D1/R2 integration tests passed.                                                                                              |
| `npm run test:browser`    | 9 browser checks passed: desktop 1440 × 1000, mobile 390 × 844, shared-mode UI 1100 × 950.                                                           |
| `npm run test:runtime`    | 3 actual canonical-runtime tests passed, using the official local Sites middleware/helper without route interception or injected identity callbacks. |
| Official source hashes    | Auth helper, Sites Vite plugin and MIT license match the supplied SHA-256 values exactly.                                                            |
| Production mock exclusion | No `__sites_local_auth`, `local_seedy` or `seedy@sites.test` marker in production server/client JS, MJS or JSON.                                     |
| Public release check      | Intentionally blocked on original artwork, verified writing regions and an approved/registered Site project.                                         |
| Hosted dispatch login     | Not run: no Site has been provisioned/deployed.                                                                                                      |
| Source-to-build visual QA | Blocked on original PDF and approved images; see `design-qa.md`.                                                                                     |

## Application behavior covered

The demo signing flow covers keyboard/touch position selection, three fonts/inks, visibility acknowledgement, URL validation, preview, explicit save, name/handle search, owner edit/remove and refresh reset. Coordinates remain unchanged across viewport resizing and edit. Signature collisions and unsafe profiles are rejected. No document overflow at widths 320, 390, 700 and 1440; the signing dialog is also checked at 320. Page motion uses only rotateX about the top origin; reduced motion removes rotation. The card preserves ordinary vertical touch scrolling.

D1 tests cover persistence after runtime restart, trusted account ownership, forged browser headers, origin validation, atomic collision reservations, concurrent idempotent retries, stale versions, limits, persistent quotas, private/deduplicated reports, organizer approval/hiding/audit, organizer-only page creation, source-card/page provenance, changed-image rejection, explicit import review, pending/public separation and checked-in artwork gates. Synthetic fixtures are isolated and removed; no attendee records or original photos are seeded.

The shared-mode browser test connects the UI/HTTP adapter to actual local D1 through a test transport. It verifies pending privacy, ownership after reload, anonymous/other-user separation, publication only after organizer approval, private reports and later owner removal.

The separate actual-runtime suite traverses official Sites loopback auth, the canonical Vinext route and the unmodified getChatGPTUser helper. It verifies forged-header rejection, normal top-level sign-in, HttpOnly/SameSite cookies, reload persistence, sign-out, prefetch protection, unsafe-return handling, cross-origin rejection and live D1 reads. Signed-in writes remain blocked by unavailable artwork. This is official local preview behavior, not hosted sign-in success.

## Evidence

- `evidence/desktop-demo.png`
- `evidence/mobile-demo.png`
- `evidence/desktop-editor.png`
- `evidence/mobile-editor.png`
- `evidence/private-pending-test.png` — explicitly synthetic pending signature.
- `evidence/sites-runtime-empty-test.png` — actual canonical runtime, signed-in local preview with an empty, uninitialized card.

These screenshots contain no original print artwork or actual attendees. They verify application states, not approved visual fidelity. Fixed-artwork clearance remains unverified; the provisional zone is demo-only and production publication stays closed.

## Scope and remaining holds

The starter-source blocker was resolved by the parent's official code handoff. Hashes and adaptations are recorded in `official-starter-provenance.json`; the official MIT license is preserved. Existing frontend/D1 behavior was retained, with the Site using `/api` and the standalone demo kept separate.

No artwork transfer/upload, Site registration, hosted resource provisioning, hosted migrations, production publication, actual attendee import or Space creation occurred. Local schema migrations were applied only with the explicit `--local` Wrangler command. Hosted access/moderation configuration and dispatch verification require an approved deployment. Source-to-build comparison remains blocked.
