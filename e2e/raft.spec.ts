import { type Page, expect, test } from "@playwright/test";

// ?speed=4 runs the cluster four times faster so tests don't wait on elections.
const FAST = "/apps/raft/?speed=4";
const leader = (page: Page) => page.locator('.node[data-role="leader"]');
const node = (page: Page, i: number | string) => page.locator(`.node[data-node="${i}"]`);
const quest = (page: Page) => page.locator("#quest");
const tap = (server: ReturnType<typeof node>) => server.locator(".body").click();

async function waitForLeader(page: Page) {
  await expect(leader(page)).toHaveCount(1, { timeout: 20_000 });
}

test("five servers pick one leader, and its lines glow", async ({ page }) => {
  await page.goto(FAST);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Raft playground");
  await expect(page.locator(".node")).toHaveCount(5);
  await waitForLeader(page);
  await expect(page.locator("#caption")).toContainText("leads");
  await expect(page.locator('.link[data-lead="true"]')).toHaveCount(4, { timeout: 10_000 });
});

test("Add waits for a leader, then the item is saved on every server", async ({ page }) => {
  await page.goto("/apps/raft/");
  const add = page.getByRole("button", { name: /^Add/ });
  await expect(add).toBeDisabled();
  await expect(add).toBeEnabled({ timeout: 30_000 });
  await add.click();
  await expect(add).toHaveText("Add 🐢");
  // Followers answer "got it" with a ✓ flying back to the leader.
  await expect(page.locator("#flights text", { hasText: "✓" }).first()).toBeAttached({ timeout: 10_000 });
  for (let i = 0; i < 5; i++) {
    await expect(node(page, i).locator(".items text.saved")).toHaveText(["🍩"], { timeout: 15_000 });
  }
});

test("stopping the leader puts it to sleep and brings in a new one", async ({ page }) => {
  await page.goto(FAST);
  await waitForLeader(page);
  const old = (await leader(page).getAttribute("data-node"))!;
  await tap(leader(page));
  await expect(node(page, old)).toHaveAttribute("data-role", "dead");
  await expect(node(page, old).locator(".zzz")).toBeVisible();
  await waitForLeader(page);
  expect(await leader(page).getAttribute("data-node")).not.toBe(old);

  await tap(node(page, old));
  await expect(node(page, old)).not.toHaveAttribute("data-role", "dead");
});

test("a server that slept through two adds gets both when it wakes", async ({ page }) => {
  await page.goto(FAST);
  await waitForLeader(page);
  const sleeper = (await page.locator('.node[data-role="follower"]').first().getAttribute("data-node"))!;
  await tap(node(page, sleeper));
  await expect(node(page, sleeper)).toHaveAttribute("data-role", "dead");

  const add = page.getByRole("button", { name: /^Add/ });
  await add.click();
  await add.click();
  const others = page.locator(`.node:not([data-node="${sleeper}"]) .items`);
  for (const row of await others.all()) await expect(row.locator("text.saved")).toHaveText(["🍩", "🐢"], { timeout: 15_000 });
  await expect(node(page, sleeper).locator(".items text")).toHaveCount(0);

  await tap(node(page, sleeper));
  await expect(node(page, sleeper).locator(".items text.saved")).toHaveText(["🍩", "🐢"], { timeout: 15_000 });
});

test("a line can be cut and fixed from the keyboard", async ({ page }) => {
  await page.goto(FAST);
  const link = page.locator('.link[data-a="0"][data-b="2"]');
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(link).toHaveAttribute("data-cut", "true");
  await expect(link).toHaveAccessibleName(/cut\. Press to fix/);
  await page.keyboard.press("Enter");
  await expect(link).toHaveAttribute("data-cut", "false");
});

test("pause and play", async ({ page }) => {
  await page.goto(FAST);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("the tasks walk through Raft one at a time", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(FAST);
  const at = async (step: number) => expect(quest(page)).toHaveAttribute("data-step", String(step), { timeout: 30_000 });
  await expect(page.locator("#quest-text")).toContainText("first timer");

  await at(1); // a leader was picked
  await page.getByRole("button", { name: /^Add/ }).click();
  await at(2);

  await tap(leader(page));
  await at(3);

  // Stop three servers that are still awake. Read their ids first: the page
  // only redraws on the next frame, so "first awake one" could repeat.
  const awake = await page.locator('.node:not([data-role="dead"])').evaluateAll((els) => els.map((el) => (el as SVGElement).dataset.node!));
  for (const id of awake.slice(0, 3)) await tap(node(page, id));
  await at(4);

  const asleep = await page.locator('.node[data-role="dead"]').evaluateAll((els) => els.map((el) => (el as SVGElement).dataset.node!));
  for (const id of asleep) await tap(node(page, id));
  await at(5);

  for (const link of await page.locator('.link[data-a="0"]').all()) {
    await link.focus();
    await page.keyboard.press("Enter");
  }
  await expect(quest(page)).toHaveAttribute("data-state", "finished", { timeout: 30_000 });
  await expect(page.locator("#quest-text")).toContainText("That's Raft");
});

test("start over resets the tasks", async ({ page }) => {
  await page.goto(FAST);
  await expect(quest(page)).toHaveAttribute("data-step", "1", { timeout: 30_000 });
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(quest(page)).toHaveAttribute("data-step", "0");
  await expect(leader(page)).toHaveCount(0);
});

test("is listed on the apps page", async ({ page }) => {
  await page.goto("/apps/");
  await page.getByRole("link", { name: /Raft playground/ }).click();
  await expect(page).toHaveURL(/\/apps\/raft\/$/);
});
