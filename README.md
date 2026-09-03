# DEXPI Viewer

> Experiment by Vegar Ringdal using AI to speed up
> development/testing/refactoring. This project also gives me a chance to
> test a UI library created for the [tredespace.com](https://tredespace.com)
> application.

**Live app: <https://vegarringdal.github.io/dexpi-viewer/>** ·
**Manual: <https://vegarringdal.github.io/dexpi-viewer/manual/>**
(also `?docs` on the app URL, ribbon Help → Docs, or F1)

A fast viewer for **DEXPI 2.0 XML** P&ID files: React 19 workbench UI
(dockable panels + ribbon, light/dark theme) around a Skia
**CanvasKit** drawing surface.

See [DESIGN.md](DESIGN.md) for architecture, milestones, and the
decisions log. Project rules live in [CLAUDE.md](CLAUDE.md).
The **user manual** lives in [documentation/](documentation/index.md)
(guide + generated rule reference, information-model summary, and a
DiscProfile symbol catalogue) and ships with the app as `manual/` —
ribbon → Help → Docs. Regenerate derived content with
`npm run generate:docs`; the build converts it to the static site.

## Status

M0–M4 are done: the app **opens, renders, and inspects DEXPI 2.0 XML
files**. The unit-tested parser turns the XML object graph into a typed
scene graph (primitives, shape-catalogue instancing, labels, connectors)
plus a conceptual plant hierarchy; the CanvasKit stage renders it under
one mm→px matrix with pan/zoom, fit-on-load, min-px stroke clamp,
theme-adaptive colors, and Liberation Sans text. Click or hover anything
in the drawing to select/highlight it (hit-testing incl. transformed
symbol instances); the object tree (searchable) and properties panel
(formatted physical quantities) stay in sync, with zoom-to-object.
Verified headless against the Tennessee Eastman example and the
C01 DEXPI reference P&ID (`refrences/reference_pid.xml`), whose layout
matches the official rendering — including instrument balloons (ellipse
arcs), node-position-stitched connector lines, and the title block.

**M5 (connectivity) and M6 (export, validation, DISC profiles) are done
too**: trace upstream (amber) / downstream (green) from any selection;
export the drawing as spec-mapped **SVG** or vector **PDF** (embedded
metric-compatible fonts) and the validation findings as **CSV**, each row
carrying the source XML line number and an XPath locator of the offending
element itself — the `<References>`/`<Data>` element a finding is about, not
just the object that owns it — alongside the rule/severity/message;
twenty-three validation rules in five categories — Schema (SCH), Graphics
(GFX), Connectivity (CON, incl. unconnected nozzles and nominal-diameter
mismatches at connection points), **Model (MDL)** — every object checked
against the DEXPI information model generated from the official XMI:
unknown classes/properties, missing required properties, illegal enum
literals, reference cardinality and target-class rules (profile
extension classes chased through their declared supertypes),
version-aware via the document's Import URIs — and Meta data (META) —
feed the Validation
panel (count in the tab, severity + category filters, click to jump to
the object, per-rule severity overrides incl. Ignore, persisted); and a
**DISC profile** (DiscProfile.xml, DEXPI 2.1) can be loaded to resolve
Profile/SymbolUsage references with per-instance variant conditions.
Clicking the drawing reveals the object in the searchable tree
(expand/collapse-all included).

**M7 polish is in**: the panel layout persists across sessions (ribbon
Reset restores the default), a **minimap** (bottom-left, toggleable)
shows the whole drawing with a live viewport rectangle and click/drag
navigation, the View section has Fit / zoom in / out / 100% with
hotkeys, and `FillStyle.Hatch` renders as real 45° hatching.
Selection is **multi-capable**: ctrl/cmd-click toggles and shift-click
range-selects in the tree (ctrl-click works on the canvas too), all
selected objects highlight in the drawing, hovering any object row in
a panel highlights it on the canvas, and right-clicking tree rows opens
copy options (label / type / label+type+id, one row per object).

A **verification underlay** (Drawing-panel toolbar) loads a reference
image, SVG, or PDF stretched onto the diagram extent — the official
DISC renderings align exactly — with opacity, under/over placement and
mm nudges (0.1mm steps), a "hide white" blend that drops the
reference's paper background, and an ink tint (color picker — e.g.
red reference under black drawing) for spotting rendering differences
in place.

An **Inspect** panel (ribbon toggle) draws a UML-style instance diagram
of the selected object for debugging: its full raw data in a center
card, and every one-hop relation — references, referenced-by,
containment, DISC-profile instance stubs — as neighbor cards with edges
labeled by the actual property names; clicking a neighbor re-centers on
it.

Two finishing pieces: **labels resolve their TextTemplates** — text
comes from live attribute values (with proper unit symbols: barg, °C,
m³/h), beating stale literal snapshots; resolution is all-or-nothing,
so a template with any missing, unsupported or empty fragment keeps the
label's original XML text instead of a partial value, and sibling label
parts that share one ambiguous template keep their distinct literals
instead of repeating one resolved value — and the scene body is cached
as a **Skia picture**, so panning, hovering and selection replay a
recording (~56 fps sustained pan even under software rendering).

Heat-traced piping (`HeatTracingType`) draws a dashed overlay laterally
offset from the pipe centerline per DISC Profile
`LineStroke.LateralOffset` semantics (positive = right of the drawing
direction), with miter-joined bends; a loaded DiscProfile's heat-trace
`LineStroke` (color, dash, width, rounding, dash offset) overrides the
built-in defaults. Text values with line breaks render as proper
multiline blocks — per-line horizontal alignment, block-level vertical
alignment, shared 1.4×size line spacing — identically on canvas and in
the SVG/PDF exports.

**M8 adds a Topology graph panel** (ribbon Panels → Topology): the
engineering data as a semantic network — plant objects as nodes
(connection hardware collapsed into its owner, category-colored
borders) with **flow**, **containment**, and **reference** edges,
laid out left→right along the flow direction. Nozzles, chambers,
piping nodes and ports can optionally be shown as mini nodes on the
flow path instead of being collapsed; a vertical-spacing stepper
spreads dense layouts, and the selection's direct neighbours can be
tinted by relation (amber upstream, green downstream, violet signal). Neighborhood mode graphs the
current selection with an adjustable hop depth; Document mode graphs
the whole file (soft-capped with a coverage note). Nodes sync with the
global selection both ways, double-click zooms the drawing to the
object, and the view pans/zooms like the drawing. The tree panel is
now titled **Explorer**.

**M9 adds a Highlight panel** (ribbon Panels → Highlight): tint the
drawing by classification — heat-traced runs, signal/instrument
lines, or piping service (fluid code / piping class, with ancestor
inheritance) — each value in its own color with a legend of counts
and per-value visibility toggles.

All milestones M0–M11 are complete; the open items are niche
(Proteus-era edge tolerances, profile LabelTemplate overlays, culling
for truly huge files) and tracked in DESIGN.md.

**Two raw-XML browsers** sit alongside the Explorer (ribbon Panels →
Conceptual Model / Diagram Tree): the **Conceptual Model Tree** and
**Diagram Tree** panels mirror the file's `ConceptualModel`/`Diagram`
XML containment exactly — one expandable group row per `<Components
property=…>` bucket, one row per object underneath — instead of the
Explorer's flattened hierarchy. Each row shows the bare type in the
main column and the resolved value/tag (TagName, ItemTag, SegmentNumber,
…) in a drag-resizable side column; the tree/Data split below it is
drag-resizable too, and the tree itself is virtualized (only rows near
the viewport mount) so a large, mostly-expanded subtree stays smooth to
scroll — Explorer shares the same virtualized tree component. Both
panels start collapsed and expand to reveal the current selection; the
selected row's raw Data table (aggregate values like Stroke/Color
render as an indented block, not one flattened line) and Inverse
References (grouped by `ReferencingType.property`, e.g.
`AttributeRepresentation.Object [2]`) render below the tree. A Diagram
Tree row cross-links to its real conceptual object via its own
`Represents`/`Object` reference, so selecting either tree, the drawing,
or the Explorer keeps all of them in sync.

## Getting started

```bash
npm install       # @tredespace/ui installs from external/*.tgz
npm run dev       # Vite dev server on http://localhost:5173
```

| Script | What |
| ------ | ---- |
| `npm run dev` | dev server |
| `npm run build` | typecheck + production build to `docs/` (deployed by GitHub Pages) |
| `npm run typecheck` | `tsc -b` (app) + test project |
| `npm test` | Vitest (parser units, jsdom) |
| `npm run lint` / `lint:fix` | Biome check (fix) |
| `npm run check` | typecheck + lint |

## Stack

- **React 19** + **Vite 7** + **TypeScript** (strict) + **Biome**
- **@tredespace/ui** — widgets, ribbon, dockable panel shell, hotkeys
  (installed from the tarball in `external/`; usage guide:
  `external/treDeSpaceUI.md`)
- **Tailwind CSS v4** — theming rule: author dark-theme utilities only;
  the library remaps the `--color-*` variables under
  `html[data-theme="light"]`
- **canvaskit-wasm** — Skia; the drawing is one WebGL canvas, not DOM

## Layout

```
src/
├─ components/  React shell: panels, ribbon, settings, hotkeys
├─ state/       createStore domains: viewer, selection, trace, theme,
│               rendering, ui (*.state.ts + *.actions.ts — see CLAUDE.md)
└─ lib/
   ├─ dexpi/     DEXPI 2.0 XML parser + document model (pure TS, unit-tested)
   ├─ canvas/    CanvasKit surface, viewport (pan/zoom), scene drawing
   ├─ generated/ third-party notices (npm run generate:notices)
   └─ …          createStore, Result<T>, download helper
refrences/    DEXPI specs, XSD, examples, prior-art viewer (read-only)
external/     @tredespace/ui tarball + docs
```

## Keyboard shortcuts

Placeholder defaults: **ALT then a 4-digit number** (first digit =
ribbon section: 1 File, 2 View, 9 App). Rebind anything under
Settings → Shortcuts; every ribbon tooltip shows the live combo.

## License

This project is licensed under the GNU Affero General Public License v3.0
(AGPL-3.0-only). If you modify it and distribute it — or run a modified
version as a network service — you must make your modified source available
under the same license. See [LICENSE](LICENSE) for the full text.
