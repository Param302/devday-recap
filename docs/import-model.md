# Reviewed event-card imports

No original card photographs have been supplied. No attendees, transcriptions, OCR results or confidence scores have been invented. Demo records have `provenance.kind = "demo"`, null source fields and `visibility = "demo"`.

Use the types in `src/domain.ts`:

| Field                          | Meaning                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CardPage.id`                  | Stable digital page identity, independent of display order.                                                                                                        |
| `sourceCardId`, `sourcePageId` | Organizer-assigned original physical card and side/page identity, retained across transcription corrections.                                                       |
| `artworkId`                    | Immutable artwork version, currently `delhincr-print-v3`, repeated identically on all pages.                                                                       |
| `Signature.position`           | Normalized top-left text coordinates on the canonical full artwork, both axes in 0–1. Do not use viewport or cropped-image pixels.                                 |
| `provenance.originalImage`     | Private original-image asset identity, SHA-256 hash, capture time if known. Preserve the unmodified original separately from any deskewed working image.           |
| `provenance.extracted`         | Raw extracted name/handles and confidence when an actual extraction is available. `null` means unavailable, not zero confidence.                                   |
| `provenance.review`            | `pending`, `approved`, `rejected`, or `not-required` for visitor/demo records. An event import may publish only when explicitly approved with complete provenance. |
| `visibility`                   | `pending`, `public`, or `demo`; only public reviewed records enter the shared snapshot.                                                                            |

Suggested import sequence after photos arrive:

1. Register physical source card/page identity and immutable private original image with a checksum.
2. Calibrate image corners to canonical artwork coordinates; record that transform and extraction method in an import job/audit record. Do not guess positions from a cropped viewport.
3. Extract candidate name/handles/positions into private pending records. Retain the actual model/tool version and confidence if provided; do not synthesize confidence values.
4. Present original crop beside each transcription for organizer review. Ask the user about ambiguous handwriting and validate links. Never auto-publish on a confidence threshold alone.
5. Verify consent for public names/socials and confirm placement avoids fixed artwork. Preserve original provenance even if a transcription is corrected.
6. Publish approved records through the backend's reviewed import path, rejecting `demo` and all unreviewed candidates.

The backend includes organizer-only source-registration and pending-candidate endpoints. Registration verifies an existing private R2 PNG/JPEG against its actual SHA-256 and preserves each physical card/page pair. Import approval requires transcription/consent confirmations and rechecks original bytes. No automated OCR, photo upload endpoint, public photo display or actual attendee import is included. No real photos/attendees have been registered. Future storage use still needs approved provisioning and original sources.
