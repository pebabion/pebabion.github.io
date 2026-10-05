import { type Page, expect, test } from "@playwright/test";

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);
const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const toggle = (page: Page) => page.locator("#theme-toggle");

const LIGHT_BG = "rgb(250, 251, 251)";
const DARK_BG = "rgb(32, 35, 42)";

test("follows the system setting by default", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  expect(await theme(page)).toBe("dark");
  expect(await bg(page)).toBe(DARK_BG);

  // Switching the OS theme applies live, without a reload.
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => theme(page)).toBe("light");
  expect(await bg(page)).toBe(LIGHT_BG);
});

test("cycles system → light → dark → system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(toggle(page)).toHaveAttribute("title", "Theme: follow system");

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("title", "Theme: light");
  expect(await theme(page)).toBe("light");

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("title", "Theme: dark");
  expect(await theme(page)).toBe("dark");
  expect(await bg(page)).toBe(DARK_BG);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("title", "Theme: follow system");
  expect(await theme(page)).toBe("light");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
});

test("a saved choice wins over the system and survives navigation", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await toggle(page).click();
  await toggle(page).click(); // dark

  await page.goto("/apps/running-converter/");
  expect(await theme(page)).toBe("dark");
  await expect(toggle(page)).toHaveAttribute("title", "Theme: dark");

  // The OS changing doesn't override an explicit choice.
  await page.emulateMedia({ colorScheme: "light" });
  expect(await theme(page)).toBe("dark");
});

test("the theme is set before the page paints", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  // Read the attribute as soon as <body> exists, before any module scripts run.
  await page.addInitScript(() => {
    document.addEventListener("readystatechange", () => {
      if (document.readyState === "interactive") {
        (window as unknown as { early: string | undefined }).early = document.documentElement.dataset.theme;
      }
    });
  });
  await page.goto("/");
  expect(await page.evaluate(() => (window as unknown as { early: string | undefined }).early)).toBe("dark");
});
