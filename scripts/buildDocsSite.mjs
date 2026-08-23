// Builds the static manual from documentation/*.md into public/manual/,
// which Vite copies into the app build (npm run build runs this first).
// Pure conversion — content generation lives in generate:docs.

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { marked } from "marked";

const SRC = new URL("../documentation/", import.meta.url);
const OUT = new URL("../public/manual/", import.meta.url);

/** Sidebar order; every other .md page is appended alphabetically. */
const NAV_ORDER = [
  "index.md",
  "getting-started.md",
  "viewing.md",
  "validation.md",
  "inspect.md",
  "topology.md",
  "export.md",
  "conventions.md",
  "rules.md",
  "metamodel.md",
  "symbols.md",
];

const CSS = `
:root { color-scheme: light dark; --bg:#f8fafc; --fg:#0f172a; --muted:#64748b; --line:#e2e8f0; --accent:#2563eb; --side:#eef2f7; }
@media (prefers-color-scheme: dark) { :root { --bg:#0f172a; --fg:#e2e8f0; --muted:#94a3b8; --line:#1e293b; --accent:#60a5fa; --side:#111c31; } }
* { box-sizing: border-box; }
body { margin:0; display:flex; min-height:100vh; background:var(--bg); color:var(--fg); font:15px/1.6 system-ui, sans-serif; }
nav { width:230px; flex-shrink:0; padding:1.2rem 1rem; background:var(--side); border-right:1px solid var(--line); position:sticky; top:0; height:100vh; overflow:auto; }
nav h2 { font-size:.95rem; margin:0 0 .8rem; }
nav a { display:block; padding:.28rem .5rem; border-radius:6px; color:var(--fg); text-decoration:none; font-size:.88rem; }
nav a:hover { background:var(--line); }
nav a.active { background:var(--accent); color:#fff; }
main { flex:1; min-width:0; padding:2rem 2.5rem 4rem; max-width:1000px; }
main img { max-width:100%; border:1px solid var(--line); border-radius:8px; }
main table { border-collapse:collapse; display:block; overflow-x:auto; max-width:100%; }
main th, main td { border:1px solid var(--line); padding:.35rem .6rem; text-align:left; vertical-align:top; font-size:.86rem; }
main th { background:var(--side); }
main code { background:var(--side); padding:.1rem .3rem; border-radius:4px; font-size:.85em; }
main h1 { margin-top:0; }
main a { color:var(--accent); }
td img { max-width:130px; max-height:60px; border:none; background:#fff; }
.footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); color:var(--muted); font-size:.8rem; }
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
  main { padding:4.3rem 1.1rem 3rem; }
}
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const dir of ["images", "symbols", "signals"]) {
  try {
    cpSync(new URL(`${dir}/`, SRC), new URL(`${dir}/`, OUT), { recursive: true });
  } catch {
    // Optional asset folder not generated yet — pages still build.
  }
}

const pages = [
  ...NAV_ORDER,
  ...readdirSync(SRC)
    .filter((f) => f.endsWith(".md") && !NAV_ORDER.includes(f))
    .sort(),
];
const titles = new Map(
  pages.map((page) => {
    const text = readFileSync(new URL(page, SRC), "utf-8");
    return [page, /^#\s+(.+)$/m.exec(text)?.[1] ?? page.replace(".md", "")];
  }),
);

for (const page of pages) {
  const text = readFileSync(new URL(page, SRC), "utf-8");
  const html = marked
    .parse(text, { gfm: true })
    .replaceAll(/href="([\w-]+)\.md"/g, 'href="$1.html"');
  const nav = pages
    .map((p) => {
      const href = p.replace(".md", ".html");
      const active = p === page ? ' class="active"' : "";
      return `<a href="${href}"${active}>${titles.get(p)}</a>`;
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
<main>${html}<div class="footer">Generated from documentation/ — see scripts/buildDocsSite.mjs.</div></main></body></html>
`,
  );
}
console.log(`manual: ${pages.length} pages → public/manual/`);
