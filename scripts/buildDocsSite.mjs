// Builds the static manual from documentation/*.md into public/manual/,
// which Vite copies into the app build (npm run build runs this first).
// Pure conversion — content generation lives in generate:docs, screenshots
// and their numbered marks in generateDocScreenshots.mjs.
//
// Markdown conventions on top of GFM:
//   ![caption](images/<shot>.png)  alone in a paragraph → a figure; when
//                                  images/shots.json knows <shot>, its
//                                  numbered marks are overlaid on the image
//   1. …  (ordered list right after such a figure) → the figure's legend
//   (#3)                           → an inline marker chip "3"
//   > [!NOTE] / [!TIP] / [!WARNING] → a callout box (GitHub syntax)

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const SRC = new URL("../documentation/", import.meta.url);
const OUT = new URL("../public/manual/", import.meta.url);
const SHOTS_FILE = new URL("images/shots.json", SRC);

/** Sidebar groups in order; any other .md page is appended to the last group. */
const NAV_GROUPS = [
  { title: null, pages: ["index.md"] },
  { title: "Guide", pages: ["getting-started.md", "tasks.md"] },
  {
    title: "Panels",
    pages: [
      "viewing.md",
      "explorer.md",
      "validation.md",
      "inspect.md",
      "xml-trees.md",
      "topology.md",
      "highlight.md",
      "export.md",
      "settings.md",
    ],
  },
  { title: "Reference", pages: ["conventions.md", "rules.md", "metamodel.md", "symbols.md"] },
];

const CALLOUT_TITLES = { NOTE: "Note", TIP: "Tip", WARNING: "Watch out" };

const CSS = `
:root { color-scheme: light dark; --bg:#f8fafc; --fg:#0f172a; --muted:#64748b; --line:#e2e8f0; --accent:#2563eb; --side:#eef2f7; --card:#ffffff;
  --mark:#f59e0b; --mark-fill:rgba(245,158,11,.07); --badge-fg:#111827; --tip:#059669; --warn:#d97706; }
@media (prefers-color-scheme: dark) { :root { --bg:#0f172a; --fg:#e2e8f0; --muted:#94a3b8; --line:#1e293b; --accent:#60a5fa; --side:#111c31; --card:#16213a;
  --mark:#fbbf24; --mark-fill:rgba(251,191,36,.08); --tip:#34d399; --warn:#fbbf24; } }
* { box-sizing: border-box; }
body { margin:0; display:flex; min-height:100vh; background:var(--bg); color:var(--fg); font:15px/1.6 system-ui, sans-serif; }
nav { width:240px; flex-shrink:0; padding:1.2rem 1rem; background:var(--side); border-right:1px solid var(--line); position:sticky; top:0; height:100vh; overflow:auto; }
nav h2 { font-size:.95rem; margin:0 0 .8rem; }
nav h3 { font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:1.1rem .5rem .3rem; }
nav a { display:block; padding:.28rem .5rem; border-radius:6px; color:var(--fg); text-decoration:none; font-size:.88rem; }
nav a:hover { background:var(--line); }
nav a.active { background:var(--accent); color:#fff; }
main { flex:1; min-width:0; padding:2rem 2.5rem 4rem; max-width:1040px; }
main > p > img { max-width:100%; border:1px solid var(--line); border-radius:8px; }
main table { border-collapse:collapse; display:block; overflow-x:auto; max-width:100%; }
main th, main td { border:1px solid var(--line); padding:.35rem .6rem; text-align:left; vertical-align:top; font-size:.86rem; }
main th { background:var(--side); }
main code { background:var(--side); padding:.1rem .3rem; border-radius:4px; font-size:.85em; }
main pre { background:var(--side); padding:.8rem 1rem; border-radius:8px; overflow-x:auto; }
main pre code { padding:0; }
main h1 { margin-top:0; }
main h2 { margin-top:2.4rem; padding-top:.6rem; border-top:1px solid var(--line); }
main h1 + p, main h1 + figure { margin-top:0; }
main a { color:var(--accent); }
kbd { font:600 .78em ui-monospace, monospace; padding:.08rem .4rem; border:1px solid var(--line); border-bottom-width:2px; border-radius:5px; background:var(--card); white-space:nowrap; }
td img { max-width:130px; max-height:60px; border:none; background:#fff; }
.footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); color:var(--muted); font-size:.8rem; }

figure.shot { margin:1.4rem 0 1rem; }
.shot-frame { position:relative; display:block; width:100%; padding:0; margin:0; border:1px solid var(--line); border-radius:8px; background:#fff; cursor:zoom-in; box-shadow:0 1px 3px rgba(15,23,42,.08); }
.shot-frame img { display:block; width:100%; height:auto; border-radius:7px; }
.mark { position:absolute; border:2px solid var(--mark); background:var(--mark-fill); border-radius:5px; pointer-events:none; }
.badge, .mk { display:inline-flex; align-items:center; justify-content:center; width:1.45rem; height:1.45rem; border-radius:50%;
  background:var(--mark); color:var(--badge-fg); font:700 .78rem/1 system-ui, sans-serif; }
.badge { position:absolute; box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.35); }
.badge.tl { left:0; top:0; transform:translate(-45%,-45%); }
.badge.tr { right:0; top:0; transform:translate(45%,-45%); }
.badge.bl { left:0; bottom:0; transform:translate(-45%,45%); }
.badge.br { right:0; bottom:0; transform:translate(45%,45%); }
.badge.c { left:50%; top:50%; transform:translate(-50%,-50%); }
.badge.t { left:50%; top:0; transform:translate(-50%,-55%); }
.badge.b { left:50%; bottom:0; transform:translate(-50%,55%); }
.badge.l { left:0; top:50%; transform:translate(-55%,-50%); }
.badge.r { right:0; top:50%; transform:translate(55%,-50%); }
.badge.above { left:50%; top:0; transform:translate(-50%,-125%); }
figcaption { color:var(--muted); font-size:.85rem; margin-top:.45rem; }
.mk { width:1.25rem; height:1.25rem; font-size:.7rem; vertical-align:.1em; margin:0 .1rem; }
ol.legend { list-style:none; padding:0; margin:.4rem 0 1.6rem; counter-reset:legend; }
ol.legend > li { counter-increment:legend; position:relative; padding-left:2.1rem; margin-bottom:.4rem; }
ol.legend > li::before { content:counter(legend); position:absolute; left:0; top:.1rem; display:flex; align-items:center; justify-content:center;
  width:1.45rem; height:1.45rem; border-radius:50%; background:var(--mark); color:var(--badge-fg); font:700 .78rem/1 system-ui, sans-serif; }
ol.steps { padding-left:0; list-style:none; counter-reset:step; }
ol.steps > li { counter-increment:step; position:relative; padding:0 0 .7rem 2.3rem; }
ol.steps > li::before { content:counter(step); position:absolute; left:0; top:.05rem; width:1.6rem; height:1.6rem; border-radius:50%;
  display:flex; align-items:center; justify-content:center; background:var(--accent); color:#fff; font:700 .8rem/1 system-ui, sans-serif; }
ol.steps > li::after { content:""; position:absolute; left:.78rem; top:1.8rem; bottom:.15rem; width:2px; background:var(--line); }
ol.steps > li:last-child::after { display:none; }
.callout { border:1px solid var(--line); border-left:4px solid var(--accent); background:var(--card); border-radius:8px; padding:.6rem 1rem; margin:1.2rem 0; }
.callout.tip { border-left-color:var(--tip); }
.callout.warning { border-left-color:var(--warn); }
.callout > p:first-child { margin-top:0; }
.callout > p:last-child { margin-bottom:0; }
.callout-title { display:block; font-weight:700; font-size:.78rem; text-transform:uppercase; letter-spacing:.05em; margin-bottom:.15rem; color:var(--accent); }
.tip .callout-title { color:var(--tip); }
.warning .callout-title { color:var(--warn); }
blockquote { margin:1.2rem 0; padding:.2rem 1rem; border-left:4px solid var(--line); color:var(--muted); }

.cards { display:grid; grid-template-columns:repeat(auto-fill, minmax(230px, 1fr)); gap:1rem; margin:1.2rem 0 2rem; }
.card { display:flex; flex-direction:column; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:var(--card); color:var(--fg) !important; text-decoration:none; transition:transform .12s ease, box-shadow .12s ease; }
.card:hover { transform:translateY(-2px); box-shadow:0 6px 18px rgba(15,23,42,.14); }
.card img { width:100%; height:130px; object-fit:cover; object-position:var(--pos, center); border-bottom:1px solid var(--line); background:#fff; }
.card b { padding:.6rem .8rem 0; }
.card span { padding:.15rem .8rem .8rem; color:var(--muted); font-size:.85rem; line-height:1.45; }

dialog.zoom { border:none; padding:0; background:transparent; max-width:none; max-height:none; overflow:visible; }
dialog.zoom::backdrop { background:rgba(15,23,42,.82); }
dialog.zoom .shot-frame { cursor:zoom-out; }
dialog.zoom .zoom-close { position:fixed; top:.8rem; right:1rem; width:2.4rem; height:2.4rem; border-radius:50%; border:none; background:#fff; color:#0f172a; font-size:1.3rem; cursor:pointer; }

.nav-toggle, .mobile-bar, .backdrop { display:none; }
@media (max-width: 820px) {
  body { display:block; }
  .mobile-bar { display:flex; align-items:center; gap:.9rem; position:fixed; top:0; left:0; right:0; z-index:30; background:var(--side); border-bottom:1px solid var(--line); padding:.55rem .9rem; font-weight:600; font-size:.95rem; }
  .mobile-bar label { display:flex; flex-direction:column; justify-content:center; gap:5px; width:38px; height:38px; padding:.45rem .5rem; border-radius:8px; cursor:pointer; }
  .mobile-bar label:active { background:var(--line); }
  .mobile-bar label span { display:block; width:22px; height:2px; background:var(--fg); border-radius:2px; }
  nav { position:fixed; top:0; left:0; bottom:0; height:100dvh; width:min(78vw, 280px); z-index:50; transform:translateX(-100%); transition:transform .25s ease; box-shadow:0 0 24px rgba(15,23,42,.35); }
  .nav-toggle:checked ~ nav { transform:none; }
  .nav-toggle:checked ~ .backdrop { display:block; position:fixed; inset:0; z-index:40; background:rgba(15,23,42,.45); }
  main { padding:4.3rem 1rem 3rem; }
  .badge { width:1.15rem; height:1.15rem; font-size:.65rem; }
}
`;

/** Click-to-zoom: clones the clicked figure into a modal dialog sized to fit the viewport. */
const ZOOM_SCRIPT = `
const dialog = document.createElement("dialog");
dialog.className = "zoom";
document.body.append(dialog);
dialog.addEventListener("click", () => dialog.close());
for (const frame of document.querySelectorAll(".shot-frame")) {
  frame.addEventListener("click", () => {
    const copy = frame.cloneNode(true);
    const w = Number(frame.dataset.w);
    const h = Number(frame.dataset.h);
    copy.style.width = "min(96vw, " + (92 * w / h).toFixed(2) + "vh, " + w + "px)";
    copy.removeAttribute("aria-label");
    const close = document.createElement("button");
    close.className = "zoom-close";
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    dialog.replaceChildren(copy, close);
    dialog.showModal();
  });
}
`;

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

const shots = existsSync(SHOTS_FILE) ? JSON.parse(readFileSync(SHOTS_FILE, "utf-8")) : {};

const escapeAttr = (s) => s.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

const pct = (v, total) => `${((100 * v) / total).toFixed(3)}%`;

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&#?\w+;/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/** A figure for one image; known shots get their numbered marks as positioned overlays. */
function renderFigure(href, caption) {
  const name = /images\/([\w-]+)\.png$/.exec(href)?.[1];
  const shot = name ? shots[name] : undefined;
  if (!shot) {
    return `<figure class="shot"><img src="${href}" alt="${escapeAttr(caption)}" loading="lazy"><figcaption>${caption}</figcaption></figure>\n`;
  }
  const marks = shot.marks
    .map(
      (m) =>
        `<span class="mark" style="left:${pct(m.x, shot.w)};top:${pct(m.y, shot.h)};width:${pct(m.w, shot.w)};height:${pct(m.h, shot.h)}">` +
        `<span class="badge ${m.at ?? "tl"}">${m.n}</span></span>`,
    )
    .join("");
  const displayWidth = Math.round(shot.w * (shot.scale ?? 1));
  return (
    `<figure class="shot"><button type="button" class="shot-frame" aria-label="Enlarge image" data-w="${displayWidth}" data-h="${Math.round(shot.h * (shot.scale ?? 1))}" style="max-width:${displayWidth}px">` +
    `<img src="${href}" alt="${escapeAttr(caption)}" width="${shot.w}" height="${shot.h}" loading="lazy">${marks}</button>` +
    `<figcaption>${caption}</figcaption></figure>\n`
  );
}

marked.use({
  gfm: true,
  renderer: {
    paragraph(token) {
      const only = token.tokens.length === 1 ? token.tokens[0] : undefined;
      if (only?.type === "image") {
        return renderFigure(only.href, only.text);
      }
      return false;
    },
    heading(token) {
      const inner = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${slug(inner)}">${inner}</h${token.depth}>\n`;
    },
    blockquote(token) {
      const body = this.parser.parse(token.tokens);
      const match = /^<p>\[!(NOTE|TIP|WARNING)\]\s*/.exec(body);
      if (!match) {
        return `<blockquote>${body}</blockquote>\n`;
      }
      const kind = match[1];
      return `<aside class="callout ${kind.toLowerCase()}"><span class="callout-title">${CALLOUT_TITLES[kind]}</span><p>${body.slice(match[0].length)}</aside>\n`;
    },
  },
});

/** Post-processing the parser cannot express: legends, step lists, marker chips, .md links. */
function finishHtml(html) {
  return html
    .replaceAll(/(<\/figure>\s*)<ol>/g, '$1<ol class="legend">')
    .replaceAll(/<!--\s*steps\s*-->\s*<ol>/g, '<ol class="steps">')
    .replaceAll(/href="([\w-]+)\.md(#[\w-]+)?"/g, 'href="$1.html$2"')
    .split(/(<pre[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>)/)
    .map((part, i) => (i % 2 === 1 ? part : part.replaceAll(/\(#(\d{1,2})\)/g, '<span class="mk">$1</span>')))
    .join("");
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const dir of ["images", "symbols", "signals"]) {
  try {
    cpSync(new URL(`${dir}/`, SRC), new URL(`${dir}/`, OUT), { recursive: true });
  } catch {
    // Optional asset folder not generated yet — pages still build.
  }
}
rmSync(new URL("images/shots.json", OUT), { force: true });

const listed = NAV_GROUPS.flatMap((g) => g.pages).filter((p) => existsSync(new URL(p, SRC)));
const extra = readdirSync(SRC)
  .filter((f) => f.endsWith(".md") && !listed.includes(f))
  .sort();
const groups = NAV_GROUPS.map((g, i) => ({
  title: g.title,
  pages: [...g.pages.filter((p) => listed.includes(p)), ...(i === NAV_GROUPS.length - 1 ? extra : [])],
}));
const pages = groups.flatMap((g) => g.pages);
const titles = new Map(
  pages.map((page) => {
    const text = readFileSync(new URL(page, SRC), "utf-8");
    return [page, /^#\s+(.+)$/m.exec(text)?.[1] ?? page.replace(".md", "")];
  }),
);

for (const page of pages) {
  const html = finishHtml(marked.parse(readFileSync(new URL(page, SRC), "utf-8")));
  const nav = groups
    .map((g) => {
      const links = g.pages
        .map((p) => {
          const active = p === page ? ' class="active"' : "";
          return `<a href="${p.replace(".md", ".html")}"${active}>${titles.get(p)}</a>`;
        })
        .join("\n");
      return g.title ? `<h3>${g.title}</h3>\n${links}` : links;
    })
    .join("\n");
  writeFileSync(
    new URL(page.replace(".md", ".html"), OUT),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titles.get(page)} — DEXPI Viewer manual</title><style>${CSS}</style></head>
<body><input class="nav-toggle" id="nav-toggle" type="checkbox">
<header class="mobile-bar"><label for="nav-toggle" aria-label="Toggle navigation"><span></span><span></span><span></span></label>DEXPI Viewer manual</header>
<label class="backdrop" for="nav-toggle" aria-hidden="true"></label>
<nav><h2><a href="index.html" style="padding:0">DEXPI Viewer</a></h2>${nav}
<a href="../index.html" style="margin-top:1rem;color:var(--muted)">← Back to the app</a></nav>
<main>${html}<div class="footer">Generated from documentation/ — see scripts/buildDocsSite.mjs.</div></main>
<script>${ZOOM_SCRIPT}</script></body></html>
`,
  );
}
console.log(`manual: ${pages.length} pages → public/manual/`);
