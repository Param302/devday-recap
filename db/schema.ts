import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/sqlite-core";

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    artworkId: text("artwork_id").notNull(),
    sort: integer("sort").notNull(),
    sourceCardId: text("source_card_id"),
    sourcePageId: text("source_page_id"),
  },
  (t) => [uniqueIndex("pages_sort_unique").on(t.sort)],
);

// Private source registry. No photographs or event records are seeded by migrations.
export const sourceCards = sqliteTable(
  "source_cards",
  {
    id: text("id").primaryKey(),
    physicalCardId: text("physical_card_id"),
    sourcePageId: text("source_page_id").notNull(),
    imageAssetId: text("image_asset_id").notNull(),
    imageSha256: text("image_sha256").notNull(),
    imageObjectKey: text("image_object_key").notNull(),
    capturedAt: text("captured_at"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("source_card_page_unique").on(t.physicalCardId, t.sourcePageId),
    check("source_sha256_length", sql`length(${t.imageSha256}) = 64`),
  ],
);

export const signatures = sqliteTable(
  "signatures",
  {
    id: text("id").primaryKey(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id),
    ownerId: text("owner_id"),
    name: text("name").notNull(),
    x: real("x").notNull(),
    y: real("y").notNull(),
    width: real("width").notNull(),
    height: real("height").notNull(),
    font: text("font").notNull(),
    ink: text("ink").notNull(),
    socials: text("socials").notNull(),
    status: text("status").notNull(),
    kind: text("kind").notNull(),
    reviewStatus: text("review_status").notNull(),
    sourceCardId: text("source_card_id").references(() => sourceCards.id),
    provenance: text("provenance").notNull(),
    consentedAt: text("consented_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    version: integer("version").notNull().default(1),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    operationId: text("operation_id").notNull(),
  },
  (t) => [
    uniqueIndex("signatures_owner_idempotency").on(t.ownerId, t.idempotencyKey),
    index("signatures_page_status").on(t.pageId, t.status),
    index("signatures_owner_status").on(t.ownerId, t.status),
    check(
      "signature_status",
      sql`${t.status} IN ('pending','public','rejected','deleted')`,
    ),
    check("signature_kind", sql`${t.kind} IN ('visitor','event-card-import')`),
    check(
      "signature_review",
      sql`${t.reviewStatus} IN ('not-required','pending','approved','rejected')`,
    ),
    check(
      "signature_style",
      sql`${t.font} IN ('caveat','dancing','kalam') AND ${t.ink} IN ('#252822','#355b93','#5f7143','#86516d')`,
    ),
    check(
      "signature_bounds",
      sql`${t.x} >= 0 AND ${t.y} >= 0 AND ${t.width} > 0 AND ${t.height} > 0 AND ${t.x}+${t.width} <= 1 AND ${t.y}+${t.height} <= 1`,
    ),
    check(
      "signature_json",
      sql`json_valid(${t.socials}) AND json_valid(${t.provenance})`,
    ),
    check(
      "import_source_required",
      sql`${t.kind} != 'event-card-import' OR ${t.sourceCardId} IS NOT NULL`,
    ),
    check(
      "review_before_public",
      sql`${t.status} != 'public' OR (${t.kind} = 'visitor' AND ${t.consentedAt} IS NOT NULL) OR (${t.kind} = 'event-card-import' AND ${t.reviewStatus} = 'approved' AND ${t.consentedAt} IS NOT NULL)`,
    ),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    signatureId: text("signature_id")
      .notNull()
      .references(() => signatures.id),
    reporterId: text("reporter_id").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: text("created_at").notNull(),
    resolvedBy: text("resolved_by"),
    resolvedAt: text("resolved_at"),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    uniqueIndex("reports_one_per_user_signature").on(
      t.signatureId,
      t.reporterId,
    ),
    index("reports_status_created").on(t.status, t.createdAt),
    check("report_status", sql`${t.status} IN ('open','resolved','dismissed')`),
  ],
);

export const reviewAudit = sqliteTable("review_audit", {
  id: text("id").primaryKey(),
  signatureId: text("signature_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [
    index("rate_limits_expiry").on(t.expiresAt),
    check("positive_rate_count", sql`${t.count} > 0`),
  ],
);
