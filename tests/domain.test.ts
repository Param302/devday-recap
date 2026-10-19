import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePosition,
  signatureWidth,
  SIGNATURE_HEIGHT,
  SAFE_ZONE,
  safeSocial,
  validateDraft,
  findSignatures,
  importIsPublishable,
  validatePublicSnapshot,
  type Draft,
  type Signature,
} from "../src/domain.ts";
import { createDemoGuestbook, createHttpGuestbook } from "../src/guestbook.ts";
const page = {
  id: "p1",
  order: 1,
  sourceCardId: null,
  sourcePageId: null,
  artworkId: "delhincr-print-v3",
};
const draft: Draft = {
  pageId: "p1",
  name: "Test signer",
  position: { x: 0.1, y: 0.45 },
  font: "caveat",
  ink: "#252822",
  socials: [],
};
test("normalized position survives device scaling, with bounds for complete signature", () => {
  for (const width of [320, 390, 495, 900]) {
    const p = { x: 0.21, y: 0.48 };
    const px = { x: p.x * width, y: (p.y * width) / 0.75 };
    const actual = normalizePosition(
      { x: px.x / width, y: px.y / (width / 0.75) },
      "Test",
    );
    assert.ok(
      Math.abs(actual.x - p.x) < 1e-12 && Math.abs(actual.y - p.y) < 1e-12,
    );
  }
  const p = normalizePosition({ x: 2, y: 3 }, "Long display name");
  assert.ok(p.x + signatureWidth("Long display name") <= SAFE_ZONE.right);
  assert.ok(p.y + SIGNATURE_HEIGHT <= SAFE_ZONE.bottom);
  assert.throws(() => normalizePosition({ x: NaN, y: 0 }, "Test"));
});
test("name, font, ink, page and social validation rejects unsafe input", () => {
  for (const name of ["x", "a".repeat(29), "\u202eUnsafe", "<script>"])
    assert.throws(() => validateDraft({ ...draft, name }, [], [page]));
  assert.throws(() =>
    validateDraft({ ...draft, pageId: "missing" }, [], [page]),
  );
  for (const url of [
    "javascript:alert(1)",
    "http://github.com/test",
    "https://github.com.evil.com/me",
    "https://github.com@evil.com/me",
    "https://github.com:8443/me",
    "https://github.com/",
  ])
    assert.throws(() => safeSocial(url));
  assert.equal(
    safeSocial("https://github.com/test?tracking=1#bio")?.url,
    "https://github.com/test",
  );
});
test("collisions reject only on same page and long names clamp safely", () => {
  const s = { ...draft, id: "s", visibility: "demo" } as Signature;
  assert.throws(() => validateDraft(draft, [s], [page]), /overlaps/);
  assert.doesNotThrow(() =>
    validateDraft(draft, [{ ...s, pageId: "other" }], [page]),
  );
  const result = validateDraft(
    { ...draft, name: " A longer name ", position: { x: 0.9, y: 0.5 } },
    [],
    [page],
  );
  assert.equal(result.name, "A longer name");
  assert.ok(result.position.x + signatureWidth(result.name) <= 0.9);
});
test("demo is removable, session-owned, rate limited and isolated from other instances", async () => {
  const a = createDemoGuestbook(),
    b = createDemoGuestbook();
  const first = await a.load();
  const d = { ...draft, pageId: first.pages[2].id };
  const receipt = await a.publish(d, "key");
  assert.equal(receipt.signature.pageId, first.pages[2].id);
  assert.equal(receipt.signature.visibility, "demo");
  assert.deepEqual(await a.publish(d, "key"), receipt);
  assert.equal((await b.load()).signatures.length, first.signatures.length);
  await assert.rejects(
    a.publish({ ...d, position: { x: 0.1, y: 0.55 } }, "second"),
    /wait/,
  );
  await assert.rejects(a.remove(receipt.signature.id, "wrong"), /does not own/);
  const changed = await a.update(receipt.signature.id, receipt.ownerToken, {
    ...d,
    name: "Changed",
  });
  assert.deepEqual(changed.position, receipt.signature.position);
  await a.remove(receipt.signature.id, receipt.ownerToken);
  assert.equal((await a.load()).signatures.length, first.signatures.length);
});
test("name and handle search returns signature on its own page", () => {
  const s = {
    ...draft,
    id: "s",
    socials: [safeSocial("https://github.com/test-handle")!],
  } as Signature;
  assert.equal(findSignatures([s], "@test-handle")[0].pageId, "p1");
  assert.equal(findSignatures([s], "SIGNER")[0].id, "s");
  assert.deepEqual(findSignatures([s], ""), []);
});
test("demo and unreviewed imports cannot enter public snapshot", async () => {
  const demo = await createDemoGuestbook().load();
  assert.throws(() => validatePublicSnapshot(demo));
  const s: Signature = {
    ...draft,
    id: "s",
    createdAt: "2026-10-19T00:00:00Z",
    visibility: "public",
    provenance: {
      kind: "event-card-import",
      sourceCardId: "original-1",
      sourcePageId: "front",
      originalImage: {
        assetId: "photo-1",
        sha256: "a".repeat(64),
        capturedAt: null,
      },
      extracted: { name: "Uncertain", handles: [], confidence: 0.3 },
      review: "pending",
    },
  };
  assert.equal(importIsPublishable(s), false);
  assert.throws(() =>
    validatePublicSnapshot({ pages: [page], signatures: [s] }),
  );
  s.provenance.review = "approved";
  assert.equal(
    validatePublicSnapshot({ pages: [page], signatures: [s] }).signatures
      .length,
    1,
  );
  s.socials = [{ label: "Unsafe", url: "javascript:alert(1)" }];
  assert.throws(() =>
    validatePublicSnapshot({ pages: [page], signatures: [s] }),
  );
});
test("public adapter rejects external bases and never silently supplies demo data", async () => {
  assert.throws(() => createHttpGuestbook("https://example.com", false));
  const old = globalThis.fetch;
  globalThis.fetch = async () => new Response("{}", { status: 503 });
  try {
    await assert.rejects(
      createHttpGuestbook("/api", false).load(),
      /unavailable/,
    );
    await assert.rejects(
      createHttpGuestbook("/api", false).publish(draft, "key"),
      /original artwork/,
    );
  } finally {
    globalThis.fetch = old;
  }
});
