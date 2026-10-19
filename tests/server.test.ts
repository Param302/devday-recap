import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { createGuestbookApi } from "../server/api.ts";
import { createSitesGuestbook } from "../server/sites.ts";
import { createHttpGuestbook } from "../src/guestbook.ts";
import type { ApiDependencies, D1Database } from "../server/types.ts";
import type { Draft } from "../src/domain.ts";
const origin = "https://test.invalid";
const draft: Draft = {
  pageId: "test-page-1",
  name: "Test signer",
  position: { x: 0.1, y: 0.36 },
  font: "caveat",
  ink: "#252822",
  socials: [],
};
const submission = (d = draft, key = crypto.randomUUID()) => ({
  draft: d,
  idempotencyKey: key,
  consent: true,
});
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), "ywh-d1-test-"));
  let mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("test-only");}}',
    compatibilityDate: "2026-06-01",
    d1Databases: { DB: "you-were-here-test" },
    d1Persist: directory,
    r2Buckets: { BUCKET: "test-source-images" },
    cf: false,
  });
  let db = (await mf.getD1Database("DB")) as unknown as D1Database;
  const files = (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = await readFile(
      new URL("../drizzle/" + file, import.meta.url),
      "utf8",
    );
    for (const statement of sql.split("--> statement-breakpoint"))
      if (statement.trim()) await db.prepare(statement).run();
  }
  for (let i = 1; i <= 8; i++)
    await db
      .prepare("INSERT INTO pages (id,artwork_id,sort) VALUES (?,?,?)")
      .bind(`test-page-${i}`, "delhincr-print-v3", i)
      .run();
  t.after(async () => {
    await mf.dispose();
    await rm(directory, { recursive: true, force: true });
  });
  const config = (
    user: string | null,
    overrides: Partial<ApiDependencies> = {},
  ): ApiDependencies => ({
    db,
    getChatGPTUser: async () => (user ? { userId: user } : null),
    chatGPTSignInPath: () => "/test-only-signin",
    moderatorUserIds: new Set(["test-moderator"]),
    artworkVerified: true,
    ...overrides,
  });
  const call = async (
    user: string | null,
    path: string,
    method = "GET",
    input?: unknown,
    overrides: Partial<ApiDependencies> = {},
    headers: Record<string, string> = {},
  ) =>
    createGuestbookApi(config(user, overrides))(
      new Request(origin + "/api" + path, {
        method,
        headers: { origin, "content-type": "application/json", ...headers },
        body: input === undefined ? undefined : JSON.stringify(input),
      }),
    );
  async function create(
    user = "test-user",
    d = draft,
    key = crypto.randomUUID(),
  ) {
    const response = await call(
      user,
      "/signatures",
      "POST",
      submission(d, key),
    );
    assert.equal(response.status, 201, await response.clone().text());
    return response.json() as Promise<any>;
  }
  async function approve(id: string, version = 1) {
    const response = await call(
      "test-moderator",
      `/moderation/signatures/${id}`,
      "POST",
      { decision: "approve", version, note: "Reviewed test signature" },
    );
    assert.equal(response.status, 200, await response.clone().text());
    return response.json() as Promise<any>;
  }
  return {
    call,
    create,
    approve,
    get db() {
      return db;
    },
    get mf() {
      return mf;
    },
    async restart() {
      await mf.dispose();
      mf = new Miniflare({
        modules: true,
        script: 'export default {fetch(){return new Response("test-only");}}',
        compatibilityDate: "2026-06-01",
        d1Databases: { DB: "you-were-here-test" },
        d1Persist: directory,
        r2Buckets: { BUCKET: "test-source-images" },
        cf: false,
      });
      db = (await mf.getD1Database("DB")) as unknown as D1Database;
    },
  };
}

test("real local D1 persists pending submissions and identity ownership across a runtime restart", async (t) => {
  const f = await fixture(t);
  const created = await f.create();
  assert.equal(created.status, "pending");
  assert.deepEqual(
    ((await (await f.call(null, "/guestbook")).json()) as any).signatures,
    [],
  );
  await f.restart();
  const me = (await (await f.call("test-user", "/me")).json()) as any;
  assert.equal(me.signatures[0].id, created.signature.id);
  assert.equal(me.signatures[0].status, "pending");
  assert.deepEqual(me.signatures[0].position, draft.position);
  const other = (await (await f.call("different-user", "/me")).json()) as any;
  assert.deepEqual(other.signatures, []);
});
test("anonymous writes and browser-supplied identity headers cannot claim ownership", async (t) => {
  const f = await fixture(t);
  const result = await f.call(
    null,
    "/signatures",
    "POST",
    submission(),
    {},
    {
      "oai-authenticated-user-id": "test-moderator",
      authorization: "Bearer invented",
    },
  );
  assert.equal(result.status, 401);
  const untrusted = await f.call(null, "/moderation");
  assert.equal(untrusted.status, 403);
  const cross = await f.call(
    "test-user",
    "/signatures",
    "POST",
    submission(),
    {},
    { origin: "https://evil.invalid" },
  );
  assert.equal(cross.status, 403);
});
test("concurrent overlapping writes reserve exactly one position atomically", async (t) => {
  const f = await fixture(t);
  const responses = await Promise.all([
    f.call("first-user", "/signatures", "POST", submission()),
    f.call("second-user", "/signatures", "POST", submission()),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (
      await f.db
        .prepare("SELECT count(*) AS count FROM signatures")
        .first<{ count: number }>()
    )?.count,
    1,
  );
});
test("idempotent concurrent retries create one record and reject changed content", async (t) => {
  const f = await fixture(t);
  const key = crypto.randomUUID(),
    input = submission(draft, key);
  const results = await Promise.all([
    f.call("test-user", "/signatures", "POST", input),
    f.call("test-user", "/signatures", "POST", input),
  ]);
  assert.ok(results.every((r) => [200, 201].includes(r.status)));
  const values = (await Promise.all(results.map((r) => r.json()))) as any[];
  assert.equal(values[0].signature.id, values[1].signature.id);
  assert.equal(
    (
      await f.db
        .prepare("SELECT count(*) AS count FROM signatures")
        .first<{ count: number }>()
    )?.count,
    1,
  );
  assert.equal(
    (
      await f.call(
        "test-user",
        "/signatures",
        "POST",
        submission({ ...draft, name: "Changed test" }, key),
      )
    ).status,
    409,
  );
});
test("moderation is required, audited and never exposes ownership or report secrets publicly", async (t) => {
  const f = await fixture(t);
  const created = await f.create();
  assert.equal(
    (
      await f.call(
        "test-user",
        `/moderation/signatures/${created.signature.id}`,
        "POST",
        { decision: "approve", version: 1, note: "Attempted self approval" },
      )
    ).status,
    403,
  );
  await f.approve(created.signature.id);
  const publicData = (await (await f.call(null, "/guestbook")).json()) as any;
  assert.equal(publicData.signatures.length, 1);
  const payload = JSON.stringify(publicData);
  for (const secret of [
    "owner_id",
    "test-user",
    "idempotency",
    "request_hash",
    "reporter_id",
  ])
    assert.equal(payload.includes(secret), false);
  assert.equal(
    (
      await f.db
        .prepare("SELECT count(*) AS count FROM review_audit")
        .first<{ count: number }>()
    )?.count,
    1,
  );
});
test("same signed-in owner can edit and remove after restart; other users and stale versions cannot", async (t) => {
  const f = await fixture(t);
  const created = await f.create();
  await f.approve(created.signature.id);
  await f.restart();
  const id = created.signature.id;
  assert.equal(
    (
      await f.call("other-user", `/signatures/${id}`, "PATCH", {
        draft,
        version: 2,
        consent: true,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await f.call("test-user", `/signatures/${id}`, "PATCH", {
        draft,
        version: 1,
        consent: true,
      })
    ).status,
    409,
  );
  const edited = await f.call("test-user", `/signatures/${id}`, "PATCH", {
    draft: { ...draft, name: "Edited test" },
    version: 2,
    consent: true,
  });
  assert.equal(edited.status, 200);
  const receipt = (await edited.json()) as any;
  assert.equal(receipt.status, "pending");
  assert.deepEqual(receipt.signature.position, draft.position);
  assert.equal(
    ((await (await f.call(null, "/guestbook")).json()) as any).signatures
      .length,
    0,
  );
  assert.equal(
    (await f.call("other-user", `/signatures/${id}`, "DELETE", { version: 3 }))
      .status,
    404,
  );
  assert.equal(
    (await f.call("test-user", `/signatures/${id}`, "DELETE", { version: 3 }))
      .status,
    204,
  );
  const stored = await f.db
    .prepare("SELECT name,socials,status FROM signatures WHERE id=?")
    .bind(id)
    .first<any>();
  assert.deepEqual(stored, { name: "", socials: "[]", status: "deleted" });
});
test("server rejects unsafe profiles, unconsented writes, unknown fields and off-zone positions", async (t) => {
  const f = await fixture(t);
  const inputs = [
    { ...submission(), consent: false },
    { ...submission(), ownerId: "test-moderator" },
    submission({ ...draft, position: { x: 2, y: 0.4 } }),
    submission({ ...draft, name: "<script>" }),
    submission({
      ...draft,
      socials: [{ label: "Unsafe", url: "javascript:alert(1)" }],
    }),
    submission({ ...draft, pageId: "missing-page" }),
  ];
  for (const input of inputs)
    assert.equal(
      (await f.call("test-user", "/signatures", "POST", input)).status,
      400,
    );
  assert.equal(
    (
      await f.call(
        "test-user",
        "/signatures",
        "POST",
        submission(),
        {},
        { "content-type": "text/plain" },
      )
    ).status,
    415,
  );
  assert.equal(
    (
      await f.call("test-user", "/signatures", "POST", {
        padding: "x".repeat(9000),
      })
    ).status,
    413,
  );
});
test("D1-backed publication quota is atomic, persistent and separate per account", async (t) => {
  const f = await fixture(t);
  for (let i = 1; i <= 5; i++)
    await f.create("quota-user", { ...draft, pageId: `test-page-${i}` });
  await f.restart();
  assert.equal(
    (
      await f.call(
        "quota-user",
        "/signatures",
        "POST",
        submission({ ...draft, pageId: "test-page-6" }),
      )
    ).status,
    429,
  );
  assert.equal(
    (
      await f.call(
        "other-quota-user",
        "/signatures",
        "POST",
        submission({ ...draft, pageId: "test-page-6" }),
      )
    ).status,
    201,
  );
});
test("reports are private, deduplicated and resolved only by a configured moderator", async (t) => {
  const f = await fixture(t);
  const created = await f.create();
  await f.approve(created.signature.id);
  const route = `/signatures/${created.signature.id}/reports`;
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await f.call("reporter-user", route, "POST", {
          reason: "Test report concern",
        })
      ).status,
      204,
    );
  assert.equal(
    (
      await f.db
        .prepare("SELECT count(*) AS count FROM reports")
        .first<{ count: number }>()
    )?.count,
    1,
  );
  assert.equal((await f.call("reporter-user", "/moderation")).status, 403);
  const queue = (await (
    await f.call("test-moderator", "/moderation")
  ).json()) as any;
  assert.equal(queue.reports[0].reason, "Test report concern");
  const id = queue.reports[0].id;
  assert.equal(
    (
      await f.call("reporter-user", `/moderation/reports/${id}`, "POST", {
        decision: "dismissed",
        note: "Unauthorized attempt",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("test-moderator", `/moderation/reports/${id}`, "POST", {
        decision: "resolved",
        note: "Reviewed and addressed test concern",
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await f.call(
        "test-moderator",
        `/moderation/signatures/${created.signature.id}`,
        "POST",
        {
          decision: "hide",
          version: 2,
          note: "Hidden after reviewing synthetic report",
        },
      )
    ).status,
    200,
  );
  assert.equal(
    ((await (await f.call(null, "/guestbook")).json()) as any).signatures
      .length,
    0,
  );
});
test("missing artwork or moderator policy blocks publishing; SQL rejects demo provenance", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await f.call("test-user", "/signatures", "POST", submission(), {
        artworkVerified: false,
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await f.call("test-user", "/signatures", "POST", submission(), {
        moderatorUserIds: new Set(),
      })
    ).status,
    503,
  );
  const created = await f.create();
  await assert.rejects(
    f.db
      .prepare("UPDATE signatures SET kind='demo' WHERE id=?")
      .bind(created.signature.id)
      .run(),
  );
});
test("Sites composition validates moderator configuration and keeps unverified checked-in artwork closed", async (t) => {
  const f = await fixture(t);
  const helpers = {
    getChatGPTUser: async () => ({ userId: "test-user" }),
    chatGPTSignInPath: () => "/test-only-signin",
  };
  assert.throws(() =>
    createSitesGuestbook(
      { DB: f.db, YWH_MODERATOR_USER_IDS: "not-json" },
      helpers,
    ),
  );
  const handler = createSitesGuestbook(
    { DB: f.db, YWH_MODERATOR_USER_IDS: '["test-moderator"]' },
    helpers,
  );
  const response = await handler(
    new Request(origin + "/api/signatures", {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(submission()),
    }),
  );
  assert.equal(response.status, 503);
  const health = (await (
    await handler(new Request(origin + "/api/health"))
  ).json()) as any;
  assert.equal(health.artworkReady, false);
});
test("only an organizer can create a page and every page uses the immutable artwork ID", async (t) => {
  const f = await fixture(t),
    input = { id: "organizer-test-page", order: 9 };
  assert.equal(
    (await f.call("test-user", "/moderation/pages", "POST", input)).status,
    403,
  );
  assert.equal(
    (await f.call("test-moderator", "/moderation/pages", "POST", input)).status,
    201,
  );
  assert.equal(
    (await f.call("test-moderator", "/moderation/pages", "POST", input)).status,
    409,
  );
  const snapshot = (await (await f.call(null, "/guestbook")).json()) as any;
  assert.equal(
    snapshot.pages.find((p: any) => p.id === input.id).artworkId,
    "delhincr-print-v3",
  );
});
test("original-image imports retain provenance, stay pending and require explicit human review", async (t) => {
  const f = await fixture(t);
  const bucket = await f.mf.getR2Bucket("BUCKET");
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4QAAAABJRU5ErkJggg==",
    "base64",
  );
  await bucket.put("test-only-source.png", bytes);
  const checksum = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const source = await f.call(
    "test-moderator",
    "/moderation/sources",
    "POST",
    {
      sourceCardId: "test-card",
      sourcePageId: "test-front",
      assetId: "test-image",
      sha256: checksum,
      objectKey: "test-only-source.png",
      capturedAt: null,
    },
    { bucket: bucket as any },
  );
  assert.equal(source.status, 201, await source.clone().text());
  const registered = (await source.json()) as any;
  assert.equal(
    (
      await f.call(
        "test-moderator",
        "/moderation/sources",
        "POST",
        {
          sourceCardId: "test-card",
          sourcePageId: "test-back",
          assetId: "test-image-back",
          sha256: checksum,
          objectKey: "test-only-source.png",
          capturedAt: null,
        },
        { bucket: bucket as any },
      )
    ).status,
    201,
  );
  const imported = await f.call(
    "test-moderator",
    "/moderation/imports",
    "POST",
    {
      draft,
      sourceId: registered.id,
      extracted: { name: "Test uncertain", handles: [], confidence: 0.2 },
      idempotencyKey: crypto.randomUUID(),
    },
  );
  assert.equal(imported.status, 201);
  const receipt = (await imported.json()) as any;
  assert.equal(receipt.status, "pending");
  assert.equal(receipt.signature.provenance.originalImage.sha256, checksum);
  assert.equal(receipt.signature.provenance.extracted.confidence, 0.2);
  assert.equal(
    ((await (await f.call(null, "/guestbook")).json()) as any).signatures
      .length,
    0,
  );
  const route = `/moderation/signatures/${receipt.signature.id}`;
  assert.equal(
    (
      await f.call("test-moderator", route, "POST", {
        decision: "approve",
        version: 1,
        note: "Test review without confirmations",
      })
    ).status,
    400,
  );
  await bucket.put("test-only-source.png", "synthetic changed bytes");
  assert.equal(
    (
      await f.call(
        "test-moderator",
        route,
        "POST",
        {
          decision: "approve",
          version: 1,
          note: "Review after synthetic source mutation",
          confirmTranscription: true,
          confirmConsent: true,
        },
        { bucket: bucket as any },
      )
    ).status,
    409,
  );
  await bucket.put("test-only-source.png", bytes);
  assert.equal(
    (
      await f.call(
        "test-moderator",
        route,
        "POST",
        {
          decision: "approve",
          version: 1,
          note: "Explicitly reviewed synthetic test source",
          confirmTranscription: true,
          confirmConsent: true,
        },
        { bucket: bucket as any },
      )
    ).status,
    200,
  );
  const record = ((await (await f.call(null, "/guestbook")).json()) as any)
    .signatures[0];
  assert.equal(record.provenance.review, "approved");
  assert.equal(record.provenance.sourceCardId, "test-card");
  assert.equal(record.provenance.sourcePageId, "test-front");
});
test("HTTP adapter uses authenticated ownership and keeps pending receipts out of public data", async (t) => {
  const f = await fixture(t),
    previous = globalThis.fetch;
  const authorization: string[] = [];
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.has("authorization"))
      authorization.push(headers.get("authorization")!);
    return f.call(
      "test-user",
      String(input).replace(/^\/api/, ""),
      init?.method || "GET",
      init?.body ? JSON.parse(String(init.body)) : undefined,
    );
  };
  try {
    const first = createHttpGuestbook("/api", true);
    assert.equal((await first.load()).signedIn, true);
    const receipt = await first.publish(draft, crypto.randomUUID());
    assert.equal(receipt.status, "pending");
    assert.equal(receipt.ownerToken, undefined);
    const second = createHttpGuestbook("/api", true),
      snapshot = await second.load();
    assert.equal(snapshot.signatures.length, 0);
    assert.equal(snapshot.ownSignatures?.[0].id, receipt.signature.id);
    const changed = await second.update(
      receipt.signature.id,
      "not-used-by-public-auth",
      { ...draft, name: "Edited test" },
    );
    assert.equal(changed.status, "pending");
    assert.deepEqual(changed.position, draft.position);
    await second.remove(receipt.signature.id, "not-used-by-public-auth");
    assert.deepEqual((await second.load()).ownSignatures, []);
    assert.deepEqual(authorization, []);
  } finally {
    globalThis.fetch = previous;
  }
});
