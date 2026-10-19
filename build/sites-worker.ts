// Adapted from the official Sites 1.0.0 Worker entry point.
// No CONNECTORS capability is declared or consumed by this guestbook.
import handler from "vinext/server/fetch-handler";
export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },
};
