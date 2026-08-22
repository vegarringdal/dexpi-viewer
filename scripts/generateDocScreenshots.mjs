// Regenerates the manual's screenshots in documentation/images/ by driving
// the real app. Prerequisites (not project dependencies):
//   1. `npm run dev -- --port 5199 --strictPort` running in another shell
//   2. playwright available to node (e.g. `npm i -g playwright` +
//      `npx playwright install chromium-headless-shell`)
// Run: node scripts/generateDocScreenshots.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = "/home/dev/Documents/github/dexpi/documentation/images";
mkdirSync(OUT, { recursive: true });
const DIR = "/home/dev/Documents/github/dexpi/refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1.25 });
await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /profile 0\.6/i }).first().click();
await page.waitForTimeout(1500);
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.getByRole("button", { name: /^open$/i }).first().click(),
]);
await chooser.setFiles(`${DIR}/DISC_EXAMPLE-14-08.xml`);
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}/overview.png` });

// Validation panel (left tab strip).
await page.getByText("Validation", { exact: false }).nth(1).click().catch(() => {});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/validation.png`, clip: { x: 0, y: 108, width: 420, height: 700 } });

// Select the ball valve on canvas, then Properties.
const box = await page.locator("canvas").first().boundingBox();
const W = 841, H = 594, scale = Math.min(box.width / W, box.height / H);
const px = (x) => box.x + (box.width - W * scale) / 2 + x * scale;
const py = (y) => box.y + (box.height - H * scale) / 2 + y * scale;
await page.mouse.click(px(442), py(430));
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/properties.png`, clip: { x: 1170, y: 108, width: 430, height: 700 } });

// Inspect panel (center tab), depth 2.
await page.getByText("Inspect", { exact: true }).last().click();
await page.waitForTimeout(1200);
await page.getByText("1 level", { exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByText("2 levels", { exact: true }).last().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/inspect.png` });

// Topology graph tab.
await page.getByText("Topology graph", { exact: true }).last().click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/topology.png` });

// Underlay compare: back to Drawing, load official SVG on top.
await page.getByText("Drawing", { exact: true }).last().click();
await page.waitForTimeout(500);
await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles(`${DIR}/DISC_EXAMPLE-14-08.svg`);
await page.waitForTimeout(2500);
await page.getByText("Tint", { exact: true }).click();
await page.waitForTimeout(400);
await page.getByText("Hide white", { exact: true }).click();
await page.waitForTimeout(400);
await page.mouse.move(px(330), py(58));
for (let i = 0; i < 18; i++) { await page.mouse.wheel(0, -240); await page.waitForTimeout(100); }
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/underlay.png` });
console.log("done");
await browser.close();
