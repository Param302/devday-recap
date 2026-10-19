import type { CardPage, Signature } from "./domain";
export const demoPages: CardPage[] = [1, 2, 3].map((n) => ({
  id: `demo-page-${n}`,
  sourceCardId: null,
  sourcePageId: null,
  artworkId: "delhincr-print-v3",
  order: n,
}));
export const demoSignatures: Signature[] = [
  {
    id: "demo-one",
    pageId: "demo-page-1",
    name: "Demo signature",
    position: { x: 0.12, y: 0.38 },
    font: "caveat",
    ink: "#355b93",
    socials: [],
    createdAt: "2026-10-19T00:00:00Z",
    visibility: "demo",
    provenance: {
      kind: "demo",
      sourceCardId: null,
      sourcePageId: null,
      originalImage: null,
      extracted: null,
      review: "not-required",
    },
  },
  {
    id: "demo-two",
    pageId: "demo-page-2",
    name: "Demo example",
    position: { x: 0.28, y: 0.48 },
    font: "dancing",
    ink: "#86516d",
    socials: [],
    createdAt: "2026-10-19T00:00:00Z",
    visibility: "demo",
    provenance: {
      kind: "demo",
      sourceCardId: null,
      sourcePageId: null,
      originalImage: null,
      extracted: null,
      review: "not-required",
    },
  },
];
