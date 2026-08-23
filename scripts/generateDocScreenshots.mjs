// Regenerates the manual's screenshots in documentation/images/ by driving
// the real app. Prerequisites (not project dependencies):
//   1. `npm run dev -- --port 5199 --strictPort` running in another shell
//   2. playwright available to node (e.g. `npm i -g playwright` +
//      `npx playwright install chromium-headless-shell`)
// Run: node scripts/generateDocScreenshots.mjs
//
// Callouts: annotate() injects yellow translucent rects (and optional
// arrows) over the live page before capture, positioned from real element
// bounding boxes — so the highlights track the UI instead of drifting.

import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const OUT = new URL("../documentation/images/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const DIR = new URL(
  "../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14/",
  import.meta.url,
).pathname;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 }, deviceScaleFactor: 1.25 });

// ---------------------------------------------------------------------------
// Annotation helpers
// ---------------------------------------------------------------------------

const pad = (b, p = 8) => ({ x: b.x - p, y: b.y - p, w: b.width + 2 * p, h: b.height + 2 * p });

function union(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

/** Draws callout rects (and optional arrows to a rect's edge) on the page. */
async function annotate(rects, arrows = []) {
  await page.evaluate(
    ({ rects, arrows }) => {
      for (const r of rects) {
        const el = document.createElement("div");
        el.className = "__doc_annotation";
        Object.assign(el.style, {
          position: "fixed",
          left: `${r.x}px`,
          top: `${r.y}px`,
          width: `${r.w}px`,
          height: `${r.h}px`,
          background: "rgba(255, 196, 0, 0.14)",
          border: "3px solid rgba(255, 150, 0, 0.95)",
          borderRadius: "8px",
          zIndex: 99999,
          pointerEvents: "none",
          boxShadow: "0 0 0 2px rgba(255, 255, 255, 0.6)",
        });
        document.body.appendChild(el);
      }
      for (const a of arrows) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "__doc_annotation");
        Object.assign(svg.style, {
          position: "fixed",
          left: "0",
          top: "0",
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          pointerEvents: "none",
        });
        const angle = Math.atan2(a.toY - a.fromY, a.toX - a.fromX);
        const head = 12;
        const hx = a.toX - head * Math.cos(angle);
        const hy = a.toY - head * Math.sin(angle);
        svg.innerHTML =
          `<line x1="${a.fromX}" y1="${a.fromY}" x2="${hx}" y2="${hy}" stroke="rgba(255,150,0,0.95)" stroke-width="4" stroke-linecap="round"/>` +
          `<polygon points="${a.toX},${a.toY} ${a.toX - head * Math.cos(angle - 0.45)},${a.toY - head * Math.sin(angle - 0.45)} ${a.toX - head * Math.cos(angle + 0.45)},${a.toY - head * Math.sin(angle + 0.45)}" fill="rgba(255,150,0,0.95)"/>`;
        document.body.appendChild(svg);
      }
    },
    { rects, arrows },
  );
}

async function clearAnnotations() {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".__doc_annotation")) {
      el.remove();
    }
  });
}

async function boxOf(locator) {
  const b = await locator.boundingBox();
  if (!b) {
    throw new Error("annotation target not visible");
  }
  return pad(b);
}

// ---------------------------------------------------------------------------
// Capture flow
// ---------------------------------------------------------------------------

await page.goto("http://localhost:5199/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /profile 0\.6/i }).first().click();
await page.waitForTimeout(1500);
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.getByRole("button", { name: /^open$/i }).first().click(),
]);
await chooser.setFiles(`${DIR}DISC_EXAMPLE-14-08.xml`);
await page.waitForTimeout(4500);
{
  // getting-started.md uses this shot to explain the ribbon File section.
  const open = await boxOf(page.getByRole("button", { name: /^open$/i }).first());
  const custom = await boxOf(page.getByRole("button", { name: /custom profile/i }).first());
  await annotate([union(open, custom)]);
  await page.screenshot({ path: `${OUT}overview.png` });
  await clearAnnotations();
}

// Validation panel with a callout on the filter/severity-config toolbar.
await page.getByText("Validation", { exact: false }).nth(1).click().catch(() => {});
await page.waitForTimeout(600);
{
  const filters = await boxOf(page.getByRole("button", { name: /^all \(/i }).first());
  const config = await boxOf(page.locator("button:has(svg.tabler-icon-adjustments)").first());
  await annotate([union(filters, config)]);
  await page.screenshot({ path: `${OUT}validation.png`, clip: { x: 0, y: 108, width: 420, height: 700 } });
  await clearAnnotations();
}

// Properties for the selected ball valve.
const box = await page.locator("canvas").first().boundingBox();
const W = 841;
const H = 594;
const scale = Math.min(box.width / W, box.height / H);
const px = (x) => box.x + (box.width - W * scale) / 2 + x * scale;
const py = (y) => box.y + (box.height - H * scale) / 2 + y * scale;
await page.mouse.click(px(442), py(430));
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}properties.png`, clip: { x: 1170, y: 108, width: 430, height: 700 } });

// Inspect panel at depth 2, with a callout on the depth select + Fit.
await page.getByText("Inspect", { exact: true }).last().click();
await page.waitForTimeout(1200);
await page.getByText("1 level", { exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByText("2 levels", { exact: true }).last().click();
await page.waitForTimeout(900);
{
  await page.getByRole("button", { name: /^fit$/i }).last().click();
  await page.waitForTimeout(500);
  const depth = await boxOf(page.getByText("2 levels", { exact: true }).first());
  const fit = await boxOf(page.getByRole("button", { name: /^fit$/i }).last());
  await annotate([union(depth, fit)]);
  await page.screenshot({ path: `${OUT}inspect.png` });
  await clearAnnotations();
}

// Topology graph tab, with a callout on the mode/depth/edge/show controls.
await page.getByText("Topology graph", { exact: true }).last().click();
await page.waitForTimeout(1500);
{
  const mode = await boxOf(page.getByRole("button", { name: "Neighborhood" }).first());
  const show = await boxOf(page.getByRole("button", { name: "Ports" }).first());
  const gapPlus = await boxOf(page.locator("button:has(svg.tabler-icon-plus):visible").last());
  await annotate([union(union(mode, show), gapPlus)]);
  await page.screenshot({ path: `${OUT}topology.png` });
  await clearAnnotations();
}

// Underlay compare, with the toolbar called out (rect + arrow).
await page.getByText("Drawing", { exact: true }).last().click();
await page.waitForTimeout(500);
await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles(`${DIR}DISC_EXAMPLE-14-08.svg`);
await page.waitForTimeout(2500);
await page.getByText("Tint", { exact: true }).click();
await page.waitForTimeout(400);
await page.getByText("Hide white", { exact: true }).click();
await page.waitForTimeout(400);
await page.mouse.move(px(330), py(58));
for (let i = 0; i < 18; i++) {
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(100);
}
await page.waitForTimeout(700);
{
  const load = await boxOf(page.getByRole("button", { name: /underlay/i }).first());
  const clear = await boxOf(page.getByRole("button", { name: /^clear$/i }).first());
  const bar = union(load, clear);
  await annotate([bar], [{ fromX: bar.x + bar.w / 2, fromY: bar.y + bar.h + 90, toX: bar.x + bar.w / 2, toY: bar.y + bar.h + 6 }]);
  await page.screenshot({ path: `${OUT}underlay.png` });
  await clearAnnotations();
}
await page.getByRole("button", { name: /^clear$/i }).click();
await page.waitForTimeout(500);

// Selection halo: select the pump, zoom toward it, clip inside the canvas.
// The canvas shrank when Inspect/Topology expanded, so remap mm→screen here.
{
  await page.getByRole("button", { name: /^fit$/i }).first().click();
  await page.waitForTimeout(400);
  const b2 = await page.locator("canvas").first().boundingBox();
  const s2 = Math.min(b2.width / W, b2.height / H);
  const cx = b2.x + (b2.width - W * s2) / 2 + 170 * s2;
  const cy = b2.y + (b2.height - H * s2) / 2 + 254 * s2;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(500);
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(600);
  const cw = Math.min(700, b2.width - 16);
  const ch = Math.min(500, b2.height - 16);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  await page.screenshot({
    path: `${OUT}selection-halo.png`,
    clip: {
      x: clamp(cx - cw / 2, b2.x + 8, b2.x + b2.width - 8 - cw),
      y: clamp(cy - ch / 2, b2.y + 8, b2.y + b2.height - 8 - ch),
      width: cw,
      height: ch,
    },
  });
}

// Highlight: per-type signal groups + black & white + dim others, with
// callouts on the panel toggles and the ribbon B/W button.
{
  await page.getByRole("button", { name: /^fit$/i }).first().click();
  await page.waitForTimeout(400);
  await page.getByText("Highlight", { exact: true }).last().click();
  await page.waitForTimeout(500);
  await page.getByText("Off", { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByText("Signal & instrument lines", { exact: true }).last().click();
  await page.waitForTimeout(600);
  await page.getByText("Black & white drawing", { exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByText("Dim others", { exact: true }).click();
  await page.waitForTimeout(700);
  const toggles = union(
    await boxOf(page.getByText("Black & white drawing", { exact: true })),
    await boxOf(page.getByText("Dim others", { exact: true })),
  );
  const bw = await boxOf(page.getByRole("button", { name: /b \/ w/i }).first());
  await annotate([toggles, bw]);
  await page.screenshot({ path: `${OUT}highlight-dim.png` });
  await clearAnnotations();
}

console.log("done");
await browser.close();
