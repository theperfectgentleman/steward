/**
 * UI smoke tests against the running local app.
 * Run: npx playwright test --config=scripts/ui-smoke.config.ts
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.UI_BASE_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.UI_EMAIL || "admin@unitycommit.org";
const PASSWORD = process.env.UI_PASSWORD || "Steward123!";

async function waitForLoginForm(page: import("@playwright/test").Page) {
  // Splash shows "Signing in…" while /api/auth/session resolves + logo entrance (~2s).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });

  const email = page.getByPlaceholder("Email or phone");
  try {
    await email.waitFor({ state: "visible", timeout: 45000 });
  } catch (err) {
    const body = await page.locator("body").innerText().catch(() => "");
    const logs = (page as unknown as { __console?: string[] }).__console ?? [];
    throw new Error(
      `Login form not visible.\nPage text:\n${body.slice(0, 800)}\nConsole:\n${logs.join("\n")}\nOriginal: ${err}`,
    );
  }
  return email;
}

async function signIn(page: import("@playwright/test").Page) {
  await waitForLoginForm(page);
  await page.getByPlaceholder("Email or phone").fill(EMAIL);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
}

async function enterOrgIfNeeded(page: import("@playwright/test").Page) {
  const enter = page.getByRole("button", { name: /^Enter$/i }).first();
  try {
    await enter.waitFor({ state: "visible", timeout: 15000 });
    await enter.click();
  } catch {
    /* already in workspace */
  }
}

test.describe("Steward UI smoke", () => {
  test.beforeEach(async ({ page }) => {
    const logs: string[] = [];
    (page as unknown as { __console?: string[] }).__console = logs;
    page.on("console", (msg) => {
      if (msg.type() === "error") logs.push(`console.error: ${msg.text()}`);
    });
    page.on("pageerror", (err) => logs.push(`pageerror: ${err.message}`));
  });

  test("login page loads", async ({ page }) => {
    await waitForLoginForm(page);
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Sign in$/i })).toBeVisible();
  });

  test("admin can sign in and reach workspace", async ({ page }) => {
    await signIn(page);
    await enterOrgIfNeeded(page);

    await expect(
      page.getByRole("link", { name: /^Home$/i }).or(
        page.getByRole("link", { name: /^Tasks$/i }),
      ).first(),
    ).toBeVisible({ timeout: 25000 });
  });

  test("peer tabs navigate: Tasks, Events, Docs", async ({ page }) => {
    await signIn(page);
    await enterOrgIfNeeded(page);

    await page.getByRole("link", { name: /^Tasks$/i }).first().click();
    await expect(page).toHaveURL(/\/tasks/, { timeout: 15000 });
    await expect(page.locator("body")).not.toContainText(/Application error/i);

    await page.getByRole("link", { name: /^Events$/i }).first().click();
    await expect(page).toHaveURL(/\/events/, { timeout: 15000 });
    await expect(page.locator("body")).not.toContainText(/Application error/i);

    await page.getByRole("link", { name: /^Docs$/i }).first().click();
    await expect(page).toHaveURL(/\/documents/, { timeout: 15000 });
    await expect(page.locator("body")).not.toContainText(/Application error/i);
  });
});
