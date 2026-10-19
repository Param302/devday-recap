import {
  validateDraft,
  signatureWidth,
  SIGNATURE_HEIGHT,
  type Draft,
  type Signature,
  type CardPage,
  type Provenance,
} from "../src/domain.ts";
import type { ApiDependencies, SignatureRow } from "./types.ts";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
function fail(status: number, message: string): never {
  throw new ApiError(status, message);
}
const uuid = () => crypto.randomUUID();
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail(400, "Use a JSON object.");
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((k) => !allowed.includes(k)))
    fail(400, "Unsupported input fields.");
}
function bounded(value: unknown, min: number, max: number, label: string) {
  if (
    typeof value !== "string" ||
    [...value.trim()].length < min ||
    [...value.trim()].length > max ||
    /[\p{Cc}\p{Cf}<>]/u.test(value)
  )
    fail(400, `Invalid ${label}.`);
  return value.trim().normalize("NFC");
}
function version(value: unknown) {
  if (!Number.isInteger(value) || Number(value) < 1)
    fail(400, "Supply the current signature version.");
  return value as number;
}
async function sha256(value: string | ArrayBuffer) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
async function body(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    fail(415, "Use application/json.");
  if (Number(request.headers.get("content-length") || 0) > 8192)
    fail(413, "Request body is too large.");
  if (!request.body) fail(400, "A JSON body is required.");
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      fail(413, "Request body is too large.");
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return object(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return fail(400, "Invalid JSON.");
  }
}
function publicSignature(row: SignatureRow): Signature & { version: number } {
  const provenance = JSON.parse(row.provenance) as Provenance;
  provenance.review = row.review_status;
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    position: { x: row.x, y: row.y },
    font: row.font as Draft["font"],
    ink: row.ink as Draft["ink"],
    socials: JSON.parse(row.socials),
    visibility: row.status === "public" ? "public" : "pending",
    createdAt: row.created_at,
    provenance,
    version: row.version,
  };
}
function ownSignature(row: SignatureRow) {
  return { ...publicSignature(row), status: row.status };
}

export function createGuestbookApi(deps: ApiDependencies) {
  const { db } = deps;
  const now = () => deps.now?.() ?? Date.now();
  async function pages(): Promise<CardPage[]> {
    const result = await db
      .prepare(
        "SELECT id,artwork_id,sort,source_card_id,source_page_id FROM pages ORDER BY sort LIMIT 1000",
      )
      .all<{
        id: string;
        artwork_id: string;
        sort: number;
        source_card_id: string | null;
        source_page_id: string | null;
      }>();
    return result.results.map((p) => ({
      id: p.id,
      artworkId: p.artwork_id,
      order: p.sort,
      sourceCardId: p.source_card_id,
      sourcePageId: p.source_page_id,
    }));
  }
  async function row(id: string) {
    return db
      .prepare("SELECT * FROM signatures WHERE id = ?")
      .bind(id)
      .first<SignatureRow>();
  }
  async function limit(
    subject: string,
    action: string,
    max: number,
    seconds: number,
  ) {
    const time = Math.floor(now() / 1000);
    const window = Math.floor(time / seconds) * seconds;
    await db
      .prepare("DELETE FROM rate_limits WHERE expires_at < ?")
      .bind(time)
      .run();
    const result = await db
      .prepare(
        "INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count",
      )
      .bind(`${action}:${subject}:${window}`, window + seconds, max)
      .first<{ count: number }>();
    if (!result) fail(429, "Too many requests. Please try again later.");
  }
  async function checkedDraft(input: unknown): Promise<Draft> {
    const d = object(input);
    keys(d, ["pageId", "name", "position", "font", "ink", "socials"]);
    if (
      typeof d.pageId !== "string" ||
      typeof d.name !== "string" ||
      typeof d.font !== "string" ||
      typeof d.ink !== "string" ||
      !Array.isArray(d.socials)
    )
      fail(400, "Invalid signature fields.");
    const p = object(d.position);
    keys(p, ["x", "y"]);
    if (typeof p.x !== "number" || typeof p.y !== "number")
      fail(400, "Choose a valid position.");
    for (const value of d.socials) {
      const link = object(value);
      keys(link, ["label", "url"]);
      if (typeof link.url !== "string") fail(400, "Invalid profile URL.");
    }
    try {
      const valid = validateDraft(d as unknown as Draft, [], await pages());
      if (valid.position.x !== p.x || valid.position.y !== p.y)
        fail(400, "Signature position is outside the verified writing zone.");
      return valid;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      return fail(400, (error as Error).message);
    }
  }
  async function existingReceipt(owner: string, key: string, hash: string) {
    const current = await db
      .prepare(
        "SELECT * FROM signatures WHERE owner_id = ? AND idempotency_key = ?",
      )
      .bind(owner, key)
      .first<SignatureRow>();
    if (!current) return null;
    if (current.request_hash !== hash)
      fail(409, "This submission key was already used for different content.");
    if (current.status === "deleted")
      fail(410, "This signature was removed. Start a new submission.");
    return current;
  }
  const collision = `NOT EXISTS (SELECT 1 FROM signatures s WHERE s.page_id = ? AND s.status IN ('pending','public') AND s.id != ? AND s.x < ? AND s.x+s.width+0.015 > ? AND abs(s.y-?) < ?)`;
  async function insertSignature(
    draft: Draft,
    owner: string | null,
    key: string,
    hash: string,
    provenance: Provenance,
    sourceId: string | null,
    consentedAt: string | null,
  ) {
    const id = uuid(),
      time = new Date(now()).toISOString();
    const width = signatureWidth(draft.name);
    const height = SIGNATURE_HEIGHT;
    try {
      const result = await db
        .prepare(
          `INSERT INTO signatures (id,page_id,owner_id,name,x,y,width,height,font,ink,socials,status,kind,review_status,source_card_id,provenance,consented_at,created_at,updated_at,version,idempotency_key,request_hash,operation_id) SELECT ?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,1,?,?,? WHERE EXISTS (SELECT 1 FROM pages WHERE id = ?) AND ${collision}`,
        )
        .bind(
          id,
          draft.pageId,
          owner,
          draft.name,
          draft.position.x,
          draft.position.y,
          width,
          height,
          draft.font,
          draft.ink,
          JSON.stringify(draft.socials),
          provenance.kind,
          provenance.review,
          sourceId,
          JSON.stringify(provenance),
          consentedAt,
          time,
          time,
          key,
          hash,
          uuid(),
          draft.pageId,
          draft.pageId,
          id,
          draft.position.x + width + 0.015,
          draft.position.x,
          draft.position.y,
          height + 0.015,
        )
        .run();
      if (result.meta.changes !== 1) {
        if (owner) {
          const receipt = await existingReceipt(owner, key, hash);
          if (receipt) return receipt;
        }
        fail(
          409,
          "That spot is already reserved. Choose a new position and preview again.",
        );
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (owner) {
        const receipt = await existingReceipt(owner, key, hash);
        if (receipt) return receipt;
      }
      throw error;
    }
    return (await row(id))!;
  }
  return async function handle(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url),
        path = url.pathname.replace(/\/$/, "");
      const method = request.method;
      if (!path.startsWith("/api/")) return json({ error: "Not found." }, 404);
      if (method === "OPTIONS")
        return json({ error: "Cross-origin access is not supported." }, 405);
      let user = await deps.getChatGPTUser();
      if (
        user &&
        (typeof user.userId !== "string" ||
          !user.userId ||
          user.userId.length > 200)
      )
        fail(503, "Identity is unavailable.");
      const moderator = !!user && deps.moderatorUserIds.has(user.userId);
      const write = !["GET", "HEAD"].includes(method);
      if (write) {
        if (
          request.headers.get("origin") !== url.origin ||
          ["cross-site", "same-site"].includes(
            request.headers.get("sec-fetch-site") || "",
          )
        )
          fail(403, "This action must come from this site.");
        if (!user) fail(401, "Sign in with ChatGPT to continue.");
        await limit(user.userId, "writes", 60, 3600);
        await limit("all", "global-writes", 120, 60);
      }
      if (path.startsWith("/api/moderation") && !moderator)
        fail(403, "Organizer access is required.");
      if (path === "/api/moderation/pages" && method === "POST") {
        const input = await body(request);
        keys(input, ["id", "order", "sourceCardId", "sourcePageId"]);
        const id = bounded(input.id, 1, 100, "page ID");
        if (
          !Number.isInteger(input.order) ||
          Number(input.order) < 1 ||
          Number(input.order) > 1000
        )
          fail(400, "Choose a page order between 1 and 1000.");
        const card =
            input.sourceCardId == null
              ? null
              : bounded(input.sourceCardId, 1, 100, "source card ID"),
          sourcePage =
            input.sourcePageId == null
              ? null
              : bounded(input.sourcePageId, 1, 100, "source page ID");
        const result = await db
          .prepare(
            "INSERT INTO pages (id,artwork_id,sort,source_card_id,source_page_id) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
          )
          .bind(id, "delhincr-print-v3", input.order, card, sourcePage)
          .run();
        if (result.meta.changes !== 1)
          fail(409, "That page ID or order is already in use.");
        return json({ id }, 201);
      }
      if (path === "/api/health" && method === "GET")
        return json({
          mode: "public",
          capabilities: {
            moderation: deps.moderatorUserIds.size > 0,
            rateLimit: true,
            ownerControls: true,
          },
          artworkReady: deps.artworkVerified,
          publication: "review-required",
          identity: "chatgpt",
        });
      if (path === "/api/guestbook" && method === "GET") {
        const result = await db
          .prepare(
            "SELECT * FROM signatures WHERE status = 'public' ORDER BY created_at,id LIMIT 20000",
          )
          .all<SignatureRow>();
        return json({
          pages: await pages(),
          signatures: result.results.map(publicSignature),
        });
      }
      if (path === "/api/me" && method === "GET") {
        const own = user
          ? await db
              .prepare(
                "SELECT * FROM signatures WHERE owner_id = ? AND status != 'deleted' ORDER BY created_at,id LIMIT 100",
              )
              .bind(user.userId)
              .all<SignatureRow>()
          : null;
        const signInPath = deps.chatGPTSignInPath("/");
        if (!signInPath.startsWith("/") || signInPath.startsWith("//"))
          fail(503, "Sign-in configuration is unavailable.");
        return json({
          signedIn: !!user,
          signInPath,
          moderator,
          signatures: own?.results.map(ownSignature) || [],
        });
      }
      if (path === "/api/signatures" && method === "POST") {
        if (!deps.artworkVerified || deps.moderatorUserIds.size === 0)
          fail(
            503,
            "Publishing awaits verified artwork and organizer review configuration.",
          );
        const input = await body(request);
        keys(input, ["draft", "idempotencyKey", "consent"]);
        if (input.consent !== true)
          fail(400, "Confirm that your name and links may be public.");
        const draft = await checkedDraft(input.draft);
        const key = bounded(input.idempotencyKey, 16, 80, "submission key");
        const hash = await sha256(JSON.stringify({ draft, consent: true }));
        const receipt = await existingReceipt(user!.userId, key, hash);
        if (receipt)
          return json(
            { signature: ownSignature(receipt), status: receipt.status },
            200,
          );
        await limit(user!.userId, "signatures", 5, 3600);
        const result = await insertSignature(
          draft,
          user!.userId,
          key,
          hash,
          {
            kind: "visitor",
            sourceCardId: null,
            sourcePageId: null,
            originalImage: null,
            extracted: null,
            review: "not-required",
          },
          null,
          new Date(now()).toISOString(),
        );
        return json(
          { signature: ownSignature(result), status: result.status },
          201,
        );
      }
      const signatureMatch = path.match(/^\/api\/signatures\/([^/]+)$/);
      if (signatureMatch && ["PATCH", "DELETE"].includes(method)) {
        const current = await row(signatureMatch[1]);
        if (
          !current ||
          current.owner_id !== user!.userId ||
          current.status === "deleted"
        )
          fail(404, "Signature not found.");
        const input = await body(request);
        const expected = version(input.version);
        if (method === "DELETE") {
          keys(input, ["version"]);
          const result = await db
            .prepare(
              "UPDATE signatures SET status='deleted',name='',socials='[]',provenance='{}',version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? AND status!='deleted'",
            )
            .bind(
              new Date(now()).toISOString(),
              current.id,
              user!.userId,
              expected,
            )
            .run();
          if (result.meta.changes !== 1)
            fail(409, "This signature changed. Refresh before removing it.");
          return new Response(null, {
            status: 204,
            headers: { "Cache-Control": "no-store" },
          });
        }
        if (!deps.artworkVerified)
          fail(503, "Editing awaits verified artwork.");
        keys(input, ["draft", "version", "consent"]);
        if (input.consent !== true) fail(400, "Confirm public visibility.");
        const draft = await checkedDraft(input.draft);
        if (draft.pageId !== current.page_id)
          fail(400, "Keep your signature on its original page.");
        const w = signatureWidth(draft.name);
        const result = await db
          .prepare(
            `UPDATE signatures SET name=?,x=?,y=?,width=?,font=?,ink=?,socials=?,status='pending',consented_at=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? AND status!='deleted' AND ${collision}`,
          )
          .bind(
            draft.name,
            draft.position.x,
            draft.position.y,
            w,
            draft.font,
            draft.ink,
            JSON.stringify(draft.socials),
            new Date(now()).toISOString(),
            new Date(now()).toISOString(),
            current.id,
            user!.userId,
            expected,
            draft.pageId,
            current.id,
            draft.position.x + w + 0.015,
            draft.position.x,
            draft.position.y,
            SIGNATURE_HEIGHT + 0.015,
          )
          .run();
        if (result.meta.changes !== 1)
          fail(
            409,
            "The signature changed or that spot is reserved. Refresh and preview again.",
          );
        return json({
          signature: ownSignature((await row(current.id))!),
          status: "pending",
        });
      }
      const reportMatch = path.match(/^\/api\/signatures\/([^/]+)\/reports$/);
      if (reportMatch && method === "POST") {
        const input = await body(request);
        keys(input, ["reason"]);
        const reason = bounded(input.reason, 5, 500, "report reason");
        const target = await row(reportMatch[1]);
        if (!target || target.status !== "public")
          fail(404, "Signature not found.");
        await limit(user!.userId, "reports", 10, 3600);
        await db
          .prepare(
            "INSERT INTO reports (id,signature_id,reporter_id,reason,status,created_at) VALUES (?,?,?,?,'open',?) ON CONFLICT(signature_id,reporter_id) DO NOTHING",
          )
          .bind(
            uuid(),
            target.id,
            user!.userId,
            reason,
            new Date(now()).toISOString(),
          )
          .run();
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
      }
      if (path === "/api/moderation" && method === "GET") {
        const pending = await db
          .prepare(
            "SELECT * FROM signatures WHERE status='pending' ORDER BY created_at LIMIT 100",
          )
          .all<SignatureRow>();
        const reports = await db
          .prepare(
            "SELECT id,signature_id,reason,status,created_at FROM reports WHERE status='open' ORDER BY created_at LIMIT 100",
          )
          .all();
        return json({
          signatures: pending.results.map(ownSignature),
          reports: reports.results,
        });
      }
      const reviewMatch = path.match(
        /^\/api\/moderation\/signatures\/([^/]+)$/,
      );
      if (reviewMatch && method === "POST") {
        const input = await body(request);
        keys(input, [
          "decision",
          "version",
          "note",
          "confirmTranscription",
          "confirmConsent",
        ]);
        if (!["approve", "reject", "hide"].includes(String(input.decision)))
          fail(400, "Choose approve, reject or hide.");
        const expected = version(input.version),
          note = bounded(input.note, 5, 500, "review note");
        const current = await row(reviewMatch[1]);
        if (!current || !["pending", "public"].includes(current.status))
          fail(409, "This signature is no longer available for review.");
        if (input.decision === "hide" && current.status !== "public")
          fail(409, "Only public signatures can be hidden.");
        if (input.decision !== "hide" && current.status !== "pending")
          fail(409, "This signature is no longer pending review.");
        const approve = input.decision === "approve";
        if (approve && !deps.artworkVerified)
          fail(503, "Artwork must be verified before public approval.");
        if (
          approve &&
          current.kind === "event-card-import" &&
          (input.confirmTranscription !== true || input.confirmConsent !== true)
        )
          fail(
            400,
            "Explicitly confirm the reviewed transcription and public consent.",
          );
        if (approve && current.kind === "event-card-import") {
          if (!deps.bucket)
            fail(
              503,
              "Original-photo storage must be available for import review.",
            );
          const source = await db
            .prepare(
              "SELECT image_object_key,image_sha256 FROM source_cards WHERE id=?",
            )
            .bind(current.source_card_id)
            .first<{ image_object_key: string; image_sha256: string }>();
          if (!source) fail(409, "The original source record is unavailable.");
          const image = await deps.bucket.get(source.image_object_key);
          if (
            !image ||
            image.size > 20 * 1024 * 1024 ||
            (await sha256(await image.arrayBuffer())) !== source.image_sha256
          )
            fail(
              409,
              "The original image is unavailable or changed. Review the original source again.",
            );
        }
        const time = new Date(now()).toISOString(),
          op = uuid();
        const results = await db.batch([
          db
            .prepare(
              "UPDATE signatures SET status=?,review_status=?,consented_at=?,version=version+1,updated_at=?,operation_id=? WHERE id=? AND status=? AND version=?",
            )
            .bind(
              approve ? "public" : "rejected",
              current.kind === "event-card-import"
                ? approve
                  ? "approved"
                  : "rejected"
                : current.review_status,
              approve ? current.consented_at || time : current.consented_at,
              time,
              op,
              current.id,
              current.status,
              expected,
            ),
          db
            .prepare(
              "INSERT INTO review_audit (id,signature_id,actor_id,action,note,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM signatures WHERE id=? AND operation_id=?)",
            )
            .bind(
              op,
              current.id,
              user!.userId,
              String(input.decision),
              note,
              time,
              current.id,
              op,
            ),
        ]);
        if (results[0].meta.changes !== 1)
          fail(409, "This signature changed during review. Refresh it.");
        return json({ signature: ownSignature((await row(current.id))!) });
      }
      const resolutionMatch = path.match(
        /^\/api\/moderation\/reports\/([^/]+)$/,
      );
      if (resolutionMatch && method === "POST") {
        const input = await body(request);
        keys(input, ["decision", "note"]);
        if (!["resolved", "dismissed"].includes(String(input.decision)))
          fail(400, "Choose a report resolution.");
        const note = bounded(input.note, 5, 500, "resolution note");
        const result = await db
          .prepare(
            "UPDATE reports SET status=?,resolved_by=?,resolved_at=?,resolution_note=? WHERE id=? AND status='open'",
          )
          .bind(
            input.decision,
            user!.userId,
            new Date(now()).toISOString(),
            note,
            resolutionMatch[1],
          )
          .run();
        if (result.meta.changes !== 1)
          fail(409, "This report is no longer open.");
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "no-store" },
        });
      }
      if (path === "/api/moderation/sources" && method === "POST") {
        if (!deps.bucket)
          fail(503, "Original-photo storage is not configured.");
        const input = await body(request);
        keys(input, [
          "sourceCardId",
          "sourcePageId",
          "assetId",
          "sha256",
          "objectKey",
          "capturedAt",
        ]);
        const physicalCardId = bounded(
            input.sourceCardId,
            1,
            100,
            "source card ID",
          ),
          id = uuid(),
          sourcePage = bounded(input.sourcePageId, 1, 100, "source page ID"),
          asset = bounded(input.assetId, 1, 150, "image asset ID"),
          key = bounded(input.objectKey, 1, 200, "image object key");
        if (
          typeof input.sha256 !== "string" ||
          !/^[a-f0-9]{64}$/.test(input.sha256)
        )
          fail(400, "Supply the original image SHA-256.");
        if (
          input.capturedAt !== null &&
          (typeof input.capturedAt !== "string" ||
            !Number.isFinite(Date.parse(input.capturedAt)))
        )
          fail(400, "Use an actual capture timestamp or null.");
        const image = await deps.bucket.get(key);
        if (!image || image.size > 20 * 1024 * 1024)
          fail(400, "Original image is missing or too large.");
        const bytes = await image.arrayBuffer();
        if ((await sha256(bytes)) !== input.sha256)
          fail(400, "Original image checksum does not match.");
        const header = new Uint8Array(bytes);
        if (
          !(
            header[0] === 0x89 &&
            header[1] === 0x50 &&
            header[2] === 0x4e &&
            header[3] === 0x47
          ) &&
          !(header[0] === 0xff && header[1] === 0xd8)
        )
          fail(400, "Supply an original PNG or JPEG image.");
        await db
          .prepare(
            "INSERT INTO source_cards (id,physical_card_id,source_page_id,image_asset_id,image_sha256,image_object_key,captured_at,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            physicalCardId,
            sourcePage,
            asset,
            input.sha256,
            key,
            input.capturedAt,
            user!.userId,
            new Date(now()).toISOString(),
          )
          .run();
        return json({ id }, 201);
      }
      if (path === "/api/moderation/imports" && method === "POST") {
        if (!deps.artworkVerified) fail(503, "Imports await verified artwork.");
        const input = await body(request);
        keys(input, ["draft", "sourceId", "extracted", "idempotencyKey"]);
        const draft = await checkedDraft(input.draft),
          sourceId = bounded(input.sourceId, 1, 100, "registered source ID"),
          key = bounded(input.idempotencyKey, 16, 80, "submission key");
        const source = await db
          .prepare("SELECT * FROM source_cards WHERE id=?")
          .bind(sourceId)
          .first<{
            id: string;
            physical_card_id: string | null;
            source_page_id: string;
            image_asset_id: string;
            image_sha256: string;
            captured_at: string | null;
          }>();
        if (!source)
          fail(400, "Register and verify the original source image first.");
        const extracted = object(input.extracted);
        keys(extracted, ["name", "handles", "confidence"]);
        if (extracted.name !== null)
          bounded(extracted.name, 1, 100, "extracted name");
        if (!Array.isArray(extracted.handles) || extracted.handles.length > 2)
          fail(400, "Supply up to two extracted handles.");
        for (const handle of extracted.handles)
          bounded(handle, 1, 200, "extracted handle");
        if (
          extracted.confidence !== null &&
          (typeof extracted.confidence !== "number" ||
            !Number.isFinite(extracted.confidence) ||
            extracted.confidence < 0 ||
            extracted.confidence > 1)
        )
          fail(400, "Use an actual confidence between zero and one, or null.");
        const provenance: Provenance = {
          kind: "event-card-import",
          sourceCardId: source.physical_card_id || source.id,
          sourcePageId: source.source_page_id,
          originalImage: {
            assetId: source.image_asset_id,
            sha256: source.image_sha256,
            capturedAt: source.captured_at,
          },
          extracted: extracted as Provenance["extracted"],
          review: "pending",
        };
        const hash = await sha256(JSON.stringify({ draft, provenance }));
        const receipt = await existingReceipt(user!.userId, key, hash);
        if (receipt)
          return json({
            signature: ownSignature(receipt),
            status: receipt.status,
          });
        // The organizer owns this pending import for corrections; attendee ownership
        // claims require a separately verified process and are never guessed.
        const result = await insertSignature(
          draft,
          user!.userId,
          key,
          hash,
          provenance,
          source.id,
          null,
        );
        return json(
          { signature: ownSignature(result), status: "pending" },
          201,
        );
      }
      return json({ error: "Not found." }, 404);
    } catch (error) {
      if (error instanceof ApiError)
        return json({ error: error.message }, error.status);
      return json(
        {
          error:
            "The guestbook could not complete this request. Refresh before retrying a write.",
        },
        503,
      );
    }
  };
}
