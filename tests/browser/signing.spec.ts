import { test, expect } from "@playwright/test";
test("sign on current page, preview, search, edit and remove without public persistence", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".page-number")).toHaveText("02 / 03");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".page-number")).toHaveText("03 / 03");
  await page
    .getByRole("button", { name: "Add yours", exact: true })
    .filter({ visible: true })
    .click();
  const card = page.locator("#card");
  await card.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.getByLabel("Your name", { exact: true }).fill("Test Visitor");
  await page.getByRole("button", { name: "Dancing Script signing style" }).click();
  await page.getByRole("button", { name: "Plum ink" }).click();
  await page
    .getByLabel("Social profile URL 1")
    .fill("https://github.com/test-visitor");
  await page.getByRole("checkbox").check();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize(info.project.use.viewport!);
  await page.screenshot({
    path: `evidence/${info.project.name}-editor.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Preview on this page" }).click();
  await expect(page.getByTestId("signature-preview")).toHaveText(
    "Test Visitor",
  );
  const before = await page
    .getByTestId("signature-preview")
    .getAttribute("style");
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 430 : 1200,
    height: 900,
  });
  expect(
    await page.getByTestId("signature-preview").getAttribute("style"),
  ).toBe(before);
  await page.getByRole("button", { name: "Add to demo", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Nothing was published publicly",
  );
  await page.getByRole("button", { name: "Search names and handles" }).click();
  await page.getByLabel("Name or handle").fill("test-visitor");
  await page.locator(".search-results button").click();
  await expect(page.getByRole("dialog")).toContainText("Test Visitor");
  await expect(
    page.getByRole("link", { name: "github.com/test-visitor" }),
  ).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  await page.getByRole("button", { name: "Edit yours" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Edited Visitor");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Preview on this page" }).click();
  await page.getByRole("button", { name: "Add to demo", exact: true }).click();
  await page
    .getByRole("button", { name: /Edited Visitor.*View signature/ })
    .click();
  await page.getByRole("button", { name: "Remove yours" }).click();
  await expect(
    page.getByRole("button", { name: /Edited Visitor.*View signature/ }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".signature")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("mobile widths fit, controls scroll normally, reduced motion does not rotate", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const width of [320, 390, 700, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize(info.project.use.viewport!);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".page-number")).toHaveText("02 / 03");
  expect(
    await page
      .locator("#card")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  expect(
    await page
      .locator("#card")
      .evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe("pan-y");
  await page.screenshot({
    path: `evidence/${info.project.name}-demo.png`,
    fullPage: true,
  });
});
test("unapproved profiles and collisions are blocked before preview", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add yours", exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole("button", { name: "Use this spot" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Validation Test");
  await page.getByRole("checkbox").check();
  await page
    .getByLabel("Social profile URL 1")
    .fill("https://evil.example/profile");
  await page.getByRole("button", { name: "Preview on this page" }).click();
  await expect(page.getByRole("alert")).toContainText("HTTPS profile");
  await page.getByLabel("Social profile URL 1").fill("");
  await page.getByRole("button", { name: "Back to position" }).click();
  const box = await page.locator("#card").boundingBox();
  await page
    .locator("#card")
    .click({ position: { x: box!.width * 0.12, y: box!.height * 0.38 } });
  await page.getByRole("button", { name: "Use this spot" }).click();
  await page.getByRole("button", { name: "Preview on this page" }).click();
  await expect(page.getByRole("alert")).toContainText("overlaps");
});
test("ordinary page turn uses only X-axis transform over top binding", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  const keyframes = await page
    .locator("#card")
    .evaluate((el) =>
      el
        .getAnimations()
        .flatMap((a) =>
          (a.effect as KeyframeEffect).getKeyframes().map((k) => k.transform),
        ),
    );
  expect(keyframes.join(" ")).toContain("rotateX");
  expect(keyframes.join(" ")).not.toContain("rotateY");
  expect(
    await page
      .locator("#card")
      .evaluate((el) => getComputedStyle(el).transformOrigin.split(" ")[1]),
  ).toBe("0px");
});
