import { demoPages, demoSignatures } from "./demo.ts";
import {
  importIsPublishable,
  validateDraft,
  validatePublicSnapshot,
  type CardPage,
  type Signature,
  type Draft,
} from "./domain.ts";
export type Snapshot = { pages: CardPage[]; signatures: Signature[] };
export type Owned = { signature: Signature; ownerToken: string };
export interface Guestbook {
  mode: "demo" | "public";
  load(): Promise<Snapshot>;
  publish(draft: Draft, idempotencyKey: string): Promise<Owned>;
  update(id: string, token: string, draft: Draft): Promise<Signature>;
  remove(id: string, token: string): Promise<void>;
  report(id: string, reason: string): Promise<void>;
}
export function createDemoGuestbook(): Guestbook {
  let signatures = structuredClone(demoSignatures);
  const owners = new Map<string, string>();
  const submissions = new Map<string, Owned>();
  let lastPublish = 0;
  function own(id: string, token: string) {
    if (!token || owners.get(id) !== token)
      throw new Error("This session does not own that demo signature.");
  }
  return {
    mode: "demo",
    async load() {
      return { pages: demoPages, signatures: structuredClone(signatures) };
    },
    async publish(draft, key) {
      if (submissions.has(key)) return submissions.get(key)!;
      const valid = validateDraft(draft, signatures, demoPages);
      if (Date.now() - lastPublish < 10000)
        throw new Error(
          "Please wait 10 seconds before adding another demo signature.",
        );
      const signature: Signature = {
        ...valid,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        visibility: "demo",
        provenance: {
          kind: "demo",
          sourceCardId: null,
          sourcePageId: null,
          originalImage: null,
          extracted: null,
          review: "not-required",
        },
      };
      const ownerToken = crypto.randomUUID();
      owners.set(signature.id, ownerToken);
      signatures.push(signature);
      lastPublish = Date.now();
      const result = { signature, ownerToken };
      submissions.set(key, result);
      return result;
    },
    async update(id, token, draft) {
      own(id, token);
      const old = signatures.find((s) => s.id === id)!;
      const signature = {
        ...old,
        ...validateDraft(
          draft,
          signatures.filter((s) => s.id !== id),
          demoPages,
        ),
      };
      signatures = signatures.map((s) => (s.id === id ? signature : s));
      return signature;
    },
    async remove(id, token) {
      own(id, token);
      signatures = signatures.filter((s) => s.id !== id);
      owners.delete(id);
    },
    async report(id, reason) {
      if (!signatures.some((s) => s.id === id) || reason.trim().length < 5)
        throw new Error(
          "Describe the concern in at least five characters.",
        ); /* Demo only: nothing sent or moderated. */
    },
  };
}
// This adapter never falls back to fixtures if a real API fails. Server contracts are
// documented in docs/backend-contract.md. Owner tokens remain in session memory.
export function createHttpGuestbook(
  base: string,
  artworkReady: boolean,
): Guestbook {
  if (!/^\/[a-zA-Z0-9/_-]+$/.test(base))
    throw new Error("Guestbook API must be a same-origin path.");
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    token?: string,
  ) {
    const r = await fetch(base + path, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok)
      throw new Error(
        r.status === 429
          ? "Too many requests. Please try again later."
          : method === "GET"
            ? "The shared guestbook is unavailable."
            : "Could not confirm publication. Check the card before retrying.",
      );
    return r.status === 204 ? null : r.json();
  }
  return {
    mode: "public",
    async load() {
      const health = await request("/health");
      if (
        health.mode !== "public" ||
        health.capabilities?.moderation !== true ||
        health.capabilities?.rateLimit !== true ||
        health.capabilities?.ownerControls !== true
      )
        throw new Error(
          "Shared publishing is not configured with moderation, rate limiting and owner controls.",
        );
      return validatePublicSnapshot(await request("/guestbook"));
    },
    async publish(draft, idempotencyKey) {
      if (!artworkReady)
        throw new Error(
          "Publishing awaits the original artwork and verified writing regions.",
        );
      const result = await request("/signatures", "POST", {
        draft,
        idempotencyKey,
      });
      if (
        !result?.signature ||
        !importIsPublishable(result.signature) ||
        typeof result.ownerToken !== "string" ||
        result.ownerToken.length < 20
      )
        throw new Error(
          "The server returned an invalid publishing receipt. Check the card before retrying.",
        );
      return result;
    },
    async update(id, token, draft) {
      if (!artworkReady) throw new Error("Editing awaits verified artwork.");
      return request(
        `/signatures/${encodeURIComponent(id)}`,
        "PATCH",
        draft,
        token,
      );
    },
    async remove(id, token) {
      await request(
        `/signatures/${encodeURIComponent(id)}`,
        "DELETE",
        undefined,
        token,
      );
    },
    async report(id, reason) {
      await request(`/signatures/${encodeURIComponent(id)}/reports`, "POST", {
        reason,
      });
    },
  };
}
