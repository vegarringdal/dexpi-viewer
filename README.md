# DEXPI Viewer

> Experiment by Vegar Ringdal using AI to speed up
> development/testing/refactoring. This project also gives me a chance to
> test a UI library created for the [tredespace.com](https://tredespace.com)
> application.

**Live app: <https://vegarringdal.github.io/dexpi-viewer/>** ·
**Manual: <https://vegarringdal.github.io/dexpi-viewer/manual/>**
(also `?docs` on the app URL, ribbon Help → Docs, or F1) ·
Preview of the `dev` branch: <https://vegarringdal.github.io/dexpi-viewer/preview/>

A fast viewer and checker for **DEXPI 2.0 XML** P&ID files. Everything runs
in the browser — files never leave your machine. React workbench UI
(dockable panels + ribbon, light/dark theme) around a Skia **CanvasKit**
drawing surface.

## Features

- **Faithful rendering** of DEXPI 2.0 diagrams, including symbols and label
  templates from a **DISC profile** (bundled releases or your own
  `DiscProfile.xml`) — [Viewing](documentation/viewing.md)
- **Explorer & Properties** — searchable plant hierarchy and every value of
  the selected object — [Explorer](documentation/explorer.md)
- **Validation** against the DEXPI information model, the DISC profile and
  connectivity rules, with filters and severity overrides —
  [Validation](documentation/validation.md), [rule reference](documentation/rules.md)
- **Inspect** — a diagram of one object and everything it references —
  [Inspect](documentation/inspect.md)
- **XML trees** — the file's own Conceptual Model and Diagram structure —
  [XML trees](documentation/xml-trees.md)
- **Topology & tracing** — semantic graph and upstream/downstream traces —
  [Topology](documentation/topology.md)
- **Highlight** — colour the drawing by classification or custom filters,
  inspect label templates and node positions —
  [Highlight](documentation/highlight.md)
- **Verification underlay** — align an official PDF/SVG/image under the
  drawing to spot differences — [Viewing](documentation/viewing.md)
- **Exports** — PDF and SVG (as authored or as viewed) and validation
  reports as Excel or CSV — [Exports](documentation/export.md)
- **Settings & shortcuts** — rendering options, profile loading,
  rebindable keymap — [Settings](documentation/settings.md)

Start with the [manual index](documentation/index.md) or
[Getting started](documentation/getting-started.md).

## Getting started

```bash
npm install       # @tredespace/ui installs from external/*.tgz
npm run dev       # Vite dev server on http://localhost:5173
```

| Script | What |
| ------ | ---- |
| `npm run dev` | Dev server |
| `npm run build` | Manual site + typecheck + production build to `dist/` |
| `npm run typecheck` | `tsc -b` (app) + test project |
| `npm test` | Vitest |
| `npm run lint` / `lint:fix` | Biome check (fix) |
| `npm run check` | Typecheck + lint |
| `npm run generate:docs` | Regenerate the manual's derived pages (rules, metamodel, symbols) |
| `npm run docs:site` | Build the manual as static HTML into `public/manual/` |
| `npm run generate:metamodel` | Regenerate the DEXPI metamodel tables from the XMI |
| `npm run generate:notices` | Regenerate third-party notices (after dependency changes) |

Manual screenshots come from driving the real app: start
`npm run dev -- --port 5199 --strictPort`, then run
`node scripts/generateDocScreenshots.mjs` (all shots) or pass shot names to
re-take a few (needs Playwright, not a project dependency — see the script
header).

Deployment is CI: `main` publishes to the live app, `dev` to the preview.

## Stack

- **React** + **Vite** + **TypeScript** (strict) + **Biome**
- **@tredespace/ui** — widgets, ribbon, dockable panel shell, hotkeys
  (installed from the tarball in `external/`; usage guide:
  `external/treDeSpaceUI.md`)
- **Tailwind CSS v4** — author dark-theme utilities only; the library
  remaps the `--color-*` variables under `html[data-theme="light"]`
- **canvaskit-wasm** — Skia; the drawing is one WebGL canvas, not DOM

## Layout

```
src/
├─ components/  React shell: ribbon, panels, settings, hotkeys, exports
├─ state/       shared createStore domains (*.state.ts + *.actions.ts)
└─ lib/
   ├─ dexpi/     DEXPI parser, document model, profiles, validation (pure TS)
   ├─ canvas/    CanvasKit surface, viewport, scene drawing
   ├─ graph/     topology + inspect graph models and layouts
   ├─ assets/    bundled fonts (+ licenses)
   └─ generated/ metamodel tables, third-party notices
documentation/  user manual (markdown; built into the app's manual/)
public/         bundled example drawing and DISC profile catalogues
scripts/        docs/metamodel/notices generators, screenshot driver
refrences/      DEXPI specs, XSD, examples, DISC packs (read-only)
external/       @tredespace/ui tarball + docs
```

More in [DESIGN.md](DESIGN.md) (architecture and rendering rules),
[OPEN_ITEMS.md](OPEN_ITEMS.md) (todos and maybes),
[CHANGELOG.md](CHANGELOG.md), and [CLAUDE.md](CLAUDE.md) (project rules).

## License

This project is licensed under the GNU Affero General Public License v3.0
(AGPL-3.0-only). If you modify it and distribute it — or run a modified
version as a network service — you must make your modified source available
under the same license. See [LICENSE](LICENSE) for the full text.
