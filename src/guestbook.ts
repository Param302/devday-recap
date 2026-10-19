import { demoPages, demoSignatures } from "./demo.ts";
import {
  validateDraft,
  validatePublicSnapshot,
  type CardPage,
  type Signature,
  type Draft,
} from "./domain.ts";
export type Snapshot = {
  pages: CardPage[];
  signatures: Signature[];
  ownSignatures?: Signature[];
  signedIn?: boolean;
  signInPath?: string;
};
export type Owned = {
  signature: Signature;
  ownerToken?: string;
  status?: string;
};
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
// The HTTP adapter uses dispatch-owned ChatGPT sessions, never demo owner tokens.
// Private /me records and versions let the same signed-in owner manage signatures
// after refresh and on another device. Public snapshots remain separate.
export function createHttpGuestbook(
  base: string,
  artworkReady: boolean,
): Guestbook {
  if (!/^\/[a-zA-Z0-9/_-]+$/.test(base))
    throw new Error("Guestbook API must be a same-origin path.");
  const ownedVersions = new Map<string, number>();
  let knownPages: CardPage[] = [];
  async function request(path: string, method = "GET", body?: unknown) {
    const response = await fetch(base + path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      let message = "";
      if ([400, 401, 403, 404, 409, 410, 429].includes(response.status)) {
        try {
          const error = await response.json();
          if (typeof error.error === "string" && error.error.length <= 300)
            message = error.error;
        } catch {}
      }
      throw new Error(
        message ||
          (response.status === 429
            ? "Too many requests. Please try again later."
            : method === "GET"
              ? "The shared guestbook is unavailable."
              : "Could not confirm publication. Check your signatures before retrying."),
      );
    }
    return response.status === 204 ? null : response.json();
  }
  function privateSignature(value: unknown): Signature {
    if (!value || typeof value !== "object")
      throw new Error("Invalid private signature response.");
    const s = value as Signature;
    if (
      typeof s.id !== "string" ||
      !s.id ||
      !Number.isInteger(s.version) ||
      s.version! < 1 ||
      !["pending", "public", "rejected"].includes(s.status || "") ||
      !["pending", "public"].includes(s.visibility) ||
      !s.provenance ||
      !["visitor", "event-card-import"].includes(s.provenance.kind)
    )
      throw new Error("Invalid private signature response.");
    const draft = validateDraft(s, [], knownPages);
    if (draft.position.x !== s.position.x || draft.position.y !== s.position.y)
      throw new Error("Invalid private signature position.");
    return { ...s, ...draft };
  }
  return {
    mode: "public",
    async load() {
      const health = await request("/health");
      if (
        health.mode !== "public" ||
        health.identity !== "chatgpt" ||
        health.publication !== "review-required" ||
        health.capabilities?.moderation !== true ||
        health.capabilities?.rateLimit !== true ||
        health.capabilities?.ownerControls !== true
      )
        throw new Error(
          "Shared publishing is not configured with moderation, rate limiting and owner controls.",
        );
      const snapshot = validatePublicSnapshot(await request("/guestbook"));
      knownPages = snapshot.pages;
      const me = await request("/me");
      if (
        typeof me.signedIn !== "boolean" ||
        typeof me.signInPath !== "string" ||
        !me.signInPath.startsWith("/") ||
        me.signInPath.startsWith("//") ||
        !Array.isArray(me.signatures) ||
        me.signatures.length > 100 ||
        (!me.signedIn && me.signatures.length)
      )
        throw new Error("Invalid ownership response.");
      const ownSignatures = me.signatures.map(privateSignature);
      ownedVersions.clear();
      for (const s of ownSignatures) ownedVersions.set(s.id, s.version!);
      return {
        ...snapshot,
        ownSignatures,
        signedIn: me.signedIn,
        signInPath: me.signInPath,
      };
    },
    async publish(draft, idempotencyKey) {
      if (!artworkReady)
        throw new Error(
          "Publishing awaits the original artwork and verified writing regions.",
        );
      const result = await request("/signatures", "POST", {
        draft,
        idempotencyKey,
        consent: true,
      });
      const signature = privateSignature(result.signature);
      ownedVersions.set(signature.id, signature.version!);
      return { signature, status: result.status };
    },
    async update(id, _demoToken, draft) {
      if (!artworkReady) throw new Error("Editing awaits verified artwork.");
      const version = ownedVersions.get(id);
      if (!version) throw new Error("Reload your signatures before editing.");
      const result = await request(
        `/signatures/${encodeURIComponent(id)}`,
        "PATCH",
        { draft, version, consent: true },
      );
      const signature = privateSignature(result.signature);
      ownedVersions.set(id, signature.version!);
      return signature;
    },
    async remove(id, _demoToken) {
      const version = ownedVersions.get(id);
      if (!version) throw new Error("Reload your signatures before removing.");
      await request(`/signatures/${encodeURIComponent(id)}`, "DELETE", {
        version,
      });
      ownedVersions.delete(id);
    },
    async report(id, reason) {
      await request(`/signatures/${encodeURIComponent(id)}/reports`, "POST", {
        reason,
      });
    },
  };
}
