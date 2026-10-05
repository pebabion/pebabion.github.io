import { expect, test } from "@playwright/test";

test("home, blog and apps pages load and link to each other", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kelvin Nguyen Le");

  await page.getByRole("link", { name: "Blog", exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();

  await page.getByRole("link", { name: "Apps", exact: true }).click();
  await expect(page).toHaveURL(/\/apps\/$/);
  await page.getByRole("link", { name: /Running converter/ }).click();
  await expect(page).toHaveURL(/\/apps\/running-converter\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Running converter");

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Apps" }).click();
  await expect(page).toHaveURL(/\/apps\/$/);
});

test("drafts stay out of the production build", async ({ page, request }) => {
  await page.goto("/blog/");
  await expect(page.getByText("Hello again")).toHaveCount(0);
  expect((await request.get("/blog/hello-again/")).status()).toBe(404);
});

test("RSS feed and sitemap are published", async ({ request }) => {
  const rss = await request.get("/rss.xml");
  expect(rss.ok()).toBe(true);
  expect(await rss.text()).toContain("<rss");
  expect((await request.get("/sitemap-index.xml")).ok()).toBe(true);
});
