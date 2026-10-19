import { test, expect } from "@playwright/test";

// No route mocks or injected identity callback: requests traverse the official
// Sites loopback-only middleware, Vinext route and official getChatGPTUser helper.
test("official local identity ignores forged headers and survives a new request", async ({
  request,
}) => {
  const forged = await request.get("/api/me", {
    headers: {
      "oai-authenticated-user-id": "forged-owner",
      "oai-authenticated-user-email": "forged@example.invalid",
    },
  });
  expect(forged.status()).toBe(200);
  expect((await forged.json()).signedIn).toBe(false);
  const anonymousWrite = await request.post("/api/signatures", {
    headers: { origin: "http://127.0.0.1:4175" },
    data: {},
  });
  expect(anonymousWrite.status()).toBe(401);
  const login = await request.get(
    "/signin-with-chatgpt?return_to=%2Fapi%2Fme",
    { maxRedirects: 0 },
  );
  expect(login.status()).toBe(302);
  expect(login.headers().location).toBe("/api/me");
  expect(login.headers()["set-cookie"]).toContain("HttpOnly");
  const me = await (await request.get("/api/me")).json();
  expect(me.signedIn).toBe(true);
  expect(me.moderator).toBe(true);
  expect(me.signatures).toEqual([]);
  const book = await request.get("/api/guestbook");
  expect(book.status()).toBe(200);
  expect((await book.json()).signatures).toEqual([]);
  const logout = await request.get(
    "/signout-with-chatgpt?return_to=%2Fapi%2Fme",
    { maxRedirects: 0 },
  );
  expect(logout.status()).toBe(302);
  expect((await (await request.get("/api/me")).json()).signedIn).toBe(false);
});
test("official local sign-in prevents prefetch login, unsafe returns and cross-site actions", async ({
  request,
}) => {
  const prefetch = await request.get("/signin-with-chatgpt?return_to=%2F", {
    headers: { purpose: "prefetch" },
    maxRedirects: 0,
  });
  expect(prefetch.status()).toBe(204);
  expect(prefetch.headers()["set-cookie"]).toBeUndefined();
  expect((await (await request.get("/api/me")).json()).signedIn).toBe(false);
  const cross = await request.get("/signin-with-chatgpt?return_to=%2F", {
    headers: { origin: "https://evil.invalid" },
    maxRedirects: 0,
  });
  expect(cross.status()).toBe(403);
  const unsafe = await request.get(
    "/signin-with-chatgpt?return_to=https%3A%2F%2Fevil.invalid",
    { maxRedirects: 0 },
  );
  expect(unsafe.status()).toBe(302);
  expect(unsafe.headers().location).toBe("/");
  expect(unsafe.headers()["set-cookie"]).toContain("SameSite=Lax");
  const callback = await request.get("/callback", { maxRedirects: 0 });
  expect(callback.status()).toBe(501);
  const logout = await request.post("/signout-with-chatgpt?return_to=%2F", {
    headers: { origin: "http://127.0.0.1:4175" },
    maxRedirects: 0,
  });
  expect(logout.status()).toBe(303);
  expect((await (await request.get("/api/me")).json()).signedIn).toBe(false);
});
test("canonical browser sign-in uses a top-level anchor and keeps unavailable-artwork writes closed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const login = page
    .getByRole("link", { name: "Sign in to add yours" })
    .filter({ visible: true });
  await expect(login).toHaveAttribute("target", "_top");
  await login.click();
  await expect(
    page.getByRole("button", { name: "Your signatures" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Your signatures" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The card is getting ready." }),
  ).toBeVisible();
  const outcome = await page.evaluate(async () => {
    const r = await fetch("/api/signatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return { status: r.status, body: await r.json() };
  });
  expect(outcome.status).toBe(503);
  expect(outcome.body.error).toContain("verified artwork");
  await page.screenshot({
    path: "evidence/sites-runtime-empty-test.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
