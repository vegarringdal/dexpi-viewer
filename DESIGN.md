# DEXPI Viewer — Design

A fast, polished DEXPI P&ID viewer. Successor in spirit to
[ToniaPedersen/DEXPIViewer](https://github.com/ToniaPedersen/DEXPIViewer)
(cloned for study under `refrences/DEXPIViewer`), but with a
GPU-accelerated Skia canvas instead of a React-managed SVG tree, strict
TypeScript instead of plain JS, and a real panel/ribbon workbench UI.

## Goals

- Open DEXPI 2.0 XML files (the new serialization introduced by DEXPI 2.0;
  see `refrences/DEXPI_Specification_2.0.pdf` and
  `refrences/DEXPI_XML_Schema.xsd`) and render the P&ID faithfully.
  DEXPI 2.0 and above only.
- Stay fluid on large drawings: rendering is a single Skia CanvasKit
  surface, not thousands of DOM nodes.
- Workbench UX: dockable panels, ribbon, light/dark theme, hotkeys —
  built from `@tredespace/ui` (tarball in `external/`).

## Non-goals

- Proteus XML 4.x (DEXPI 1.2–1.4 era). We target DEXPI 2.0+ only; the
  Proteus example under `refrences/examples/proteus-1.3` stays as
  background reference material, nothing more.
- Editing/authoring DEXPI files. This is a viewer.
- Full validation-rule engine parity with the reference viewer (that is a
  late milestone, after viewing is excellent).

## Tech stack

| Concern        | Choice                                                        |
| -------------- | ------------------------------------------------------------- |
| Build          | Vite 7, TypeScript (strict), Biome (lint + format)             |
| UI             | React 19, `@tredespace/ui` (widgets, ribbon, dockable, hotkeys) |
| Styling        | Tailwind CSS v4 (`@tailwindcss/vite`); dark default, `data-theme="light"` remap |
| Drawing        | Skia CanvasKit (`canvaskit-wasm`), WebGL surface               |
| Parsing        | Browser `DOMParser`, framework-agnostic core (usable from CLI/tests later) |
| Tests          | Vitest for parser/geometry units (added in M2)                 |

## Architecture

Three layers with strict one-way dependencies. React never touches Skia
objects directly; the parser knows nothing about React or Skia.

```
src/
├─ components/  React shell. DockView layout, ribbon, panels
│               (drawing, topology tree, properties, issues), theme,
│               file open. Components render UI; logic lives in hooks.
├─ state/       Small shared store (subscribe/snapshot) connecting the
│               layers: loaded document, selection, viewport, theme.
└─ lib/         Non-React code + shared utilities:
   ├─ dexpi/     Parser + model. DEXPI XML → typed document model:
   │             object tree, graphic primitives, labels, connectivity.
   │             Pure TS, no DOM rendering, no React, no Skia.
   ├─ canvas/    CanvasKit runtime. Loads the wasm, owns the Surface,
   │             renders a SceneGraph built from the dexpi model,
   │             viewport (pan/zoom), hit-testing, selection overlay.
   ├─ assets/    bundled fonts (+ their license texts)
   └─ generated/ third-party notices (npm run generate:notices)
```

### The document model (`src/lib/dexpi/`)

DEXPI 2.0 XML is a generic object graph: `<Object type="Pkg/Class">` with
`<Data property>` values and `<Components property>` children, plus
`<Association>` links. Graphics live in `Core/Diagram.*` classes:
`PolyLine`, `Polygon`, `Rectangle`, `Circle`, `Ellipse`, `EllipseArc`,
`Shape` (catalogue symbol) + `ShapeUsage` (placed instance with
transform), `Text`/`TextTemplate`, `Label`, `ConnectorLine`, node
positions. The parser produces:

- `DexpiDocument` — metadata, the raw object index (id → object).
- `SceneGraph` — flat, render-ready primitive list in drawing
  coordinates (mm), each primitive back-referencing its owning object id.
- `PlantModel` — the engineering hierarchy (equipment, piping network
  segments, instrumentation) for the tree/properties/connectivity panels.

Parsing follows the spec, not guesses — consult the XSD and the spec PDF
in `refrences/` when in doubt.

### Rendering (`src/lib/canvas/`)

- One `CanvasStage` React component owns a `<canvas>`; everything else is
  imperative CanvasKit code driven by a render loop that only redraws on
  invalidation (dirty flag), not per frame.
- Viewport = 2D affine (pan x/y, uniform zoom). Drawing coords are mm,
  y-down per DEXPI 2.0 (SVG-like) — no axis flip anywhere.
- Stroke widths scale with zoom but are clamped to a minimum device px so
  thin lines stay visible (equivalent of `non-scaling-stroke` where the
  spec calls for it).
- Hit-testing walks the scene graph (point-to-segment distance with a
  px-radius tolerance), not Skia picking.
- Text via CanvasKit `Paragraph` with embedded fonts (Liberation Sans as
  the default; DEXPI files reference fonts we may not have — map to it).

### UI shell (`src/components/`)

- `DockView` root layout: ribbon in a locked top node; center drawing
  panel; left Explorer (object tree) panel; right properties panel; bottom issues
  panel (collapsed by default). The Topology graph panel (semantic
  network view, M8) is not in the default layout — it opens via its
  ribbon toggle, tabbed with the drawing.
- Ribbon sections: File (open, examples, export), View (fit, zoom,
  theme), Select/Trace (later milestones).
- Theme: dark is library default; toggle sets `data-theme="light"` on
  `<html>`. The canvas reads theme tokens so paper/ink colors match.
- Hotkeys through `@tredespace/ui/hotkeys`.

## Reference material

| Path | What |
| ---- | ---- |
| `refrences/DEXPI_Specification_2.0.pdf` | DEXPI 2.0 spec (data model + DEXPI XML serialization) |
| `refrences/DEXPI_XML_Schema.xsd` | DEXPI 2.0 XML schema |
| `refrences/DEXPI_PID_Specification_1.4.pdf` | P&ID 1.4 spec (Proteus 4.x serialization) |
| `refrences/DEXPI-Process-1.0-Information-Model.pdf` | Process model spec |
| `refrences/dexpi-2.0-supporting-materials.zip` | UML model (XMI/EA) for the 2.0 information model |
| `refrences/examples/dexpi-2.0/` | DEXPI 2.0 XML example (Tennessee Eastman) |
| `refrences/reference_pid.xml` | C01 DEXPI reference P&ID as DEXPI 2.0 XML (Plant model) — richest fixture: templates, arcs, node-position connectors, typed labels |
| `refrences/examples/proteus-1.3/C01/` | Proteus 1.3 reference P&ID (XML + official SVG) — background reference only, out of scope |
| `refrences/DEXPIViewer/` | The prior-art viewer (JS + SVG); its `src/dexpiParser.js` documents the 2.0 XML shapes in practice |
| `refrences/spec-model-Core-Diagram.py` | The spec's own Core.Diagram model source (from gitlab dexpi/Specification `src/model/Core/Diagram/Diagram.py`) — authoritative for graphics semantics: SVG mapping, DashStyle table, FillStyle, EllipseArc geometry |
| `refrences/discdexpi-disc-profile/` | DISC Profile spec from [ToniaPedersen/DISCDEXPI](https://github.com/ToniaPedersen/DISCDEXPI): 0.4/0.5 zips (html + xml) + schema; 0.5 XML extracted (`DISC-Profile-0.5-xml/xml/` — Builtin/Core/Plant/DiscProfile model XML incl. FL0/FL10 variants). The 97 MB html extraction is deliberately NOT committed — unzip on demand |
| `refrences/discdexpi-2026pack/` | [ToniaPedersen/DISCDEXPI_2026Pack](https://github.com/ToniaPedersen/DISCDEXPI_2026Pack): DISC Profile **0.6.x** (xml + html.zip + schema; changes doc 0.6.0→0.6.3 — newer than the 0.5 copy above), PID Validation Method (docx/drawio/pptx), and `Blueprint/DISC_EXAMPLE-14/` — real DEXPI XML files WITH official SVG renderings (verification fixtures like C01). The 99 MB html extraction is deliberately NOT committed — unzip on demand |
| `external/tredespace-ui-0.0.56.tgz` | UI library (`@tredespace/ui`); README inside covers setup |
| `external/tredespace-client.ts` | tredespace embed API reference (not used yet) |

## Milestones

Keep this list current: check items off as they land, split milestones
that grow, and record scope changes here.

### M0 — Foundation ✅

- [x] Download specs, schema, examples, prior-art viewer → `refrences/`
- [x] Download `@tredespace/ui` tarball → `external/`
- [x] Vite + React 19 + TS strict + Tailwind v4 + Biome scaffold
- [x] `@tredespace/ui` installed from tarball, styles wired
- [x] CanvasKit loads, draws placeholder scene; build/typecheck/lint green

### M1 — Workbench shell ✅ (fit/zoom actions land with M3)

- [x] Dock layout (director's default, 2026-08-19): ribbon (locked,
      tab-less top node); left node tabs Topology | Validation; drawing
      center; right column tabs Properties | Connections | Settings
      over Minimap. Validation auto-focuses when a loaded document has
      findings.
- [x] Ribbon "Panels" section: mini toggle buttons (Topology, Properties,
      Settings) with selected-state synced to panel visibility
- [x] Light/dark theme toggle, canvas colors follow theme
- [x] File open (picker + drag-and-drop onto window), bundled example
- [x] Hotkeys registry wired (open, example, fit, zoom in/out/100%,
      theme, settings) with
      placeholder ALT + 4-digit defaults (see decisions log)
- [x] Settings as a dockable panel (VerticalTabs; opens next to
      Properties, dock/float/close like any panel): Rendering (min line
      width, width scale, grid) and Shortcuts (record/rebind, conflicts,
      reset) — was a modal dialog first; director wanted it viewable
      alongside everything else
- [x] Status bar: file name + size, zoom %, cursor mm position
      (object counts arrive with the M2 parser)
- [x] Verified headless (Playwright): both themes, dialog, example
      load, hotkey firing — no console errors

### M2 — DEXPI 2.0 parser → document model ✅ (hierarchy → M4)

- [x] Vitest set up (jsdom); fixtures: synthetic + Tennessee Eastman
- [x] Generic object-graph reader (Object/Data/Components/References)
- [x] Graphics: PolyLine, ConnectorLine, Polygon, Rectangle, Circle,
      Ellipse, EllipseArc, Text — spec-correct fills (Solid = stroke
      color) and DashStyle patterns
- [x] Shape catalogue + ShapeUsage/SymbolUsage instancing
      (position/rotation/scale/mirror), Represents tagging, roles
      (symbol/label/connector)
- [x] Parse errors as `Result` values shown in the error dialog
- [x] Plant hierarchy extraction (landed with M4's tree panel)
- [x] TextTemplate/AttributeRepresentation label resolution: labels
      resolve from live attribute values at parse time (own object,
      then 2-hop related-object search), with a unit-symbol table
      honouring quantity classes (PressureGaugeUnit.Bar → "barg",
      DegreeCelsius → "°C"); resolved text beats a stale literal
      snapshot (unit-tested), literal kept when resolution is empty

### M3 — Skia rendering (core done with M2; polish items open)

- [x] SceneGraph → CanvasKit draw pass under one mm→px matrix
      (strokes, fills, dashes, shape instancing, y-up flip)
- [x] Pan (drag), zoom-to-cursor (wheel), fit-to-drawing on load
- [x] Min-px stroke clamp + width scale (Settings → Rendering)
- [x] Text via metric-compatible bundled faces — Calibri→Carlito,
      Verdana/Tahoma→DejaVu Sans, else Liberation Sans (Arial-metric) —
      so labels fit their boxes/table cells; subpixel + linear metrics +
      no hinting for clean advances at mm-scale font sizes
- [x] Dark theme adapts document colors (near-black→ink, white→paper)
- [x] Tennessee Eastman verified headless in both themes, zoomed detail
      checked, zero console errors
- [x] EllipseArc verified against `refrences/reference_pid.xml` (instrument
      balloons, tank heads) — positive-sweep wrap per spec
- [x] ConnectorLine endpoints stitched from *NodePosition references (many
      connectors carry no inner points at all)
- [x] Combined TextAlignment values (LeftBottom, CenterCenter, …)
- [x] Fit/zoom-preset ribbon buttons + hotkeys (View section; one-shot
      view commands through the viewer store)
- [x] FillStyle.Hatch: real 45° stroke-colored hatching on canvas
      (clip + line family, spacing 10× stroke width per the spec
      example ratio) and as SVG patterns in the exporter; PDF renders
      hatch as 25%-opacity solid (pdf-lib has no pattern fills) —
      no fixture uses Hatch yet, so visually unverified
- [ ] Performance pass on multi-MB drawings (measure fps, cull, cache)

### M4 — Inspect: tree, selection, properties ✅

- [x] Plant model: conceptual hierarchy walk, Core value objects
      (QualifiedValue/quantities/strings) folded into attributes,
      labels from TagName/Identifier/Name/Description, References
      captured as "→ property" attributes (M5 groundwork)
- [x] Object tree panel (FileTree widget): hierarchy, search filter
      with ancestor-preserving pruning, ports hidden from browsing
- [x] Hit-testing (unit-tested): all primitives + transformed shape
      usages; hover highlight, click select (with drag/click slop),
      canvas ↔ tree ↔ properties sync via the selection store
- [x] Selection/hover render pass: accent redraw on top, fills dimmed
- [x] Properties panel: label, type, id, formatted attributes
      (PhysicalQuantity "49.37 MetreCubedPerHour", MultiLanguageString…)
- [x] Zoom-to-object from tree (zoom capped at 400%)
- [x] Canvas click reveals the object in the tree (expand + scroll);
      expand-all/collapse-all buttons; connection hardware (ports,
      nodes, nozzles, chambers) hidden from the tree so equipment rows
      stay selectable leaves
- [x] Custom PlantTree replaces the FileTree widget: clean name first
      (naming attribute or the raw id — no type prefix), bare type
      right-aligned on EVERY row including groups, controlled collapse
      state (no remount tricks), group rows selectable. Label priority:
      TagName, PositionNumber, InstrumentationLoopFunctionNumber,
      ActuatingSystemNumber, SubTagName, Identifier, Name, Description,
      raw id (never shortened — display truncation is the UI's job).
      The type note hides when the name already spells it out; rows
      carry hover tooltips with the full name + type.
- [x] Properties panel enriched to Details-level: Data grid,
      References / Referenced-by (reverse index in the plant model),
      Parent component, Sub-components — all as clickable chips that
      navigate the selection
- [x] Connections panel (tab next to Properties): direct upstream /
      downstream flow neighbours (merged across the object's own
      connection points) and the ports/nozzles/chambers themselves,
      clickable
- [x] Settings → Rendering: "Spec unit names" toggle — units as the
      spec's enumeration literals (Kilowatt, DegreeCelsius) instead of
      symbols (kW, °C); re-parses the document since formatting bakes
      in at parse time
- [x] Settings → About: name, version (injected from package.json via
      Vite define), blurb, DEXPI spec + prior-art references, license
      statement with a full-text dialog, and a Third-party notices
      dialog (filter, grouped rows, full license texts). Notices are
      generated by `npm run generate:notices`
      (scripts/generateNotices.mjs) from the runtime dependency tree +
      the bundled fonts — rerun it after changing dependencies. Font
      license texts live next to the .ttf files in src/lib/assets/fonts/.
      On the very first visit in a browser the app opens with the
      About page focused (localStorage marker `dexpi.visited`).
- **2026-08-19** Deployment: GitHub Pages serves the committed `docs/`
  folder — `npm run build` outputs there with `base: "./"` (all asset
  URLs relative, required under the `/dexpi-viewer/` subpath). Verified
  by serving the build from a subpath. Live app:
  https://vegarringdal.github.io/dexpi-viewer/ — remember to commit
  `docs/` after building.
- **2026-08-20** `<Attr>Representation` twins (23 in the 2.0 model, e.g.
  FailAction→FailActionRepresentation="FM") hold the readable drawing
  code; the spec says graphics should reference them. Drawing-text
  resolution (TextTemplate fragments + profile label placeholders)
  prefers the Representation twin when the base attribute is named
  (`lookupDisplayAttribute` in resolveTemplates.ts); panels keep
  showing the raw data unchanged.
- **2026-08-20** Director's rendering rules (from real DEXPI+DiscProfile
  data): (1) never render tag text twice — explicit Core/Diagram.Label
  text is authoritative; property-/profile-derived tags are fallback
  only; profile catalogue objects are never plant objects. (2)
  SymbolUsage Rotation/IsMirrored transform the symbol geometry only —
  explicit text keeps its own position/rotation. (3) profile
  LabelTemplate output renders ONLY when the object has no explicit
  diagram label (enforced in buildSceneGraph); template line breaks are
  real formatting — one text per line (LINE_SPACING 1.4×size). (4)
  heat tracing is MAIN-file data: HeatTracingType(+Representation) on
  piping objects; classified runs get a dashed overlay beside the
  untouched base pipe (see the 2026-08-21 lateral-offset entry);
  HeatTracingBreak objects are logical property breaks, never drawn.
  2026-08-20 addendum: heat-traced INLINE components (valves,
  fittings — symbol placements) get a dashed side-line too, per the
  prior-art convention: below the symbol's world bounds when placed
  horizontally, to its right when rotated ~90°/270°
  (buildHeatTraceSymbolOverlays). PIF outline-following overlays
  (prior art's third category) remain open. Eligibility is
  spec-bound: the 2.0 model defines HeatTracingType only on
  PipingNetworkSystem/Segment, PipingComponent and
  OfflineMeasuringElement — the attribute on a signal function
  (logical, never physically traced) is ignored as a modelling
  error (isHeatTraceEligible). The same predicate also filters
  INHERITED descendants (2026-08-21 fix): a logical signal nested
  below a heat-traced segment never joins the traced set, while
  physical children (pipes in the segment) still inherit the
  classification.
- **2026-08-21** Heat-trace lateral offset (DISC Profile 0.5,
  `Profile/LineStroke.LateralOffset`): the dashed overlay is a parallel
  polyline offset perpendicular to the drawing direction — positive mm =
  visual right of travel (normal (−dy,dx) in the y-down drawing space),
  negative = left.
  Whole segments are offset and joined with miter intersections at bends
  (clamped to 4×|offset|; 180° turn-backs degrade to the plain vertex
  offset), never per-vertex. Style source: a loaded DiscProfile's
  `Profile/LineStroke` with non-zero LateralOffset wins (color, DashArray,
  Width, LineRounding → stroke cap/join, Offset → dash phase); with no
  profile stroke the documented viewer defaults apply — dash 2.4/1.6 mm,
  orange 217/108/24, pipe's width, and
  `DEFAULT_HEAT_TRACE_LATERAL_OFFSET_MM = 1.5` (deliberately non-zero and
  awaiting director sign-off; src/lib/dexpi/heatTracing.ts). The spec's
  container (`Profile/AggregatedStroke`) has no published instance
  examples yet, so LineStrokes are found regardless of nesting. `Stroke`
  gained optional `dashOffset`/`rounding`, honored by canvas, SVG and PDF
  renderers. Spec source: DISCDEXPI repo (ToniaPedersen), DISC Profile
  0.5 LineStroke page. Also: `NoHeatTracingSystem` (the literal real DISC
  files use) now counts as untraced alongside `None`.
- **2026-08-21** Multiline text: ordinary `Core/Diagram.Text` values with
  line breaks were passed verbatim to single-line draw calls (missing-glyph
  box, alignment measured over the break char). All three renderers now
  share `src/lib/dexpi/textLayout.ts`: `layoutTextLines` splits on \r?\n
  and returns per-line baseline offsets relative to the single-line
  baseline (Top grows down from the anchor, Bottom keeps the last line and
  grows up, Center spreads symmetrically; advance TEXT_LINE_SPACING =
  1.4×size, same constant the profile LabelTemplate splitter uses);
  `baselineOffsetMm` centralizes the 0.8/0.3/0 vertical factors. Each line
  measures and h-aligns independently; the block rotates as one unit since
  lines draw inside the rotated frame (canvas), inside one `<text>` as
  `<tspan x="0">` per line (SVG; single-line output byte-identical to
  before), or with per-line anchor offsets rotated around the shared
  anchor (PDF). Hit-test/bounds heuristics use the longest line and block
  extent; single-line values keep exactly their previous placement, hit
  band and SVG markup. Fixed alongside: the drawing space is **y-down**
  (verified in drawDexpiScene/exportSvg) — two stale "y-up" comments
  corrected, and the heat-trace lateral-offset normal flipped to (−dy,dx)
  so positive LateralOffset is the *visual* right of the drawing
  direction as the DISC spec intends.
- **2026-08-21** Director's label rule — TextTemplate resolution is
  **all-or-nothing**: the label's XML `Data property="Text"` value is the
  real display value; a template may replace it only when EVERY attribute
  fragment resolves to a non-empty value. Any fragment that is missing
  its target, resolves empty/whitespace, or has an unsupported fragment
  kind (parseTemplateFragments drops the whole template, keeping the
  snapshot authoritative) leaves the original Text untouched — never a
  partial concatenation of the fragments that happened to resolve
  (src/lib/dexpi/resolveTemplates.ts + primitives.ts).
  Addendum (same day): replacement is ALSO gated per label group. Some
  exports stamp one identical attribute template onto several sibling
  Text primitives that hold distinct literal parts (prefix / type code /
  suffix / status marker); resolving each independently would repeat one
  value in every position. Templated texts are grouped by
  (objectId, role); when a group has >1 distinct non-empty literals and
  every member resolves to the SAME non-empty result, the assignment is
  ambiguous and the whole group keeps its literals — positions, sizes and
  alignment untouched, never merged into one string.
  Groups whose members resolve to different values, and lone texts,
  update as before. Refined same day (director's fixture): the ambiguity
  scope is the complete represented-object label context — covering both
  several texts inside one Label group AND several one-text label groups
  as siblings of one representation — and detection is per
  identical-result SUBSET (collectAmbiguousIndices), not whole-context
  uniformity: an independent reference/status label with its own
  template and a different result updates normally without disarming
  the tag parts' protection.
- **2026-08-21** Display-quality safeguard for drawing text
  (src/lib/dexpi/labelPolicy.ts, director's rule): the viewer never
  renders unresolved markers, placeholder tokens, or invalid sentinels as
  drawing text. `isRenderableLabelValue` is the single centralized
  policy — empty/whitespace, an explicit sentinel list (?, ???, N/A,
  TBD, null, #VALUE!, …), template-token shapes (`<Word>`/`{Word}`)
  that leaked into model data (e.g. a PropertyBreak's generic
  BreakValue1/2 fields), and the exporter's repeated placeholder
  filler (isMixedExporterPlaceholder, broadened twice same day as real
  patterns surfaced): length ≥ 2 where EVERY character is filler — a
  symbol/punctuation char or the unknown marker x/X — covering pure
  runs ("????", "-----", "xxxx") and mixed patterns ("??XX??",
  "x-x-x") alike; shape-based, no object/position/break-id
  special-casing; lone symbols stay renderable. Applied in both drawing-text resolution paths:
  profile LabelTemplates render a non-renderable field blank, so only
  that label position is suppressed (the break symbol's two BreakValue
  positions stay independent); explicit-text templates treat it as a
  failed fragment, so the literal snapshot stays. Panels still show the
  raw stored data — the source model is never repaired. Companion rule
  in lookupAttribute: when several objects at the same BFS hop carry the
  attribute with DIFFERING values (a PropertyBreak's nested
  logical-break records), ownership is ambiguous and the lookup reports
  unresolved instead of flattening an arbitrary nested value into the
  generic parent label.
- **2026-08-21** Enum display policy for drawing text (director's rule,
  found via slope labels): an enumeration reference in an explicit
  text's template resolves through its published display mapping — the
  `<Attr>Representation` twin — when one exists. Without a mapping the
  only text available is the raw technical local name ("Sloped"), which
  never replaces a non-empty authored literal: the short human-readable
  label in the XML wins (resolveTemplateTexts tracks per-fragment
  whether the value was a bare DataReference). The raw name is still
  shown when the literal is empty or a sentinel — better than a blank
  label. The viewer never converts a classification into a directional
  word — direction comes from the authored text or the slope symbol's
  own rotation/mirroring, which text resolution never touches.
- **2026-08-21** Profile-label suppression is ownership-based
  (collectExplicitlyLabelledIds in sceneGraph.ts, director's rule): the
  explicitly-labelled set that blocks LabelTemplate overlays is computed
  on the XML representation tree, NOT the emitted text nodes — the old
  emitted-node scan lost the object association when the explicit label
  group and the symbol group were siblings with Represents at a
  different nesting level, so profile templates duplicated the tag. The
  walk propagates Represents down as usual; an authored, non-empty label
  text with no association on its own chain is attributed to the
  nearest enclosing subtree that represents exactly ONE object
  (ambiguous subtrees never guess). Ownership uses authored literals
  only — template resolution can't move an object in or out of the set.
  Suppression stays scoped per represented object (never by text value,
  position, or symbol type), and explicit primitives are never merged.
- **2026-08-19** License decided by the director: **AGPL-3.0-only**
      (LICENSE at repo root, package.json license field set, README
      section, About tab statement + viewer).
- **2026-08-19** PDF export fixes: pdf-lib's `drawSvgPath` applies its
  `scale` option to the CTM before `setLineWidth`/dash, so widths and
  dash arrays must be passed in drawing mm (they were pre-converted to
  points → everything drew 2.83× too thick). Fonts embed unsubsetted
  and only the faces the scene uses — pdf-lib/fontkit subsetting emits
  a corrupt glyf table that PDF viewers reject (most glyphs vanished).
- **2026-08-19** Selection is multi-capable: `selectedIds` (ordered)
  beside the primary `selectedId` (anchor; what Properties/Connections
  show). Ctrl/cmd toggles (tree + canvas), shift range-selects over the
  tree's visible rows, all selected objects highlight. Hovering object
  rows in panels highlights on canvas. Tree right-click menu copies
  label / type / label+type+id. Director: selecting a grouping object
  does NOT highlight or select its subtree.
- **2026-08-22** The bundled example is now the real DISC sheet
  `DISC_EXAMPLE-14-13.xml` from the 2026 Pack (director) — it pairs
  with the bundled Profile 0.6.3 and carries real HeatTracingType data
  (the Highlight panel's "Heat traced" mode finally lights up on
  shipped data). `public/examples/DexpiExamplePid.xml` was removed
  (C01 stays in `refrences/reference_pid.xml` for all tests); the
  stale "Tennessee Eastman" hotkey description was fixed. Verified
  against the sheet's official SVG rendering — layout matches; the
  missing sheet border is the "/Border" well-known shape (below).
- **2026-08-22** Validation refined on real DISC data (the old rules
  flooded the panel with 170+ findings and duplicated React keys):
  V02 exempts namespace-qualified References targets (they reference
  PUBLISHED models — enum literals like
  `DiscProfile/InformationModel.…` — same identifier-only stance as
  the data.dexpi.org URIs); V03 owns catalogue resolution, is
  profile-aware (a placement resolved by the loaded profile is fine —
  regression-tested: ALL 125 placements in DISC_EXAMPLE-14-13 resolve
  against the official 0.6.3 catalogue), aggregates unresolved
  profile symbols to one finding per symbol (warning without a
  profile, error with one), and rootless "/Border"-style well-known
  representation shapes (Core/Diagram.Border) warn instead of
  erroring — no published catalogue ships their geometry, the
  exporting tool draws them. IssuesPanel rows now key on index
  (identical owner+message pairs exist in real files).
- **2026-08-19** The ribbon Example button loads the C01 DEXPI example
  P&ID (`public/examples/DexpiExamplePid.xml`, copied from
  refrences/reference_pid.xml) instead of Tennessee Eastman.
- **2026-08-19** "Spec unit names" setting applies to the Properties
  panel only; drawing labels (and thus SVG/PDF export) always use
  conventional symbols — enforced in resolveTemplates, regression
  tested.
- [ ] TextTemplate/AttributeRepresentation label resolution (from M2;
      still open — labels currently show their literal text)

### M5 — Connectivity & navigation ✅

- [x] Flow-connectivity graph (unit-tested on both fixtures): directed
      edges from Source/Target-family references (SourceItem/TargetItem,
      SourceNode/TargetNode, Source/Target) + pass-through bridges
      (port/node/nozzle/chamber ↔ owning item) so traces run through
      equipment
- [x] Upstream (amber) / downstream (green) / both trace overlay;
      re-invoking the active mode clears; trace auto-clears on document
      load. Trace buttons live in the Connections panel (moved out of
      the ribbon — director judged the ribbon section redundant once
      the panel existed)
- [x] Search across labels/types in the tree with select + zoom-to
      (landed with M4)

### M6 — Export, validation & DISC profiles ✅

- [x] Export SVG (spec-mapping emitter, `src/lib/dexpi/exportSvg.ts` — full
      visual fidelity, verified against the canvas render) and vector
      PDF (pdf-lib + embedded Carlito/Liberation/DejaVu subsets;
      instancing resolved by `flattenScene`). PNG dropped per director
      ("SVG and PDF is enough").
- [x] Rule-based validation, expanded to nine rules with per-finding
      suggestions: V01 duplicate ids (aggregated per id), V02 dangling
      refs, V03 unknown shapes, V04 undrawable connectors, V05 flow
      items missing source/target, V07 orphaned piping nodes, V08
      required EngineeringModel meta data, V09 unresolvable template
      attribute references, V06 missing diagram extent. **Parity with
      the prior-art viewer's run on reference_pid.xml is unit-tested**
      (same 2 errors: missing ExportDateTime + NominalCapacity(Volume);
      same orphans PipingNode60/61). Validation panel: severity summary
      chips, filters, collapsible rule groups, suggestions, CSV button,
      jump-to-object; auto-expands when a loaded document has findings
      (panel content mounts lazily — a collapsed node would go stale)
- [x] CSV report export of the findings
- [x] DISC profile support (DEXPI 2.1): load DiscProfile.xml
      (Profile/Symbol catalogue), Profile/SymbolUsage resolution with
      per-instance variant conditions (PropertyValueCondition), profile
      persists across document loads, ribbon Profile button + status
      bar; unit-tested variant selection
- [x] AttributeRepresentation resolution (landed with the M2 item —
      applies to profile-driven labels too)
- [x] Profile LabelTemplates (2026-08-19): symbol variants parse their
      `LabelTemplates`; each placement synthesizes world-space overlay
      text nodes (src/lib/dexpi/profileLabels.ts) — `<Attr>` resolves
      via the 2-hop related-object search, `ClassName:<Attr>` picks a
      specific child (by PortStatus for H/HH/L/LL alarm prefixes, else
      positionally; unmatched role-path suppresses the template), and
      VB-style `' & ` formula syntax is stripped. **Caveat (director
      accepted):** semantics reconstructed from the prior-art viewer's
      source — at the time the DISC profile spec was not publicly
      available, so this was best-effort until real DiscProfile.xml
      data arrived (superseded 2026-08-22, see below); the
      ribbon Profile tooltip says so. Unit-tested against synthetic
      fixtures.
- [ ] SignalConveyingFunctionTypeRepresentation (DiscProfile custom
      attribute): line-style decoration for signal lines — prior-art
      viewer restyles them; needs the same fixture
- [ ] Profile validation (prior-art viewer's PRF-E01…E05 rules on the
      profile file itself + DEXPI×profile cross-checks) — optional
- [x] 2026-08-19 profile audit small fixes: variant conditions also
      match `Plant/Piping.`/`Plant/Instrumentation.`-prefixed instance
      attributes; labels fall back to `DiscProfile/ItemTag` and
      `DiscProfile/ObjectDisplayName`

### M7 — Polish (performance pass remaining)

- [x] Persist dock layout (localStorage, debounced saves, healed via
      loadLayout on restore) + ribbon Reset button. Recent files
      dropped: the browser can't reopen local files without stored
      FileSystem handles — revisit only if the director wants the
      File System Access API.
- [x] Minimap panel (default bottom-left, toggleable): one cheap CPU
      raster per document/theme (no second WebGL context, text
      skipped), live viewport rectangle via DOM overlay, click/drag
      to navigate (centerAt view command)
      (measurement tool dropped — director decision 2026-08-19)
- [x] Performance: the scene body records into an SkPicture (keyed on
      document/theme/stroke parameters — the min-px clamp depends on
      zoom, so a zoom step re-records; pans/hovers/selection replay).
      Measured ~56 fps sustained drag-pan under software-rendered
      swiftshader; real GPUs are faster. Culling deferred until a
      genuinely large fixture exists.

### M8 — Topology graph ✅

- [x] Semantic-network view of the engineering data as a dockable
      "Topology graph" panel (id `topologyGraph`, ribbon Panels toggle,
      hotkey ALT + 9002, `home: "center"` so it tabs with the drawing;
      not in the default layout). The tree panel's TITLE renamed
      Topology → **Explorer**; its panel id stays `topology` because
      persisted dock layouts key on ids.
- [x] Graph assembly (`src/lib/graph/semanticGraph.ts`, unit-tested on
      both fixtures): nodes = plant objects with connection hardware
      (ports/nodes/nozzles/chambers, transitively — Chamber→Nozzle)
      collapsed into the nearest non-pass-through ancestor
      (`resolveOwningNode`); edge kinds **flow** (connectivity edges
      lifted to owning items), **containment** (hierarchy, skipping
      pass-through intermediates), **reference** (References properties
      minus the Source/Target family, which `isFlowReferenceProperty`
      in connectivity.ts now exposes — otherwise every flow edge would
      duplicate as a reference edge). Attributes are node detail
      (tooltip), never edges. Ego extraction (`extractEgoGraph`, BFS
      over enabled kinds) and a deterministic first-N `capGraph`.
- [x] Hand-written deterministic layered layout, flow left→right
      (`src/lib/graph/layeredLayout.ts`, no new dependencies): DFS
      cycle-breaking (recirculation loops are real), longest-path
      layering, containment/reference fixpoint for non-flow nodes
      (with subtree-root seeding so pure hierarchies fan out),
      isolated nodes in a spare column, 4 barycenter sweeps, cubic
      bezier edges. Node widths from a char-count estimate — no canvas
      measurement. Readability over graphviz parity: long edges get no
      dummy nodes.
- [x] Panel (`src/components/panels/topologyGraph/`): first inline-SVG
      surface in the app (no second WebGL context — same reasoning as
      the minimap). Theme via dark Tailwind fill-*/stroke-* classes
      only — and ONLY the slate/blue scales, because the
      @tredespace/ui light theme remaps just those token scales
      (director caught emerald/violet-950 node fills going
      dark-on-dark in light mode): node boxes fill slate-900, the
      category reads from mid-scale border colors (emerald/violet/
      cyan/slate 500–600) that are legible on both backgrounds.
      Modes: **Neighborhood** (default; ego graph around the
      selection, depth stepper 1–6) and **Document** (whole file,
      soft cap 400 nodes with an amber "Showing N of M" note). Edge
      kind toggles (FieldToggleRow, requireOne) plus a "Show:" row of
      connection-hardware checkboxes (Nozzles / Chambers / Piping
      nodes / Ports, director 2026-08-22, all off by default): checked
      families stay as their own dashed mini pill nodes instead of
      collapsing, and get stitched into the flow path towards their
      owner in the direction the flow actually passes them (deepest
      hardware first so Chamber→Nozzle nesting chains outward; a
      spare nozzle with no flow gets containment only).
      A "Gap n×" stepper (1–6, director 2026-08-22) multiplies the
      vertical node gap for a more spread-out layout, and a "Linked"
      toggle (default on, same day) tints the backgrounds of the
      selection's direct flow neighbours — amber upstream / green
      downstream (the app's trace colors) and violet for
      signal/electrical links (either endpoint's typeName contains
      "Signal") — as translucent mid-scale fills over the slate box so
      both themes stay readable (computeLinkedTints in
      src/lib/graph/linkedTints.ts, unit-tested).
      mode/depth/kinds/hardware/gapScale/highlightLinked persist to
      `localStorage["dexpi.topologyGraph"]`. A toolbar "?" button
      (director 2026-08-22) toggles an in-panel legend overlay
      (GraphLegend.tsx) that explains the encoding with live style
      samples (SVG snippets using the same Tailwind classes as the
      graph, so it can't drift): edge styles, category borders,
      hardware pills incl. the spare-nozzle dashed-ownership rule,
      selection tints, and the click/ctrl/double-click/pan gestures.
      Ephemeral useState — deliberately not persisted. Pan, wheel
      zoom-to-cursor (native non-passive listener), toolbar zoom
      in/out buttons, Fit. Node/edge tooltips use the app's
      `data-tooltip` bubble (works on SVG elements), not the
      browser-native `<title>` (director). Selection syncs both
      ways: click/ctrl-click selects (and reveals the object in the
      Explorer tree, same as canvas clicks — verified headless),
      hover highlights, double-click zooms the drawing. A plain click
      on a graph node re-roots the neighborhood around it, same as an
      external selection (director, 2026-08-22 — the first cut kept
      the layout still on every graph click and read as broken);
      only ctrl/cmd-toggles keep the layout stable so multi-select
      doesn't jump mid-gesture (guard predicts the toggled primary id
      so non-primary toggle-offs don't leave it armed). Re-roots
      never zoom the view out (director, same day — usePinOnRecenter):
      a graph click keeps the clicked node at its exact screen
      position; an external selection (drawing/Explorer) preserves the
      zoom and leaves a fully-visible root in place, centering it at
      the same zoom only when it is off-screen or new to the graph.
      Auto-fit remains for structural changes only (first layout,
      mode switch, depth/edge/hardware toggles) and the Fit button.

### M9 — Highlight by classification ✅

- [x] "Highlight" dockable panel (id `highlight`, home right, ribbon
      Panels toggle, ALT + 9003; not in the default layout): pick a
      classification and the CANVAS tints every matching object, the
      way the trace overlay tints upstream/downstream. Modes: Heat
      traced, Signal & instrument lines, Fluid code, Piping class.
      First use of the @tredespace/ui `Select` widget; per-mode option
      hints show match counts and zero-count modes are disabled —
      honest empty states, because NO shipped fixture carries
      HeatTracingType (real DISC files do) and the Tennessee Eastman
      Process fixture has neither piping codes nor signals.
- [x] Classification lib (`src/lib/dexpi/classification.ts`,
      unit-tested on both fixtures + a synthetic heat-traced doc):
      `buildClassificationGroups(doc, mode)` — heatTrace reads
      `doc.scene.heatTracedIds` (NEW: `buildSceneGraph` now returns
      the set it already computed instead of discarding it — the
      eligibility/descendant rules stay only in heatTracing.ts);
      signal = typeName contains "Signal" or ends with
      MeasuringLineFunction/ActuatingFunction; fluidCode/pipingClass
      group by the EFFECTIVE attribute value (nearest-ancestor
      inheritance, own value wins — a System's code covers its
      segments/pipes/valves). Groups sort by size desc then key.
- [x] State `src/state/highlight/` (mode + groups + hiddenKeys,
      trace-store idiom): document loads RECOMPUTE groups for the kept
      mode rather than clearing; legend checkboxes hide single values.
      Not persisted (session viewing aid, like trace).
- [x] Canvas: `ScenePalette.classify` — 6-color categorical ramp per
      theme + `classifyColor(palette, index)`; `SceneHighlight` gained
      `classification: ReadonlyMap<objectId, PaletteColor>` drawn as
      one scan BELOW trace/hover/selection (those still win), outside
      the cached SkPicture so toggles never re-record the body. The
      panel legend derives swatches from the same palette so canvas
      and legend cannot drift. Minimap passes an empty map.

- **2026-08-22** Official DISC Profile 0.6.3 bundled (director): the
  2026 Pack's `DiscProfile.xml` catalogue is copied to
  `public/profiles/DiscProfile-0.6.3.xml` (6.4 MB, ships with the
  build) and a ribbon **"Profile 0.6.3"** button (`file.profile063`,
  ALT + 1003) loads it in one click; the old picker
  button is renamed **"Custom profile"** and still loads any
  DiscProfile.xml (replacing the bundled one). Selected-state: 0.6.3
  button lights for the bundled profile, Custom for any other
  (`BUNDLED_PROFILE_NAME` exported from viewer.actions).
  `discProfileOfficial.test.ts` regression-tests the parser against
  the official catalogue: 284 symbols / 320 variants (matches the
  pack's 0.6.0→0.6.3 comparison report), 210 symbols with label
  templates, conditions honoured by pickVariant, and exactly
  ND0000/ND0040/ND0041 as legitimately primitive-less (node-/
  label-only symbols). The "spec isn't publicly available" caveats in
  the ribbon tooltip and code comments are retired — parsing is now
  verified against official data; only LabelTemplate placeholder
  RESOLUTION semantics remain prior-art-derived (no placed-symbol
  fixtures yet), and no published file carries Profile/LineStroke
  instances.

- **2026-08-22** DISC_EXAMPLE-14 xml-vs-svg sweep (director asked what
  is bug vs spec gap): all 15 sheets parse against the official 0.6.3
  profile with zero errors and zero unresolved profile symbols
  (permanent smoke test `discExample14.test.ts`; only findings are the
  "/Border" well-known shape and genuine off-page V05 warnings).
  Visual side-by-sides against the official SVGs match, ONE bug found
  and fixed: off-page connector labels (ReferencedDrawingNumber/
  -Descriptor) never rendered because the data lives on an ID-LESS
  `PipeOffPageConnectorReferenceByNumber` child, invisible to the
  id-keyed lookup index — `ownAttribute` in resolveTemplates.ts now
  folds id-less component descendants into their owner (Core/* value
  objects excluded so quantity wrappers can't false-match; same-depth
  differing values stay ambiguous→unresolved). Regression test
  `profileLabelsOffpage.test.ts`; NOA2/NOA3 arrows verified against
  the official SVGs. Remaining visual difference on every sheet is
  ONLY the "/Border" title block — a spec/profile gap, not a viewer
  bug. Known smaller gap: id-less conceptual children are also
  invisible to the plant model/Properties panel (walkPlant requires
  an id) — unaddressed, low impact.

- **2026-08-22** An active trace FOLLOWS the primary selection
  (director): selecting another object re-traces the same mode from it,
  deselecting everything clears the overlay. Implemented as a
  selectionState subscription in trace.actions.ts guarded on selectedId
  (hover/multi-select churn in the same store must not retrace);
  toggle-again-to-clear semantics unchanged since originId now always
  tracks the selection.

## Decisions log

- **2026-08-19** Node.js was missing in this environment; installed
  v24.19.0 LTS to `~/.local/node` (symlinked onto PATH via the VS Code
  flatpak `node_modules/bin` dir).
- **2026-08-19** `@tredespace/ui` is not on the npm registry; it installs
  from the tarball via `file:external/tredespace-ui-0.0.56.tgz`. Peer
  deps: React ≥19, Tailwind v4 in the build.
- **2026-08-19** DEXPI 2.0 XML only (director decision): Proteus XML
  (DEXPI 1.2–1.4) is out of scope entirely, we target 2.0 and above.
- **2026-08-19** `https://data.dexpi.org/models/2.0.0/*.xml` (the model
  URIs DEXPI files import) are not fetchable (TLS failure) — treat them
  as namespace identifiers only.
- **2026-08-19** Theming: author **dark-theme Tailwind utilities only**.
  The @tredespace/ui stylesheet *inverts* the `--color-*` variables under
  `html[data-theme="light"]` (slate-900 ↦ near-white), so the same
  classes render both themes. A `light:` custom variant fights the remap
  — tried and removed.
- **2026-08-19** `createStore` is not exported by the @tredespace/ui npm
  package (only widgets/dockable/hotkeys are), so `src/lib/createStore.ts`
  carries a local implementation of the same API.
- **2026-08-19** Placeholder hotkeys: ALT then a 4-digit number per
  ribbon action (1xxx File, 2xxx View, 9xxx App) until the director
  settles final bindings; all rebindable in Settings → Shortcuts.
- **2026-08-19** Fill semantics, verified against the spec's OWN reference
  SVGs (`src/model/Core/Diagram/*.svg` in the Specification repo): the
  published FillStyle page defines no mapping (dangling reference), but the
  examples show `Transparent → fill="none"` and `Hatch → hatch lines in the
  STROKE color` — a single-color model, so `Solid` = filled with the stroke
  color. Consequence: the Tennessee Eastman stream flags are authored as
  near-black solid polygons WITH black text on top — the text is invisible
  by the file's own data, in any conformant renderer. Not our bug.
- **2026-08-19** More spec-example conformance: strokes use round caps and
  joins (`stroke-linecap/linejoin="round"`), and scaled ShapeUsages draw
  their strokes non-scaling (`vector-effect: non-scaling-stroke` heuristic)
  — symbol scale must not fatten the linework.
- **2026-08-19** The spec's Python model sources on GitLab
  (`dexpi/Specification: src/model/**`) are the fastest authoritative
  reference for graphics semantics — the PDFs aren't greppable here
  (no pdftotext in the sandbox).
- **2026-08-19** The parsed `DexpiDocument` (Maps, big scene graph) lives
  as a module-level handle in `viewer.actions.ts` (`getLoadedDocument()`),
  not in the store; the store carries `docRevision` and subscribers re-read
  the handle when it bumps.
- **2026-08-19** Text rendering needs THREE things to look right:
  (1) metric-compatible faces — Calibri→Carlito, Verdana→DejaVu Sans,
  Arial→Liberation Sans — otherwise labels overflow boxes and table
  columns; (2) `Font.setLinearMetrics(true)` + `setSubpixel(true)` +
  `FontHinting.None`, because fonts sized in drawing mm (~2.5) under a
  scaling matrix otherwise get pixel-quantized advances that read as
  random letter spacing; (3) fonts resolved per Text primitive, not one
  global face. Carlito/DejaVu copied from the system (SIL OFL/Bitstream
  Vera licenses permit bundling).
- **2026-08-19** **DEXPI 2.0 diagram coordinates are y-DOWN (SVG-like)**,
  unlike Proteus. Proof: the spec's EllipseArc runs "in positive direction
  (i.e., clockwise)" with the standard (cosθ, sinθ) parameterization, and
  title blocks carry Y near MaxY. The first renderer assumed y-up and
  silently mirrored every drawing vertically (local text un-flipping masked
  it) — caught only by comparing `reference_pid.xml` against the official
  C01 rendering. No axis flip anywhere now; rotations and arc sweeps map
  1:1 onto Skia's y-down conventions.
