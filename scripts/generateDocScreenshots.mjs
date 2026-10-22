// Regenerates the manual's screenshots in documentation/images/ by driving
// the real app. Prerequisites (not project dependencies):
//   1. `npm run dev -- --port 5199 --strictPort` running in another shell
//      (or any port, passed as APP_URL=http://localhost:<port>/)
//   2. playwright available to node (e.g. `npm i --no-save playwright` +
//      `npx playwright install chromium-headless-shell`)
// Run: node scripts/generateDocScreenshots.mjs [shot-name …]
//   (no names = every shot; names = just those, the rest of shots.json kept)
//
// Every shot starts from a fresh browser context (clean localStorage, so the
// default panel layout) with DISC_EXAMPLE-14-08 loaded. Screenshots are
// captured clean; numbered marks are measured from real element bounding
// boxes and written to images/shots.json, and buildDocsSite.mjs overlays
// them — so they stay sharp, follow the UI, and match the text's (#n) chips.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = new URL("../documentation/images/", import.meta.url).pathname;
const MANIFEST = `${OUT}shots.json`;
const SAMPLE_DIR = new URL("../refrences/discdexpi-2026pack/Blueprint/DISC_EXAMPLE-14/", import.meta.url).pathname;
const SAMPLE = "DISC_EXAMPLE-14-08";
const APP_URL = process.env.APP_URL ?? "http://localhost:5199/";
/** Wide enough that the ribbon does not scroll (it is ~1540 px). */
const VIEWPORT = { width: 1560, height: 900 };
const PIXEL_RATIO = 1.5;

/** The sample sheet's extent in mm; Fit maps it onto the canvas. */
const SHEET = { w: 841, h: 594 };

/** Where to find things on the sample sheet, in sheet mm. */
const SPOT = {
  ballValve: { x: 442, y: 430 },
  pump: { x: 170, y: 254 },
};

const MARK_PAD = 4;
const LOCATOR_TIMEOUT_MS = 8000;

mkdirSync(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf-8")) : {};
const browser = await chromium.launch();

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

/** A fresh page with the sample loaded against its declared profile. */
async function openSample({ profile = "0.6.3" } = {}) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: PIXEL_RATIO });
  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: "networkidle" });
  if (profile) {
    await page.getByRole("button", { name: profile, exact: true }).click();
    await page.waitForTimeout(1200);
  }
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Open", exact: true }).click(),
  ]);
  await chooser.setFiles(`${SAMPLE_DIR}${SAMPLE}.xml`);
  await page.getByText(/\d+ objects$/).waitFor();
  await page.waitForTimeout(1800);
  return page;
}

/** Sheet mm → screen px, assuming the drawing is fitted to the canvas. */
async function sheetToScreen(page, spot) {
  const box = await page.locator("canvas").first().boundingBox();
  const scale = Math.min(box.width / SHEET.w, box.height / SHEET.h);
  return {
    x: box.x + (box.width - SHEET.w * scale) / 2 + spot.x * scale,
    y: box.y + (box.height - SHEET.h * scale) / 2 + spot.y * scale,
  };
}

/** Re-fits the drawing — needed after any dock resize, or sheet mm no longer map. */
async function fit(page) {
  await page.locator('[data-shortcut="view.fit"]').click();
  await page.waitForTimeout(400);
}

async function clickSheet(page, spot, options) {
  await fit(page);
  const p = await sheetToScreen(page, spot);
  await page.mouse.click(p.x, p.y, options);
  await page.waitForTimeout(600);
}

async function zoomAt(page, spot, steps) {
  await fit(page);
  const p = await sheetToScreen(page, spot);
  await page.mouse.move(p.x, p.y);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(600);
}

const button = (page, name) => page.getByRole("button", { name, exact: true }).first();

/** A dock tab by its visible label (prefix match: "Validation" finds "Validation (9)"). */
const tab = (page, label) => page.getByRole("tab", { name: new RegExp(`^${label}`) }).first();

/** A dock group: left, center, right, rightBottom, graphTop, … */
const dock = (page, node) => page.locator(`section.dock-tabs[data-node=${node}]`).first();

async function openTab(page, label) {
  await tab(page, label).click();
  await page.waitForTimeout(700);
}

/** The dock group currently holding the tab `label`. */
const panelOf = (page, label) =>
  page.locator("section.dock-tabs").filter({ has: page.getByRole("tab", { name: new RegExp(`^${label}`) }) }).first();

/** Expands a collapsed rail (Topology graph, Inspect) by clicking its rail tab. */
async function expandRail(page, label) {
  await page.locator(".dock-rail-tab").filter({ hasText: label }).first().click();
  await page.waitForTimeout(1200);
}

/** Drags the n-th row splitter (left to right: 0 = left dock edge, 2 = right dock edge) by dx px. */
async function dragSplitter(page, n, dx) {
  const b = await boxOf(page.locator(".dock-splitter--row").nth(n));
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

const widenLeft = (page) => dragSplitter(page, 0, 130);
async function widenRight(page) {
  await closeMinimap(page);
  await dragSplitter(page, 2, -170);
}

/** Widens the expanded Topology graph / Inspect column into the drawing's space. */
const widenGraphColumn = (page) => dragSplitter(page, 1, -520);

/** A panel section heading (h4), matched on its leading text. */
const heading = (scope, text) => scope.locator("h4:visible", { hasText: new RegExp(`^\\s*${text}`) }).first();

/** The visible search box of a tree panel (hidden tabs in the same dock have one too). */
const searchBox = (scope) => scope.locator('input[placeholder="Search objects…"]:visible').first();

/** Closes the Minimap so the right dock gets the full height. */
async function closeMinimap(page) {
  await page.getByRole("button", { name: "Close Minimap" }).click();
  await page.waitForTimeout(500);
}

/** Picks an option in a tredespace Select (trigger shows the current value). */
async function choose(page, scope, current, option) {
  await scope.getByRole("button", { name: current }).first().click();
  await page.waitForTimeout(250);
  await page.getByRole("option", { name: option }).first().click();
  await page.waitForTimeout(600);
}

const tooltip = (scope, text) => scope.locator(`[data-tooltip="${text}"]`).first();

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

async function boxOf(target) {
  const b = typeof target.boundingBox === "function" ? await target.boundingBox() : target;
  if (!b) {
    throw new Error("mark target not visible");
  }
  return { x: b.x, y: b.y, width: b.width, height: b.height };
}

/** Smallest box around several locators / boxes. */
async function around(...targets) {
  const boxes = await Promise.all(targets.map(boxOf));
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

/** The ribbon section whose caption is `label` (caption + its buttons). */
const ribbonSection = (page, label) => page.locator(`div.grid.shrink-0:has(> :text-is("${label}"))`).first();

/** Expands a box by `by` px on every side (negative shrinks). */
const grow = (b, by) => ({ x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by });

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

/**
 * Screenshots `clip` (default: the whole viewport) and records its marks,
 * numbered in the order given. A mark is a locator/box, or { target, at }
 * with `at` the badge spot: a corner (tl default, tr, bl, br), an edge
 * centre (t, b, l, r), c, or "above" (clear of the box, for thin strips). The pointer is
 * parked off the page first unless `keepMouse` (hover states, drags).
 */
async function capture(page, name, { clip, marks = [], keepMouse = false } = {}) {
  const area = clip ? await boxOf(clip) : { x: 0, y: 0, ...VIEWPORT };
  const region = {
    x: Math.max(0, Math.round(area.x)),
    y: Math.max(0, Math.round(area.y)),
    width: Math.round(Math.min(area.width, VIEWPORT.width - Math.max(0, area.x))),
    height: Math.round(Math.min(area.height, VIEWPORT.height - Math.max(0, area.y))),
  };
  const measured = [];
  for (const [i, mark] of marks.entries()) {
    const isPlain = typeof mark.boundingBox === "function" || "width" in mark;
    const b = grow(
      await boxOf(isPlain ? mark : mark.target).catch((err) => {
        throw new Error(`${name} mark ${i + 1}: ${err.message.split("\n")[0]}`);
      }),
      MARK_PAD,
    );
    const x0 = Math.max(b.x - region.x, 1);
    const y0 = Math.max(b.y - region.y, 1);
    const x1 = Math.min(b.x + b.width - region.x, region.width - 1);
    const y1 = Math.min(b.y + b.height - region.y, region.height - 1);
    const entry = { n: i + 1, x: round1(x0), y: round1(y0), w: round1(x1 - x0), h: round1(y1 - y0) };
    if (!isPlain && mark.at) {
      entry.at = mark.at;
    }
    measured.push(entry);
  }
  if (!keepMouse) {
    await page.mouse.move(0, VIEWPORT.height - 1);
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: `${OUT}${name}.png`, clip: region });
  manifest[name] = { w: region.width, h: region.height, scale: PIXEL_RATIO, marks: measured };
  console.log(`  ${name}.png  ${region.width}×${region.height}  ${measured.length} marks`);
}

const round1 = (v) => Math.round(v * 10) / 10;

// ---------------------------------------------------------------------------
// Shots
// ---------------------------------------------------------------------------

/** name → async (page) => void; each receives a freshly loaded sample. */
const SHOTS = {};

SHOTS.workbench = async (page) => {
  await clickSheet(page, SPOT.ballValve);
  await openTab(page, "Properties");
  const statusBar = page.getByText(/\d+ objects$/).locator("..");
  await capture(page, "workbench", {
    marks: [
      { target: await around(ribbonSection(page, "File"), ribbonSection(page, "Help")), at: "c" },
      { target: dock(page, "left"), at: "c" },
      { target: dock(page, "center"), at: "c" },
      { target: await around(dock(page, "graphTop"), page.locator(".dock-rail-tab").filter({ hasText: "Inspect" })), at: "c" },
      { target: dock(page, "right"), at: "c" },
      { target: dock(page, "rightBottom"), at: "c" },
      { target: statusBar, at: "c" },
    ],
  });
};

SHOTS.ribbonFile = async (page) => {
  await capture(page, "ribbon-file", {
    clip: grow(await around(ribbonSection(page, "File"), ribbonSection(page, "Profile")), 2),
    marks: [
      { target: button(page, "Open"), at: "b" },
      { target: button(page, "Example"), at: "b" },
      { target: button(page, "Auto"), at: "l" },
      { target: button(page, "Custom profile"), at: "l" },
      { target: await around(button(page, "0.6.6"), button(page, "0.6.3")), at: "b" },
    ],
  });
};

SHOTS.ribbonPanels = async (page) => {
  await capture(page, "ribbon-panels", {
    clip: grow(await around(ribbonSection(page, "Panels"), ribbonSection(page, "Help")), 2),
    marks: [
      { target: await around(button(page, "Explorer"), button(page, "Diagram Tree"), button(page, "Validation")), at: "b" },
      { target: button(page, "Reset"), at: "b" },
      { target: button(page, "Docs"), at: "b" },
    ],
  });
};

SHOTS.statusBar = async (page) => {
  await page.getByRole("button", { name: "0.6.4", exact: true }).click();
  await page.waitForTimeout(1200);
  const p = await sheetToScreen(page, SPOT.pump);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(300);
  const bar = page.getByText(/\d+ objects$/).locator("..");
  const cells = bar.locator("> span");
  // Blank space on top of the bar itself, so the badges sit clear of the panels above.
  await bar.evaluate((el) => {
    el.style.paddingTop = "30px";
  });
  await page.waitForTimeout(200);
  const barBox = await boxOf(bar);
  const left = await around(cells.nth(0), cells.nth(2));
  await capture(page, "status-bar", {
    keepMouse: true,
    clip: { x: 0, y: barBox.y, width: left.x + left.width + 24, height: barBox.height },
    marks: [cells.nth(0), cells.nth(1), cells.nth(2)].map((c) => ({ target: c, at: "above" })),
  });
};

SHOTS.panelDrag = async (page) => {
  const from = await boxOf(tab(page, "Validation"));
  const canvas = await boxOf(page.locator("canvas").first());
  const to = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      from.x + from.width / 2 + ((to.x - from.x - from.width / 2) * i) / 12,
      from.y + from.height / 2 + ((to.y - from.y - from.height / 2) * i) / 12,
    );
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(500);
  await capture(page, "panel-drag", { keepMouse: true });
  await page.keyboard.press("Escape");
  await page.mouse.up();
};

// viewing.md ---------------------------------------------------------------

SHOTS.ribbonView = async (page) => {
  await capture(page, "ribbon-view", {
    clip: grow(await boxOf(ribbonSection(page, "View")), 2),
    marks: [
      { target: button(page, "Fit"), at: "b" },
      { target: await around(button(page, "In"), button(page, "100%")), at: "b" },
      { target: button(page, "Dark"), at: "b" },
      { target: button(page, "B / W"), at: "b" },
    ],
  });
};

SHOTS.minimap = async (page) => {
  await zoomAt(page, SPOT.ballValve, 10);
  await capture(page, "minimap", { clip: dock(page, "rightBottom") });
};

SHOTS.selectionHalo = async (page) => {
  await clickSheet(page, SPOT.pump);
  await zoomAt(page, SPOT.pump, 14);
  const p = await sheetToScreen(page, SPOT.pump);
  const canvas = await boxOf(page.locator("canvas").first());
  const size = { width: 660, height: 420 };
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  await capture(page, "selection-halo", {
    clip: {
      x: clamp(p.x - size.width / 2, canvas.x + 4, canvas.x + canvas.width - size.width - 4),
      y: clamp(p.y - size.height / 2, canvas.y + 4, canvas.y + canvas.height - size.height - 4),
      ...size,
    },
  });
};

SHOTS.underlay = async (page) => {
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles(`${SAMPLE_DIR}${SAMPLE}.svg`);
  await page.waitForTimeout(2500);
  const center = dock(page, "center");
  await center.getByText("Tint", { exact: true }).click();
  await center.getByText("Hide white", { exact: true }).click();
  await page.waitForTimeout(400);
  await zoomAt(page, { x: 330, y: 58 }, 18);
  await capture(page, "underlay", {
    clip: center,
    marks: [
      button(page, "Underlay…"),
      await around(center.getByText("Show", { exact: true }), center.getByText("Opacity", { exact: true })),
      await around(center.getByText("X", { exact: true }), center.getByText("Scale", { exact: true })),
      await around(center.getByText("Hide white", { exact: true }), center.getByText("Tint", { exact: true })),
      { target: button(page, "Clear"), at: "tr" },
    ],
  });
};

// explorer.md --------------------------------------------------------------

SHOTS.explorer = async (page) => {
  await widenLeft(page);
  await openTab(page, "Explorer");
  await clickSheet(page, SPOT.ballValve);
  const left = dock(page, "left");
  await capture(page, "explorer", {
    clip: left,
    marks: [
      searchBox(left),
      await around(tooltip(left, "Expand all"), tooltip(left, "Collapse all")),
      { target: left.getByRole("button", { name: "Zoom to" }), at: "tr" },
      left.getByText("Search in:").locator(".."),
      left.getByText("Show:").locator(".."),
    ],
  });
};

SHOTS.explorerMenu = async (page) => {
  await widenLeft(page);
  await openTab(page, "Explorer");
  const left = dock(page, "left");
  await left.getByText("PipingNetworkSystem1", { exact: true }).click({ button: "right" });
  await page.waitForTimeout(400);
  const menu = await around(page.getByText("Select children", { exact: true }), page.getByText("Copy label + type + id"));
  const panel = await boxOf(left);
  await capture(page, "explorer-menu", {
    clip: { x: panel.x, y: menu.y - 180, width: panel.width, height: menu.height + 240 },
    marks: [{ target: menu, at: "tr" }],
  });
};

SHOTS.properties = async (page) => {
  await widenRight(page);
  await clickSheet(page, SPOT.pump);
  await openTab(page, "Properties");
  const right = panelOf(page, "Properties");
  await capture(page, "properties", {
    clip: right,
    marks: [
      { target: heading(right, "Identity"), at: "l" },
      { target: heading(right, "Data"), at: "l" },
      { target: await around(heading(right, "References"), heading(right, "Sub-components")), at: "l" },
      { target: heading(right, "Issues"), at: "l" },
    ],
  });
};

// validation.md ------------------------------------------------------------

SHOTS.validation = async (page) => {
  await widenLeft(page);
  await openTab(page, "Validation");
  const left = dock(page, "left");
  await capture(page, "validation", {
    clip: left,
    marks: [
      await around(left.getByRole("button", { name: /^All \(/ }), left.getByRole("button", { name: /^Info \(/ })),
      await around(tooltip(left, "Expand all groups"), tooltip(left, "Collapse all groups")),
      await around(left.getByRole("button", { name: "CSV", exact: true }), left.getByRole("button", { name: "Excel", exact: true })),
      { target: tooltip(left, "Configure rule severities"), at: "tr" },
      left.getByRole("button", { name: "All categories" }),
      left.getByText(/^CON-001/).first(),
      { target: left.getByText(/^↳/).first(), at: "l" },
    ],
  });
};

SHOTS.severityConfig = async (page) => {
  await widenLeft(page);
  await openTab(page, "Validation");
  const left = dock(page, "left");
  await tooltip(left, "Configure rule severities").click();
  await page.waitForTimeout(500);
  await choose(page, left, "Default", /^Ignore/);
  await capture(page, "severity-config", {
    clip: left,
    marks: [
      { target: left.getByRole("button", { name: "Reset all" }), at: "tr" },
      { target: left.getByRole("button", { name: "Ignore" }).first(), at: "tr" },
    ],
  });
};

// inspect.md ---------------------------------------------------------------

SHOTS.inspect = async (page) => {
  await clickSheet(page, SPOT.ballValve);
  await expandRail(page, "Inspect");
  await widenGraphColumn(page);
  const panel = panelOf(page, "Inspect");
  await choose(page, panel, "1 level", /^2 levels/);
  await panel.getByRole("button", { name: "Fit", exact: true }).click();
  await page.waitForTimeout(600);
  await capture(page, "inspect", {
    clip: panel,
    marks: [
      { target: panel.getByText("Drawing", { exact: true }), at: "b" },
      { target: panel.getByRole("button", { name: "2 levels" }), at: "b" },
      { target: panel.getByRole("button", { name: "Fit", exact: true }), at: "b" },
    ],
  });
};

SHOTS.inspectDrawing = async (page) => {
  await clickSheet(page, SPOT.ballValve);
  await expandRail(page, "Inspect");
  await widenGraphColumn(page);
  const panel = panelOf(page, "Inspect");
  await panel.getByText("Drawing", { exact: true }).click();
  await page.waitForTimeout(1200);
  await panel.getByRole("button", { name: "Fit", exact: true }).click();
  await page.waitForTimeout(600);
  await panel
    .locator("svg[aria-label='Object diagram'] text", { hasText: "RepresentationGroup" })
    .first()
    .click({ button: "right" });
  await page.waitForTimeout(500);
  await capture(page, "inspect-drawing", {
    clip: panel,
    marks: [
      panel.getByText("Drawing", { exact: true }),
      { target: await around(page.getByText("Copy data as JSON"), page.getByText("Copy XPath")), at: "tr" },
    ],
  });
};

// xml-trees.md -------------------------------------------------------------

/** Opens one XML tree panel (it docks as a tab in the left group) with the pump selected. */
async function openXmlTree(page, ribbonLabel, tabLabel) {
  await widenLeft(page);
  await button(page, ribbonLabel).click();
  await page.waitForTimeout(600);
  await clickSheet(page, SPOT.pump);
  await openTab(page, tabLabel);
  return panelOf(page, tabLabel);
}

SHOTS.conceptualTree = async (page) => {
  const panel = await openXmlTree(page, "Conceptual Model", "Conceptual Model Tree");
  const handle = await boxOf(panel.getByLabel("Resize data section"));
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y - 230, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await capture(page, "conceptual-tree", {
    clip: panel,
    marks: [
      searchBox(panel),
      { target: panel.getByLabel("Resize type column"), at: "t" },
      { target: panel.getByLabel("Resize data section"), at: "r" },
      { target: heading(panel, "Data"), at: "r" },
      { target: heading(panel, "Inverse References"), at: "r" },
    ],
  });
};

SHOTS.diagramTree = async (page) => {
  const panel = await openXmlTree(page, "Diagram Tree", "Diagram Tree");
  await capture(page, "diagram-tree", { clip: panel });
};

// topology.md --------------------------------------------------------------

SHOTS.topology = async (page) => {
  await clickSheet(page, SPOT.ballValve);
  await expandRail(page, "Topology graph");
  await widenGraphColumn(page);
  const panel = panelOf(page, "Topology graph");
  await panel.getByRole("button", { name: "Fit", exact: true }).click();
  await page.waitForTimeout(600);
  await capture(page, "topology", {
    clip: panel,
    marks: [
      await around(panel.getByRole("button", { name: "Neighborhood" }), panel.getByRole("button", { name: "Document" })),
      { target: panel.getByText(/^Depth \d/), at: "b" },
      { target: panel.getByText(/^Gap/), at: "b" },
      panel.getByRole("button", { name: "Linked" }),
      { target: panel.getByRole("button", { name: "Fit", exact: true }), at: "tr" },
      await around(panel.getByText("Edges:"), panel.getByRole("button", { name: "References" })),
      await around(panel.getByText("Show:"), panel.getByRole("button", { name: "Ports" })),
    ],
  });
};

SHOTS.connections = async (page) => {
  await widenRight(page);
  await clickSheet(page, SPOT.pump);
  await openTab(page, "Connections");
  const right = panelOf(page, "Connections");
  await right.getByRole("button", { name: "Both", exact: true }).click();
  await page.waitForTimeout(800);
  await capture(page, "connections", {
    marks: [
      await around(right.getByRole("button", { name: "Upstream", exact: true }), right.getByRole("button", { name: "Both", exact: true })),
      { target: heading(right, "Upstream"), at: "r" },
      { target: heading(right, "Downstream"), at: "r" },
      { target: heading(right, "Connection points"), at: "r" },
    ],
  });
};

// highlight.md -------------------------------------------------------------

SHOTS.highlight = async (page) => {
  await widenRight(page);
  await openTab(page, "Highlight");
  const right = dock(page, "right");
  await choose(page, right, "Off", /^Signal & instrument lines/);
  await right.getByText("Black & white drawing", { exact: true }).click();
  await right.getByText("Dim drawing", { exact: true }).first().click();
  await page.waitForTimeout(800);
  await capture(page, "highlight", {
    marks: [
      right.getByRole("button", { name: "Signal & instrument lines" }),
      await around(right.getByText("Black & white drawing", { exact: true }), right.getByText("Dim drawing", { exact: true }).first()),
      { target: right.getByText("Values", { exact: true }), at: "l" },
      { target: button(page, "B / W"), at: "b" },
    ],
  });
};

SHOTS.highlightCustom = async (page) => {
  await widenRight(page);
  await openTab(page, "Highlight");
  const right = dock(page, "right");
  await choose(page, right, "Off", /^Custom/);
  await tooltip(right, "Add a filter").click();
  await page.waitForTimeout(400);
  await right.getByPlaceholder("Value").first().fill("Valve");
  await page.waitForTimeout(800);
  await capture(page, "highlight-custom", {
    clip: right,
    marks: [
      { target: tooltip(right, "Add a filter"), at: "tr" },
      right.getByPlaceholder("Filter name"),
      { target: await around(right.getByRole("button", { name: "Simple" }), right.getByRole("button", { name: "Advanced" })), at: "t" },
      { target: await around(tooltip(right, "Move up (lower priority)"), tooltip(right, "Remove filter")), at: "tr" },
      { target: right.getByPlaceholder("Value").first(), at: "br" },
      right.getByRole("button", { name: "Add condition" }),
      await around(right.getByRole("button", { name: "Save", exact: true }), right.getByRole("button", { name: "Load", exact: true })),
    ],
  });
};

SHOTS.labelInspect = async (page) => {
  await widenRight(page);
  await openTab(page, "Highlight");
  const right = dock(page, "right");
  await right.getByText("General Highlight", { exact: true }).click();
  await page.waitForTimeout(400);
  await right.getByText(/^Show label template positions/).first().click();
  await page.waitForTimeout(800);
  await zoomAt(page, SPOT.ballValve, 8);
  await capture(page, "label-inspect", {
    marks: [
      right.getByText(/^Show label template positions/).first(),
      await around(right.getByText("Color", { exact: true }), right.getByRole("button", { name: "In front of drawing" })),
    ],
  });
};

SHOTS.nodePositions = async (page) => {
  await widenRight(page);
  await openTab(page, "Highlight");
  const right = dock(page, "right");
  await right.getByText("General Highlight", { exact: true }).click();
  await right.getByText("Label Inspect", { exact: true }).click();
  await page.waitForTimeout(400);
  await right.getByRole("button", { name: "All", exact: true }).click();
  await page.waitForTimeout(800);
  await zoomAt(page, SPOT.ballValve, 9);
  const firstKind = right.getByText(/^(File|Profile) /).first();
  await capture(page, "node-positions", {
    marks: [
      { target: await around(right.getByRole("button", { name: "Reset scale" }), right.getByRole("button", { name: "None", exact: true })), at: "tr" },
      { target: firstKind, at: "l" },
    ],
  });
};

// export.md ----------------------------------------------------------------

SHOTS.ribbonExport = async (page) => {
  await capture(page, "ribbon-export", {
    clip: grow(await around(ribbonSection(page, "Export"), ribbonSection(page, "Validation")), 2),
    marks: [
      { target: ribbonSection(page, "Export"), at: "t" },
      { target: ribbonSection(page, "As viewed"), at: "t" },
      { target: ribbonSection(page, "Validation"), at: "t" },
    ],
  });
};

// settings.md --------------------------------------------------------------

/** Opens one Settings tab with the right dock widened. */
async function openSettings(page, section) {
  await widenRight(page);
  await openTab(page, "Settings");
  await dock(page, "right").getByText(section, { exact: true }).first().click();
  await page.waitForTimeout(500);
  return dock(page, "right");
}

SHOTS.settingsRendering = async (page) => {
  const right = await openSettings(page, "Rendering");
  await capture(page, "settings-rendering", {
    clip: right,
    marks: [{ target: right.getByRole("button", { name: "Reset to defaults" }), at: "tr" }],
  });
};

SHOTS.settingsProfile = async (page) => {
  const right = await openSettings(page, "Profile");
  await capture(page, "settings-profile", {
    clip: right,
    marks: [right.getByText("Auto-load the declared profile", { exact: true })],
  });
};

SHOTS.settingsShortcuts = async (page) => {
  const right = await openSettings(page, "Shortcuts");
  await capture(page, "settings-shortcuts", {
    clip: right,
    marks: [
      await around(right.getByRole("button", { name: "Export keymap" }), right.getByRole("button", { name: "Import keymap" })),
      { target: right.getByRole("button", { name: "Record" }).first(), at: "tr" },
      { target: right.getByRole("button", { name: "Reset", exact: true }).first(), at: "tr" },
    ],
  });
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const wanted = process.argv.slice(2);
const names = wanted.length > 0 ? wanted : Object.keys(SHOTS);
const failed = [];
for (const name of names) {
  const run = SHOTS[name];
  if (!run) {
    throw new Error(`unknown shot "${name}" — known: ${Object.keys(SHOTS).join(", ")}`);
  }
  console.log(name);
  const page = await openSample();
  page.setDefaultTimeout(LOCATOR_TIMEOUT_MS);
  try {
    await run(page);
  } catch (err) {
    failed.push(name);
    console.error(`  FAILED: ${err.message.split("\n")[0]} (page state: temp/${name}-failed.png)`);
    await page.screenshot({ path: new URL(`../temp/${name}-failed.png`, import.meta.url).pathname });
  }
  await page.context().close();
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
console.log(`done — ${names.length - failed.length}/${names.length} shot sets${failed.length ? `, failed: ${failed.join(", ")}` : ""}`);
process.exitCode = failed.length > 0 ? 1 : 0;
