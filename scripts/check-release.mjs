import fs from "node:fs";
const art = JSON.parse(
  fs.readFileSync(new URL("../src/artwork.json", import.meta.url)),
);
const blockers = [];
if (!art.available || !art.sha256)
  blockers.push("original version-3 print artwork is unavailable");
if (!art.safeRegionsVerified)
  blockers.push(
    "writing regions have not been checked against the original artwork",
  );
if (!process.env.VITE_GUESTBOOK_API)
  blockers.push("approved persistent backend is not configured");
if (!fs.existsSync(new URL("../app/chatgpt-auth.ts", import.meta.url)))
  blockers.push("official Sites ChatGPT identity helper is not integrated");
if (!fs.existsSync(new URL("../app/api/[...path]/route.ts", import.meta.url)))
  blockers.push("Sites server route is not integrated");
if (blockers.length) {
  console.error("Public release blocked: " + blockers.join("; "));
  process.exitCode = 1;
} else
  console.log(
    "Local configuration checks passed. Run backend security/concurrency acceptance checks and design QA before release.",
  );
