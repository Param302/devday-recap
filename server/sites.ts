import artwork from "../src/artwork.json" with { type: "json" };
import { createGuestbookApi } from "./api.ts";
import type { ApiDependencies } from "./types.ts";

export type SitesEnvironment = {
  DB: ApiDependencies["db"];
  BUCKET?: ApiDependencies["bucket"];
  YWH_MODERATOR_USER_IDS?: string;
};
export type SitesIdentityHelpers = Pick<
  ApiDependencies,
  "getChatGPTUser" | "chatGPTSignInPath"
>;

// Composition boundary for the canonical Vinext route. Pass the actual server-only
// helper exports from app/chatgpt-auth.ts; no auth headers are read here.
export function createSitesGuestbook(
  env: SitesEnvironment,
  identity: SitesIdentityHelpers,
) {
  let values: unknown = [];
  if (env.YWH_MODERATOR_USER_IDS) {
    try {
      values = JSON.parse(env.YWH_MODERATOR_USER_IDS);
    } catch {
      throw new Error(
        "YWH_MODERATOR_USER_IDS must be a JSON array of Site-scoped user IDs.",
      );
    }
  }
  if (
    !Array.isArray(values) ||
    values.length > 20 ||
    values.some((id) => typeof id !== "string" || !id || id.length > 200)
  )
    throw new Error("Invalid moderator Site user IDs.");
  if (!env.DB) throw new Error("The Sites D1 DB binding is required.");
  return createGuestbookApi({
    db: env.DB,
    bucket: env.BUCKET,
    ...identity,
    moderatorUserIds: new Set(values),
    artworkVerified:
      artwork.available &&
      artwork.safeRegionsVerified &&
      typeof artwork.sha256 === "string" &&
      /^[a-f0-9]{64}$/.test(artwork.sha256),
  });
}
