import { test, expect } from "@playwright/test";
import { Miniflare } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import { createGuestbookApi } from "../../server/api.ts";
import type { D1Database } from "../../server/types.ts";

// Browser route transport connects the actual UI adapter to real local D1.
// Identity is a trusted test-only callback; hosted dispatch login is not simulated.
test("shared UI keeps pending records private, restores ownership, and publishes only after review", async ({
  page,
}) => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("test-only");}}',
    compatibilityDate: "2026-06-01",
    d1Databases: { DB: "shared-ui-test" },
    cf: false,
  });
  try {
    const db = (await mf.getD1Database("DB")) as unknown as D1Database;
    for (const name of (
      await readdir(new URL("../../drizzle/", import.meta.url))
    )
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(
        new URL("../../drizzle/" + name, import.meta.url),
        "utf8",
      );
      for (const statement of sql.split("--> statement-breakpoint"))
        if (statement.trim()) await db.prepare(statement).run();
    }
    let user: string | null = "test-organizer";
    const api = createGuestbookApi({
      db,
      getChatGPTUser: async () => (user ? { userId: user } : null),
      chatGPTSignInPath: () => "/test-only-signin",
      moderatorUserIds: new Set(["test-organizer"]),
      artworkVerified: true,
    });
    const write = (path: string, input: unknown) =>
      api(
        new Request("http://127.0.0.1:4174/api" + path, {
          method: "POST",
          headers: {
            origin: "http://127.0.0.1:4174",
            "content-type": "application/json",
          },
          body: JSON.stringify(input),
        }),
      );
    expect(
      (await write("/moderation/pages", { id: "test-page", order: 1 })).status,
    ).toBe(201);
    user = "test-owner";
    const draft = {
      pageId: "test-page",
      name: "Pending test visitor",
      position: { x: 0.1, y: 0.4 },
      font: "caveat",
      ink: "#252822",
      socials: [],
    };
    const created = (await (
      await write("/signatures", {
        draft,
        idempotencyKey: crypto.randomUUID(),
        consent: true,
      })
    ).json()) as any;
    expect(created.status).toBe("pending");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const r = route.request();
      const response = await api(
        new Request(r.url(), {
          method: r.method(),
          headers: r.headers(),
          body: ["GET", "HEAD"].includes(r.method()) ? undefined : r.postData(),
        }),
      );
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      });
    });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Your signatures" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Your signatures" }).click();
    await expect(page.getByRole("dialog")).toContainText("Awaiting review");
    await page.locator(".search-results button").click();
    await expect(page.getByRole("dialog")).toContainText(
      "PRIVATE · AWAITING REVIEW",
    );
    await page.screenshot({
      path: "evidence/private-pending-test.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.reload();
    await page.getByRole("button", { name: "Your signatures" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Pending test visitor",
    );
    await page.getByRole("button", { name: "Close dialog" }).click();
    user = null;
    await page.reload();
    await expect(
      page
        .getByRole("link", { name: "Sign in to add yours" })
        .filter({ visible: true }),
    ).toHaveAttribute("target", "_top");
    await expect(page.locator(".signature")).toHaveCount(0);
    user = "test-organizer";
    expect(
      (
        await write(`/moderation/signatures/${created.signature.id}`, {
          decision: "approve",
          version: 1,
          note: "Reviewed synthetic browser test signature",
        })
      ).status,
    ).toBe(200);
    user = "another-test-user";
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: /Pending test visitor.*View signature/,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Pending test visitor.*View signature/ })
      .click();
    await expect(
      page.getByRole("button", { name: "Remove yours" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Report a concern" }).click();
    await page
      .getByLabel("What should be reviewed?")
      .fill("Synthetic browser test concern");
    await page.getByRole("button", { name: "Submit report" }).click();
    await expect(page.getByRole("status")).toContainText("Report submitted");
    expect(
      (
        await db
          .prepare("SELECT count(*) AS count FROM reports")
          .first<{ count: number }>()
      )?.count,
    ).toBe(1);
    user = "test-owner";
    await page.reload();
    await page.getByRole("button", { name: "Your signatures" }).click();
    await page.locator(".search-results button").click();
    await page.getByRole("button", { name: "Remove yours" }).click();
    await expect(page.getByRole("status")).toContainText("removed");
    await page.reload();
    await expect(page.locator(".signature")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await mf.dispose();
  }
});
