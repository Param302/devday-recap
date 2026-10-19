export type Point = { x: number; y: number };
export const FONTS = ["caveat", "dancing", "kalam"] as const;
export const INKS = ["#252822", "#355b93", "#5f7143", "#86516d"] as const;
export type Font = (typeof FONTS)[number];
export type Social = { label: string; url: string };
export type Provenance = {
  kind: "visitor" | "event-card-import" | "demo";
  sourceCardId: string | null;
  sourcePageId: string | null;
  originalImage: {
    assetId: string;
    sha256: string;
    capturedAt: string | null;
  } | null;
  extracted: {
    name: string | null;
    handles: string[];
    confidence: number | null;
  } | null;
  review: "not-required" | "pending" | "approved" | "rejected";
};
export type Signature = {
  version?: number;
  status?: "pending" | "public" | "rejected";
  id: string;
  pageId: string;
  name: string;
  position: Point;
  font: Font;
  ink: (typeof INKS)[number];
  socials: Social[];
  createdAt: string;
  visibility: "demo" | "public" | "pending";
  provenance: Provenance;
};
export type CardPage = {
  id: string;
  sourceCardId: string | null;
  sourcePageId: string | null;
  artworkId: string;
  order: number;
};
export type Draft = Pick<
  Signature,
  "pageId" | "name" | "position" | "font" | "ink" | "socials"
>;
// Provisional demo-only writing zone. Public publishing stays blocked until the original
// artwork is available and a reviewer verifies safe regions against its actual pixels.
export const SAFE_ZONE = { left: 0.08, top: 0.35, right: 0.9, bottom: 0.62 };
export const SIGNATURE_HEIGHT = 0.065;
export function signatureWidth(name: string) {
  return Math.min(0.66, Math.max(0.14, [...name].length * 0.022 + 0.04));
}
export function normalizePosition(point: Point, name: string): Point {
  const finite = Number.isFinite(point.x) && Number.isFinite(point.y);
  if (!finite) throw new Error("Choose a position on the card.");
  return {
    x: Math.max(
      SAFE_ZONE.left,
      Math.min(SAFE_ZONE.right - signatureWidth(name), point.x),
    ),
    y: Math.max(
      SAFE_ZONE.top,
      Math.min(SAFE_ZONE.bottom - SIGNATURE_HEIGHT, point.y),
    ),
  };
}
export function overlaps(
  a: Pick<Draft, "position" | "name">,
  b: Pick<Draft, "position" | "name">,
) {
  return (
    a.position.x < b.position.x + signatureWidth(b.name) + 0.015 &&
    a.position.x + signatureWidth(a.name) + 0.015 > b.position.x &&
    Math.abs(a.position.y - b.position.y) < SIGNATURE_HEIGHT + 0.015
  );
}
export function safeSocial(value: string): Social | null {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > 200)
    throw new Error("Keep each social link under 200 characters.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Use a full https:// social profile URL.");
  }
  const allowed = [
    "github.com",
    "linkedin.com",
    "www.linkedin.com",
    "instagram.com",
    "www.instagram.com",
    "x.com",
    "bsky.app",
    "mastodon.social",
  ];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !allowed.includes(url.hostname) ||
    url.pathname === "/"
  )
    throw new Error(
      "Use an HTTPS profile on GitHub, LinkedIn, Instagram, X, Bluesky or mastodon.social.",
    );
  url.hash = "";
  url.search = "";
  return {
    label: url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, ""),
    url: url.toString(),
  };
}
export function validateDraft(
  draft: Draft,
  existing: Signature[],
  pages: CardPage[],
) {
  const name = draft.name.trim().normalize("NFC");
  if (
    [...name].length < 2 ||
    [...name].length > 28 ||
    /[\p{Cc}\p{Cf}<>]/u.test(name)
  )
    throw new Error(
      "Use a name between 2 and 28 characters, without control characters or markup.",
    );
  if (!pages.some((p) => p.id === draft.pageId))
    throw new Error("This card page is unavailable.");
  if (!FONTS.includes(draft.font) || !INKS.includes(draft.ink))
    throw new Error("Choose an available signing style and ink.");
  if (draft.socials.length > 2) throw new Error("Add up to two social links.");
  const socials = draft.socials.map((s) => safeSocial(s.url)!).filter(Boolean);
  const position = normalizePosition(draft.position, name);
  if (
    existing.some(
      (s) => s.pageId === draft.pageId && overlaps({ name, position }, s),
    )
  )
    throw new Error(
      "That spot overlaps another signature. Choose an open spot on this page.",
    );
  return { ...draft, name, position, socials };
}
export function importIsPublishable(signature: Signature) {
  return (
    signature.provenance.kind !== "demo" &&
    (signature.provenance.kind !== "event-card-import" ||
      (signature.provenance.review === "approved" &&
        !!signature.provenance.originalImage &&
        !!signature.provenance.sourceCardId &&
        !!signature.provenance.sourcePageId))
  );
}
export function findSignatures(signatures: Signature[], query: string) {
  const q = query.trim().toLocaleLowerCase().replace(/^@/, "");
  return q
    ? signatures.filter((s) =>
        [s.name, ...s.socials.map((l) => l.label)].some((v) =>
          v.toLocaleLowerCase().includes(q),
        ),
      )
    : [];
}
export function validatePublicSnapshot(value: unknown): {
  pages: CardPage[];
  signatures: Signature[];
} {
  const fail = () => {
    throw new Error("The shared guestbook returned invalid or demo records.");
  };
  if (!value || typeof value !== "object") return fail();
  const data = value as { pages: CardPage[]; signatures: Signature[] };
  if (
    !Array.isArray(data.pages) ||
    !Array.isArray(data.signatures) ||
    data.pages.length > 1000 ||
    data.signatures.length > 20000
  )
    return fail();
  const ids = new Set<string>();
  for (const p of data.pages) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      p.artworkId !== "delhincr-print-v3" ||
      !Number.isInteger(p.order)
    )
      return fail();
    ids.add(p.id);
  }
  const signatureIds = new Set<string>();
  for (const s of data.signatures) {
    try {
      if (
        !s ||
        typeof s.id !== "string" ||
        !s.id ||
        signatureIds.has(s.id) ||
        s.visibility !== "public" ||
        !s.provenance ||
        !["visitor", "event-card-import"].includes(s.provenance.kind) ||
        !importIsPublishable(s) ||
        typeof s.name !== "string" ||
        !s.position ||
        !Array.isArray(s.socials) ||
        s.socials.some((l) => !l || typeof l.url !== "string")
      )
        return fail();
      const valid = validateDraft(s, [], data.pages);
      if (
        valid.position.x !== s.position.x ||
        valid.position.y !== s.position.y ||
        valid.name !== s.name
      )
        return fail();
      // Derive labels from validated URLs; never trust server-provided labels or HTML.
      s.socials = valid.socials;
      signatureIds.add(s.id);
    } catch {
      return fail();
    }
  }
  return {
    pages: [...data.pages].sort((a, b) => a.order - b.order),
    signatures: data.signatures,
  };
}
