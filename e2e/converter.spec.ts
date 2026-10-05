import { type Page, expect, test } from "@playwright/test";

const URL = "/apps/running-converter/";

const pace = (page: Page) =>
  page.evaluate(
    () =>
      `${(document.getElementById("min") as HTMLInputElement).value}:${(document.getElementById("sec") as HTMLInputElement).value}`,
  );
const out = (page: Page, id: string) => page.locator(`[data-out="${id}"]`);

async function setPace(page: Page, min: string, sec: string) {
  await page.locator("#min").fill(min);
  await page.locator("#sec").fill(sec);
}

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
});

test("starts at 9:00 /mi with every result filled in", async ({ page }) => {
  expect(await pace(page)).toBe("9:00");
  await expect(out(page, "km")).toHaveText("5:36");
  await expect(out(page, "mph")).toHaveText("6.67");
  await expect(out(page, "lap")).toHaveText("2:14");
  await expect(out(page, "full")).toHaveText("3:55:58");
  // The tile for the input unit is hidden; 8 remain.
  await expect(page.locator("[data-result]:visible")).toHaveCount(8);
});

test("typing a pace updates the results", async ({ page }) => {
  await setPace(page, "8", "30");
  await expect(out(page, "km")).toHaveText("5:17");
  await expect(out(page, "full")).toHaveText("3:42:52");
});

test("invalid seconds clear the results", async ({ page }) => {
  await setPace(page, "8", "75");
  await expect(out(page, "km")).toHaveText("–");
  await expect(page.locator("#save")).toBeDisabled();
});

test("tapping a field selects its value so typing replaces it", async ({ page }) => {
  await setPace(page, "9", "15");
  await page.locator("#sec").blur();
  await page.locator("#sec").click();
  await page.keyboard.type("30");
  expect(await pace(page)).toBe("9:30");
});

test("step buttons move the pace in one tap", async ({ page }) => {
  await setPace(page, "9", "15");
  await page.locator('[data-step="2"]').click();
  expect(await pace(page)).toBe("9:30");
  await page.locator('[data-step="-1"]').click();
  expect(await pace(page)).toBe("9:25");
  await page.locator('[data-step="-2"]').click();
  expect(await pace(page)).toBe("9:10");
});

test("holding a step button keeps stepping", async ({ page }) => {
  await setPace(page, "9", "00");
  const plus = page.locator('[data-step="1"]');
  await plus.dispatchEvent("pointerdown");
  await page.waitForTimeout(900);
  await plus.dispatchEvent("pointerup");
  const [m, s] = (await pace(page)).split(":").map(Number);
  expect(m * 60 + s).toBeGreaterThanOrEqual(540 + 5 * 4);
});

test("speed units step by 0.1 and 0.5", async ({ page }) => {
  await page.locator('[data-unit="kmh"]').click();
  await expect(page.locator("#speed")).toHaveValue("10.73");
  await expect(page.locator('[data-step="1"]')).toHaveText("+0.1");
  await page.locator('[data-step="1"]').click();
  await expect(page.locator("#speed")).toHaveValue("10.8");
  await page.locator('[data-step="2"]').click();
  await expect(page.locator("#speed")).toHaveValue("11.3");
});

test("switching units keeps the same pace", async ({ page }) => {
  await setPace(page, "8", "00");
  await page.locator('[data-unit="km"]').click();
  expect(await pace(page)).toBe("4:58");
  await page.locator('[data-unit="mph"]').click();
  await expect(page.locator("#speed")).toHaveValue("7.5");
  await expect(page.locator('[data-result="mph"]')).toBeHidden();
});

test("swiping moves 5 s per 25 px, relative to where you start", async ({ page }) => {
  await setPace(page, "9", "15");
  const box = (await page.locator("#scrub").boundingBox())!;
  const y = box.y + box.height / 2;
  const x = box.x + 40; // start near the edge: no jump on touch
  await page.mouse.move(x, y);
  await page.mouse.down();
  expect(await pace(page)).toBe("9:15");
  await page.mouse.move(x + 24, y, { steps: 4 });
  expect(await pace(page)).toBe("9:15");
  await page.mouse.move(x + 75, y, { steps: 6 });
  expect(await pace(page)).toBe("9:30");
  await page.mouse.move(x - 50, y, { steps: 10 });
  expect(await pace(page)).toBe("9:05");
  await page.mouse.up();
});

test("the swipe strip says what a tick is worth and shows the change while swiping", async ({ page }) => {
  const hint = page.locator("#scrub-hint");
  const delta = page.locator("#scrub-delta");
  await expect(hint).toHaveText("Swipe · each tick is 5s");
  await expect(delta).toHaveCSS("opacity", "0");

  const box = (await page.locator("#scrub").boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await page.mouse.down();
  await expect(delta).toHaveText("±0");
  await page.mouse.move(box.x + 40 + 75, y, { steps: 6 });
  await expect(delta).toHaveText("+15s");
  await expect(delta).toHaveCSS("opacity", "1");
  await page.mouse.move(box.x + 40 + 25 * 13, y, { steps: 10 });
  await expect(delta).toHaveText("+1:05");
  await page.mouse.up();
  await expect(delta).toHaveCSS("opacity", "0");

  await page.locator('[data-unit="mph"]').click();
  await expect(hint).toHaveText("Swipe · each tick is 0.1 mph");
});

test("arrow keys step the swipe strip", async ({ page }) => {
  await page.locator("#scrub").focus();
  await page.keyboard.press("ArrowRight");
  expect(await pace(page)).toBe("9:05");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  expect(await pace(page)).toBe("8:55");
});

test("reopens on the last value and unit", async ({ page }) => {
  await page.locator('[data-unit="km"]').click();
  await setPace(page, "5", "10");
  await page.reload();
  await expect(page.locator('[data-unit="km"]')).toHaveAttribute("aria-checked", "true");
  expect(await pace(page)).toBe("5:10");
});

test.describe("history", () => {
  const rows = (page: Page) => page.locator("#history li");

  test("saves, survives a reload, and loads back", async ({ page }) => {
    await expect(page.locator("#history-empty")).toBeVisible();
    await setPace(page, "8", "30");
    await page.locator("#save").click();
    await setPace(page, "10", "00");
    await page.locator("#save").click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).first()).toContainText("10:00 /mi");

    await page.reload();
    await expect(rows(page)).toHaveCount(2);
    await rows(page).nth(1).getByRole("button", { name: "Load 8:30 /mi" }).click();
    expect(await pace(page)).toBe("8:30");
  });

  test("saving the same value twice keeps one entry", async ({ page }) => {
    await page.locator("#save").click();
    await page.locator("#save").click();
    await expect(rows(page)).toHaveCount(1);
  });

  test("Enter in a field saves", async ({ page }) => {
    await page.locator("#sec").press("Enter");
    await expect(rows(page)).toHaveCount(1);
  });

  test("deletes one entry, then clears all after confirming", async ({ page }) => {
    for (const s of ["00", "30", "45"]) {
      await setPace(page, "9", s);
      await page.locator("#save").click();
    }
    await expect(rows(page)).toHaveCount(3);
    await page.getByRole("button", { name: "Delete 9:30 /mi" }).click();
    await expect(rows(page)).toHaveCount(2);

    page.once("dialog", (d) => d.dismiss());
    await page.locator("#clear").click();
    await expect(rows(page)).toHaveCount(2);

    page.once("dialog", (d) => d.accept());
    await page.locator("#clear").click();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator("#history-empty")).toBeVisible();
    await page.reload();
    await expect(rows(page)).toHaveCount(0);
  });
});

test.describe("phone layout", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  test("fits without sideways scrolling, with Save and four history rows on screen", async ({ page }) => {
    // Seed six entries.
    await page.evaluate(() => {
      const now = Date.now();
      const entries = [300, 310, 320, 330, 340, 350].map((spk, i) => ({
        id: `t${i}`,
        at: now - i * 60_000,
        unit: "km",
        secPerKm: spk,
      }));
      localStorage.setItem("running-converter:history:v1", JSON.stringify(entries));
    });
    await page.reload();

    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(393);

    const viewportHeight = page.viewportSize()!.height;
    expect((await page.locator("#save").boundingBox())!.y).toBeLessThan(viewportHeight);
    const fourth = (await page.locator("#history li").nth(3).boundingBox())!;
    expect(fourth.y + fourth.height).toBeLessThanOrEqual(viewportHeight);
  });
});
