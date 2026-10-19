import { env } from "cloudflare:workers";
import { getChatGPTUser, chatGPTSignInPath } from "../../chatgpt-auth";
import { createSitesGuestbook } from "../../../server/sites";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  if (!env.DB)
    return Response.json(
      { error: "The guestbook database is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  return createSitesGuestbook(
    {
      DB: env.DB,
      BUCKET: env.BUCKET,
      YWH_MODERATOR_USER_IDS: env.YWH_MODERATOR_USER_IDS,
    },
    { getChatGPTUser, chatGPTSignInPath },
  )(request);
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
