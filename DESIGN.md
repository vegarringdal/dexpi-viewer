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
- **2026-08-22** Undefined-valued Data properties are shown, not hidden
  (follow-up to the same director principle): collectAttributes used to
  drop any property whose value formats empty — a PIF carrying five
  `<Undefined/>` properties read as "No attributes". PlantNode gained
  `undefinedAttributes` (names only, kept OUT of `attributes` so
  classification/labels can't consume placeholders); the Properties Data
  section and the Inspect cards render them as dimmed/italic
  "(undefined)" rows. Unknown/custom property NAMES were never filtered
  anywhere — they always showed with values; flagging them as illegal is
  M10's job.
- **2026-08-22** Inspect panel marks problems in red (director: "instead
  of hiding, show them, but red as issues"): every card carries its
  object's effective validation findings — severity-colored border
  (red/amber/sky) plus severity-colored "⚠ ruleId: message" rows inside
  the card (capped at 3 + "+n more", tooltip holds the full text) — and
  an unresolvable reference target renders as a fully RED broken card
  ("Reference target resolves to nothing…") with a red edge, never
  silently as a normal-looking stub. buildObjectDiagram takes an
  issuesById map (panel builds it from getEffectiveIssues, so severity
  overrides apply); DiagramCard gained severity/issueRows/broken.
- **2026-08-23** Highlight visibility follow-ups (director): (5) a "Dim
  others" checkbox in the Highlight panel (disabled while mode is off)
  draws a paper-colored veil (alpha 0.8) over the sheet BEFORE the
  highlight passes, so classification/trace/selection repaint their
  members at full strength on a faded drawing — tints stand out
  dramatically; (6) Black & white got a BIG stateful ribbon button
  (View → B/W, IconContrast, selected-state visible) sharing the same
  highlightState.monochrome as the panel checkbox.
- **2026-08-23** Selection & Highlight refinements (four director asks):
  (1) selection gets a marker-pen YELLOW treatment under the blue
  re-stroke — first shipped as a bounding-box backdrop, revised same
  day on director feedback ("rect highlights too big an area"): now a
  GEOMETRY-FOLLOWING halo (the selected nodes re-stroked at 7× the
  min-width clamp in palette.selectionFill) plus a filled yellow rect
  behind TEXT only (glyph doubling reads blurry; the rect is computed
  from the measured line block, rotates with the text, and has a
  Settings → Rendering toggle "Backdrop behind selected text",
  persisted). Highlight/selection re-strokes now PRESERVE dash
  patterns (previously forced solid) — a selected heat-traced pipe
  keeps its dashed trace distinguishable from the pipe itself; (2) the classification ramp no longer contains blue
  (first color is now crimson) so tints can never be mistaken for the
  blue selection; (3) the signal Highlight mode groups PER SEMANTICS
  (SignalConveyingFunctionTypeRepresentation value, falling back to the
  bare class name) — each signal type gets its own legend entry, color
  and visibility toggle; (4) a "Black & white drawing" toggle in the
  Highlight panel renders all content in ink/paper only
  (SceneDrawOptions.monochrome through adaptColor, near-white stays
  paper so masking fills keep masking; part of the picture cache key) —
  file colors never mix with highlight tints.
- **2026-08-22** Manual gained a "Conventions beyond the spec" page
  (director's ask): documents every place the viewer renders/validates
  by empirically-recovered convention because NO spec exists — signal-
  line styling table (incl. the hydraulic project decision and the
  single-sample bus-circle caveat), profile label placement rules,
  plant-code/TypeCode resolution, the deliberately-unapplied FC/FM
  display codes, /Border, and the tuned validation conventions. Framed
  as candidates for upstream standardization. The signal table carries
  generated SVG previews (documentation/signals/, rendered by the SAME
  signalLines.ts code the canvas uses — cannot drift). Docs are also
  reachable via app URL param `?docs`, the F1 hotkey (help.docs,
  rebindable), and a direct manual link in the README.
- **2026-08-22** Generated documentation + manual site (director's ask:
  "static documentation by loading examples/profile, grabbing
  screenshots"): `documentation/` holds hand-written guide pages
  (getting-started, viewing incl. underlay, validation, inspect,
  topology, exports) plus GENERATED content — `npm run generate:docs`
  (scripts/generateDocs.mjs, node importing the .ts sources directly
  with jsdom supplying DOMParser) rebuilds rules.md (all 23 rules with
  curated prose), metamodel.md (484 classes/89 enums summarized per
  package) and symbols.md + symbols/*.svg (every DiscProfile 0.6.3
  symbol rendered through the app's own sceneToSvg — 281 thumbnails);
  scripts/generateDocScreenshots.mjs re-captures the manual's PNGs by
  driving the real app (requires playwright + dev server; images are
  committed). `npm run build` now runs scripts/buildDocsSite.mjs first:
  markdown → styled static HTML with sidebar nav (marked devDependency)
  into public/manual/ (gitignored build artifact), shipped with the
  Pages deploy. Reachable via the new ribbon **Help → Docs** button
  (wiki icon, director's ask) and an About-tab link. Table cells escape
  angle brackets — label-template placeholders like <AlarmValue> were
  being eaten as HTML on the first pass.
- **2026-08-23** Screenshot callouts (director's ask: "yellow/transparent
  rect and/or arrow, to show what section we are talking about"):
  generateDocScreenshots.mjs gained an annotate() helper that injects
  orange-bordered translucent rects (plus optional SVG arrows) over the
  live page before capture, positioned from Playwright boundingBox() of
  the real controls — so callouts track the UI instead of drifting.
  Applied to overview.png (ribbon File section, for getting-started),
  validation.png (filter/severity toolbar), inspect.png (depth select +
  Fit), topology.png (mode/depth/edge/show toolbar), underlay.png
  (underlay toolbar, with arrow) and highlight-dim.png (panel toggles +
  ribbon B/W button); image alt texts name what the callout points at.
  Second round added ribbon-strip callout images (clip of the ribbon
  only): view-ribbon.png (View section, in viewing.md), export-ribbon.png
  (Export section, in export.md) and panels-ribbon.png (Panels section +
  Reset, in getting-started.md), and getting-started's workbench section
  now explains the tredespace UI dock (link to tredespace.com/docs/widgets):
  drag-to-dock/tab-group, drag-out to a floating dialog, collapse-to-rail
  chevron + in-place ▾ shrink (probed live: ▾ is a collapse toggle, not a
  menu), splitter resize, and ribbon → Reset for the default layout.
  panel-drag.png (director's ask) captures a live tab drag mid-gesture —
  mouse.down on the Validation tab, stepped moves to the drawing center,
  screenshot while the dock compass + blue drop preview are showing, then
  Escape to cancel; it runs last in the script so a stray drop can't
  disturb the other captures, with highlight/B&W/dim reset first so the
  drawing shows normal colors. Same round fixed two script bugs: the Fit clicks
  matched three buttons (strict-mode error swallowed by .catch, so Fit
  silently never ran) — now .first() targets the ribbon; and the
  selection-halo block reused the mm→screen mapping computed before the
  Inspect/Topology rails expanded — it now remaps against the current
  canvas box, selects pump D-20PA001 at (170, 254) mm before zooming,
  and clamps the clip inside the canvas.
- **2026-08-24** Shortcut cleanup + keymap I/O (director's ask): the
  placeholder ALT+4-digit bindings are gone. New defaults lean on plain
  keys (they can never collide with browser chords): F fit, 0 zoom100,
  Z+I/Z+O zoom (the sequence grammar has no +/- key tokens), D theme,
  B monochrome, digits 1–9 toggle panels in ribbon order, E+P/E+S/E+C
  exports, Ctrl+O/Ctrl+Shift+O/Ctrl+Shift+L for the file family,
  Ctrl+Alt+R layout reset, F1 docs. Previously-missing actions (exports,
  B/W, Explorer/Properties/Validation/Connections/Inspect/Minimap
  panels, layout reset) are now bound and every ribbon button carries its
  shortcut id (tooltips show the binding). Panel hotkeys TOGGLE via a new
  ui.actions toggleDockPanel (same semantics as the ribbon buttons).
  Settings → Shortcuts gained Export/Import keymap using the library's
  exportJson/importJson ({version:1, bindings:{id:{keys}}} — overrides
  only, human-readable); import shows an applied/skipped/conflicts
  report. hotkeys.test.ts pins the table with validateBindings
  (unique ids, parseable, conflict-free); vitest now inlines
  @tredespace/ui (its ESM ships extensionless relative imports Node's
  resolver rejects). Old user overrides survive where ids were kept
  (file.*, view.*, app.*, help.docs).
  (director-supplied; replaces the empirically-recovered guesses):
  electrical solid + repeated italic E (the old "square bracket" reading
  of the official SVGs was that E), hydraulic solid + upright L
  (supersedes the fluid-filled-so-solid call), bus SOLID + circles (was
  dashed), pneumatic ^ chevron, capillary x, undefined /, EM-guided ~,
  EM-unguided marks-only with the line hidden (no conductor to depict),
  plain SignalConveying stays dashed 3/3, attribute absent stays
  as-authored. Marks are hand-drawn vector glyphs (no font dependency for
  exports), 6.5mm cadence from 2.5mm in (measured), circles 10mm from
  5mm; rotation normalizes to the readable half-plane (right-to-left
  segments were drawing upside-down Es); lines shorter than the cadence
  get one centered mark (vital when the line itself is hidden).
  PRECEDENCE (director's call): a profile-published Profile/LineStroke
  for a representation literal overrides the built-in style by default —
  DiscProfile.signalStrokes collects them (0.6.3 publishes none; matcher
  keys on an ancestor named after the literal, best-effort until the
  container format ships) — and Settings → Rendering → "Built-in
  signal-line styling" forces the table back (parse-baked via a
  setPreferBuiltinSignalStyle module setter mirroring setUnitDisplayMode;
  toggling re-parses). conventions.md table + signals/*.svg previews
  regenerated (11 rows).
- **2026-08-23** Inspect shows problems structurally, not as error blobs
  (director: "should show a property just red text to show it should be
  there instead of error … not obscure data"): ValidationIssue gained an
  optional `attributeName` — set by META-002 (template attribute), MDL-002
  (unknown property), MDL-003 (missing required) and MDL-004 (bad enum
  literal) — and the object-diagram card builder merges such findings into
  the ROWS: a named-but-absent property becomes a red "(missing)" row, an
  existing row turns red in place, the full message moves to the row
  tooltip, and only unmappable findings remain as ⚠ rows. Messages and the
  Issues/Properties panels are unchanged — those are for reading findings;
  Inspect is for structure.
- **2026-08-23** Inspect "Drawing" toggle: a second, diagram-inclusive
  plant model (`fullPlantModel`, WeakMap-memoized per DOM root — the root
  Element now travels on DexpiDocument) keeps Core/Diagram objects.
  Drawing objects carry NO ids in real DISC files, so their positional
  XPath becomes the synthetic id (pastes into xmllint; shown in the card
  tooltip). With the wrapper form, diagram trees hang off
  Core/EngineeringModel's other Components — diagram mode starts from ALL
  of them, not just ConceptualModel. Clicking a synthetic card re-centers
  Inspect LOCALLY (a panel-level centerOverride) instead of touching
  global selection, which nothing else could resolve; a new global
  selection or leaving drawing mode drops the override. The panel header
  (with the toggle) now renders even when the current selection yields no
  diagram — a drawing-side object selected in plant mode would otherwise
  leave the toggle unreachable. State/layout logic moved to
  useInspectDiagram (component stays render-focused).
- **2026-08-23** Inspect data fidelity + copy menu (director: "not really
  showing the data … right click to copy out data as json, xpath"):
  (1) multi-valued Data properties were silently truncated to their FIRST
  value everywhere (dataValue reads firstElementChild) — new dataValues()
  reads all children and collectAttributes joins them, so a ConnectorLine
  shows every InnerPoint; rows that overflow the card carry their full
  value as a tooltip. (2) Right-click on any card → "Copy data as JSON" /
  "Copy XPath". JSON comes from objectJson.ts working on the SOURCE
  element (PlantModel now carries elementsById) — full fidelity: typed
  values, DataReference as {$ref}, aggregates/components recursive,
  multi-values as arrays — deliberately NOT the display strings.
  InspectContextMenu is a plain fixed-position div (tredespace UI has no
  menu widget); dismiss listeners are capture-phase with an
  inside-the-menu guard. (3) Director's mid-round asks: drawing-side
  cards render with a DASHED border (they never feed plant-data views;
  isDiagramType exported from plantModel), the header prefixes
  "Drawing ·" while the mode is on, and the centered object's full XPath
  shows as a selectable line under the header. Follow-ups the same round:
  a header hint line says where the data lives ("See the Properties panel
  for this object's full data" for plant objects vs "Drawing-side object —
  shown only here; right-click to copy" for drawing ones), and card
  tooltips no longer leak the XPath id (it overflows) — drawing cards'
  tooltips state what the card is instead; the XPath stays available via
  right-click → Copy XPath and the header line. Documented with a new
  reproducible inspect-drawing.png capture (depth 1 for card size, menu
  held open, Drawing toggle called out).
- **2026-08-23** Manual is mobile-responsive (director: "people might
  open documentation on mobile — hamburger/side panel"): below 820px
  the sidebar becomes an off-canvas drawer behind a fixed hamburger
  bar, driven by a pure-CSS checkbox toggle — no JavaScript, because
  the site is multi-page (following a link loads a fresh page with the
  drawer closed) and a full-screen backdrop label closes it in place.
  Desktop layout unchanged; tables already scroll horizontally and
  images cap at 100% width.
- **2026-08-22** Properties panel gained an "Issues (n)" section below
  Sub-components (director: an element's findings should be obvious when
  you click it): the selected object's validation findings with severity
  chip, rule id, message and suggestion — severity overrides applied
  (getEffectiveIssues; the panel subscribes to validationConfigState),
  rendered by the shared IssueRow, which gained showRuleId/hideObjectLink
  props (the jump link is pointless when already scoped to the object).
- **2026-08-22** Verification underlay (director's idea — "align a
  background image/svg/pdf with our generated drawing to verify
  issues"): the Drawing panel gained a top toolbar that loads a
  reference file as an alignment underlay. Raster images decode
  natively, SVG rasterizes via the browser at 4096px long edge, PDF
  (page 1) via pdfjs-dist (new dependency, notices regenerated). The
  bitmap is uploaded to a CanvasKit image once per load and drawn
  inside the same mm transform as the scene — stretched to the diagram
  extent by default, which aligns the official DISC SVGs exactly —
  with opacity, under/over placement, and mm-offset/scale nudges
  (NumberInput steppers). State pair in src/state/underlay/ (bitmap
  handle in actions); decode + pure placement math in
  src/lib/canvas/underlaySource.ts (rect math unit-tested). When the
  underlay sits UNDER the drawing, the opaque paper rect is skipped
  (SceneDrawOptions.hidePaper, part of the picture cache key) — the
  director caught that the white sheet would otherwise hide it.
  Same-day additions (director): offset steps refined to 0.1mm; a
  "Hide white" toggle multiply-blends the underlay so a white/paper
  background disappears and only its ink shows; a "Tint" toggle +
  ColorSelect recolors the underlay's ink (SrcIn color filter — keeps
  per-pixel alpha; the official SVGs rasterize with a TRANSPARENT
  background, which is why a Screen-blend tint turned the whole extent
  solid red on the first attempt) — red-reference-vs-black-drawing is
  the intended diff workflow.
- **2026-08-22** Inspect panel (director's idea: "reading XML and how it's
  connected can be hard" — a debug panel): a UML-style instance diagram of
  the selected object. Center card shows the object's FULL raw Data plus
  persistent ids; neighbor cards show every one-hop relation with the edge
  labeled by the actual property name — outgoing References, reverse
  referenced-by (from PlantModel.referencedBy, the relation raw XML hides
  best), containment parent/children (dashed), and published-model targets
  as profile-instance stub cards carrying the instance's data (violet).
  Click a neighbor to re-center (syncs the global selection both ways).
  Model+layout are pure and unit-tested (src/lib/graph/objectDiagram.ts +
  objectDiagramLayout.ts: three-column deterministic layout, 20-per-side
  cap with a "+n more" stub, neighbor rows truncated at 5); the panel
  (src/components/panels/inspect/) reuses useSvgPanZoom, which moved to
  src/components/hooks/ now that a second panel consumes it. Registered
  like the Topology graph: center-home dockable, ribbon Panels toggle.
  Same-day refinements (director feedback): cards show ALL rows (no
  truncation; the 20-per-level cap stays); clicking a neighbor pins the
  clicked card's screen position for the new center so the view never
  jumps (simplified usePinOnRecenter pattern, panel-local); a depth
  selector (1–3 levels, like the Topology graph's) chains incoming
  relations leftward and outgoing rightward — the model gained
  key/fromKey linkage so deep edges connect to their actual source card,
  with a global place-once rule that also breaks reference cycles. The
  DEFAULT layout now includes every panel (director's screenshot):
  four columns — Explorer|Validation, Drawing, a Topology-graph/Inspect
  column whose two groups start `collapsed: true` (rails; the drawing
  takes their width until the chevron expands them), and
  Properties|Connections|Highlight|Settings over Minimap; the side
  columns are deliberately narrow (13/12 weights vs 45 for the drawing —
  director: "half the width"). Existing users keep their persisted
  layout until ribbon Reset.
- **2026-08-22** Semantic signal-line styling (src/lib/dexpi/signalLines.ts,
  applied at scene build): the official renderings override a signal-family
  ConnectorLine's authored stroke (uniformly LongDash in the XML) by the
  represented object's semantics, and synthesize mark glyphs that exist in
  no XML — recovered empirically from all 15 official sheets (248 lines,
  no exceptions): MeasuringLineFunction → solid; SignalConveying → dash
  3/3; ElectricalSignalConveying → solid + square-bracket glyphs every
  6.5mm from 2.5mm after the drawn start, rotated to the local segment
  direction; BusSignalConveying → dash 2.75/4.75 + circle marks (r 1.25;
  the single observed 9mm line carries one 5mm in — modeled as a 10mm
  cadence from 5mm until longer real examples exist). Additionally
  HydraulicSignalConveying → solid (no official sample; director's call:
  hydraulic is a fluid-filled line like a measuring line). All other
  unknown subtype values keep the authored stroke. The DiscProfile defines only the
  attribute (no LineStroke graphics), and the prior-art viewer's "E"/"O"
  glyph decorations are its own invention — the official vocabulary is the
  one above. objectsById in the scene builder is now always populated
  (was profile-only). Glyph geometry parity is regression-tested against
  sheet 08's official SVG.
- **2026-08-22** Profile-label rotation, final rule (converged over three
  iterations, each corrected by real data the director flagged): labels
  follow the placement's rotation **normalized to the readable
  half-plane** — 90→270 and 180→0 flip by 180°, 0 and 270 stay, and the
  template OFFSETS rotate with the flipped angle too. Verified against
  DISC_EXAMPLE-14-12's full rotated-usage inventory: a vertical valve's
  tag renders rotate(270) whether the usage says 90 or 270 (ND0182A/B,
  ND0193A, ND0192A, ND0054, ND0056), the vertical line labels (ND0040)
  render rotate(270), and the 180°-rotated off-page connector's texts
  come out upright at unrotated offsets — which the normalization
  produces naturally (180→0), no special case. **Sole exception:
  PropertyBreak placements keep their value labels fully in sheet space**
  (the 270°-rotated breaks show them horizontal at unrotated offsets) —
  keyed off the represented object's type. isMirrored never applies to
  labels. Wrong intermediate models, for the record: (1) full transform —
  drew 180° connector labels upside down; (2) sheet-space for
  geometry-carrying symbols / full for label-only — killed the valve-tag
  and line-label rotation. NOTE: nozzle N01/N02 texts and similar are
  EXPLICIT diagram texts in the XML, not overlays — they were red
  herrings when reading the official SVG evidence.
- **2026-08-22** `<TypeCode>` placeholders resolve via References into
  the profile's published instances: the MCC/SIS function boxes and
  actuator circles carry `References property="DiscProfile/TypeCode"`
  to instances like
  `DiscProfile/InformationModel.ProcessInstrumentationFunctionTypeCodes
  .MotorControlCenter` — a ReferenceProperty, not Data, so attribute
  lookup could never see it (the prior-art viewer had no Abbreviation
  handling either; only the authoring tool rendered these).
  parseDiscProfile now collects every named instance Object in the
  profile's Packages (`DiscProfile.instances`, keyed by qualified name
  and its model-less suffix), and profile-label resolution falls back
  to the referenced instance's **Abbreviation** ("MCC", "PSD", "M")
  when a placeholder matches a References property — both bare and
  role-path placeholders. Official parity on sheet 08 regression-
  tested: MCC 1, PSD 4, ESD 1, actuator M 2 (the official SVG's two
  extra 8px "M"s are border grid letters of the undrawable /Border
  shape).
- **2026-08-22** Plant-context attribute fallback: the balloon template
  `<ProcessPlantIdentificationCode>-<PlantSystemIdentificationCode>`
  rendered as a bare "-" on balloons whose represented object is an
  inline flow element (FE tags: the Coriolis meter carries NO
  references, so the 2-hop related-object search cannot reach
  ProcessPlant1/PlantSystem1 — instrumentation FUNCTIONS carry
  ParentStructure/PlantSystem directly and always resolved). These are
  the DEXPI PlantStructureItem identification attributes — document
  context, not per-item data — so lookupAttribute gained a final
  fallback for the `(Site|Enterprise|IndustrialComplex|ProcessPlant|
  PlantArea|PlantSection|PlantSystem|PlantTrain)(IdentificationCode|
  Name)` family: resolve from the document's carriers ONLY when they
  all agree on one value (memoized per document). Multi-system files
  with differing codes stay unresolved — never guess. Official parity
  regression-tested: 19 "D-20" texts on sheet 08, same as the pack's
  SVG.
- **2026-08-22** Profile break-label placement fixed (two bugs, found via
  A/B against the pack's official SVG renderings). (1) Multi-line
  LabelTemplate values were split into per-line primitives stacked
  DOWNWARD from the template anchor; a bottom-aligned label block must
  grow UPWARD (official baselines −14.3/−11 vs our −11/−6.38 — the
  second line collided with the break symbol's arrow wings). Now ONE
  multi-line text primitive per template; layoutTextLines block-aligns
  it per vAlign in every renderer. (2) Whitespace parity: real data pads
  label lines (DISC_EXAMPLE-14-12's BreakValue2 second line carries 48
  leading spaces); browsers collapse that whitespace when rendering the
  official SVGs, but CanvasKit drew the literal space glyphs — shoving
  the line ~44mm sideways onto the pump. layoutTextLines now trims each
  line, keeping canvas, SVG, PDF and hit-test on the browser-collapsed
  geometry. Regression-tested against the official sheet-08 anchors and
  the sheet-12 padding. Known accepted delta: our line spacing is the
  global 1.4× vs the official tool's 1.0× for these labels (top line
  ~1.3mm higher).
- **2026-08-22** Validation rule ids re-categorized and the connectivity
  rule set expanded (director-approved). Neither the DEXPI 2.0 spec
  (searched, 1070 pp) nor DEXPI_XML_Schema.xsd defines an error-code
  catalogue — the XSD is the generic serialization meta-schema (lexical
  id/name-reference patterns + xsd:ID/IDREF only) — so the app keeps its
  own stable taxonomy, prefixed by category: **SCH** (schema), **GFX**
  (graphics), **CON** (connectivity), **META** (meta data). Legacy
  mapping: V01→SCH-001, V02→SCH-002, V03→GFX-001, V04→GFX-002,
  V05→CON-001, V06→GFX-003, V07→CON-002, V08→META-001, V09→META-002.
  New rules: SCH-003/SCH-004 enforce the XSD's identifier and
  reference-token patterns (DOMParser doesn't); CON-003 unconnected
  nozzles (info — spares are legitimate; flags Nozzle17/18/19 on the
  reference P&ID); CON-004 nominal-diameter mismatch across a
  connection's two nodes — deliberately NOT checked on segment endpoint
  references (a PipeReducer inside a segment legitimately changes DN;
  reference_pid seg 5/7 proved this) and only like representations are
  compared (numeric vs numeric, text vs text — DISC sheets mix "14″"
  text with numeric mates; the one real DISC finding, 14″ vs 1400, is
  a genuine inconsistency in the official example); CON-005 piping-class
  change between segments without a PropertyBreak (info; suppressed when
  either segment contains one). The panel gained a category filter and a
  per-rule **severity override** editor (Default/Error/Warning/Info/
  Ignore — prior-art viewer parity), persisted in localStorage
  (`src/state/validation/`), applied by `applySeverityOverrides` to the
  panel, tab count, auto-focus, and the CSV export (which now carries a
  category column). Raw findings stay untouched on the document; the
  overrides map at render/export time, so changing them never re-parses.
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
- [x] Rule-based validation, now fourteen rules in four categories with
      per-finding suggestions (see the 2026-08-22 taxonomy entry in the
      decisions log for the legacy V01–V09 mapping): SCH-001 duplicate
      ids (aggregated per id), SCH-002 dangling refs, SCH-003 invalid id
      syntax, SCH-004 invalid reference syntax, GFX-001 unknown shapes,
      GFX-002 undrawable connectors, GFX-003 missing diagram extent,
      CON-001 flow items missing source/target, CON-002 orphaned piping
      nodes, CON-003 unconnected nozzles, CON-004 nominal-diameter
      mismatch, CON-005 piping-class change without PropertyBreak,
      META-001 required EngineeringModel meta data, META-002
      unresolvable template attribute references. **Parity with the
      prior-art viewer's run on reference_pid.xml is unit-tested**
      (same 2 errors: missing ExportDateTime + NominalCapacity(Volume);
      same orphans PipingNode60/61). Validation panel: severity summary
      chips, severity + category filters, collapsible rule groups,
      suggestions, CSV button, jump-to-object, per-rule severity
      overrides (Default/Error/Warning/Info/Ignore, persisted);
      auto-expands when a loaded document has findings (panel content
      mounts lazily — a collapsed node would go stale)
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
- [x] SignalConveyingFunctionTypeRepresentation line styling (2026-08-22,
      src/lib/dexpi/signalLines.ts) — see the decisions-log entry; the
      official convention (recovered from the pack's SVGs) differs from
      the prior-art viewer's E/O glyph invention
- [ ] Profile validation, narrowed after M10 (which covered the
      DEXPI×profile cross-check half: extension class ancestry feeds
      MDL-007, instances resolve in labels/Inspect). Remaining:
      (a) self-validation of a loaded DiscProfile.xml (the prior-art
      PRF-E01…E05 territory: symbols without variants, malformed
      conditions/templates); (b) extension-attribute checking — the MDL
      walker skips all DiscProfile/-prefixed names, but the profile
      declares them (ClassExtension/DataProperty + allowed-property
      whitelist), so a misspelled DiscProfile/ItemTagg passes silently
      today; the parsing infrastructure for both now exists — optional
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

- **2026-09-03** "Custom" highlight mode (director): a fifth Highlight-by
  option for filters the four built-in classifications don't cover.
  `src/lib/dexpi/customHighlightFilter.ts` defines `CustomHighlightFilter`
  (label, colorHex, enabled, a `conditions` list AND'ed together for
  simple mode, and an `expression` string for advanced mode — BOTH always
  kept, not a strict discriminated union, so toggling the mode never
  discards the other one's work) and `matchCustomFilters(nodes, filters)`,
  which `useCanvasStage.ts` and `asViewedExport.ts` both feed into the
  SAME `classification: Map<objectId, PaletteColor>` the built-in modes
  already draw through — no new drawing path.
  - Fields: `TYPE`, `ATTR('name')`, `ID`, `XPATH`, `PERSISTENT_ID`
    (matches ANY of a node's persistent ids — one per Context). Operators:
    Contains / Does not contain / Equals / Does not equal, case-insensitive;
    Equals/Does not equal treat `*` as a `.*` wildcard (escaped-then-
    anchored glob → RegExp). An object missing the field entirely never
    matches, even under "does not…", so a negated condition only lights up
    objects that actually carry the field. XPath gets "this object + all
    children" for free from the wildcard, no special-casing needed:
    positional xpaths are ancestor-prefixed strings
    (`/Model/Object[2]/Components[1]/Object[4]`), and the trailing `]` on
    every indexed segment rules out false prefix hits (`Object[1]*` does
    not also match sibling `Object[11]`).
  - Advanced mode: a hand-written recursive-descent parser
    (`parseFilterExpression`) for `&`/`|`/parens over conditions like
    `TYPE = 'x' & (ATTR('FluidCode') = 'A*' | ATTR('FluidCode') != 'B*')`.
    A parse error surfaces inline under the filter instead of throwing —
    the filter just matches nothing until fixed. Switching a filter to
    advanced for the first time auto-fills the expression from its simple
    conditions (`conditionsToExpression`), doubling as a live syntax
    example. "Does not contain" has no dedicated advanced keyword: it's
    `!=` with the value wrapped in `*…*`, which the glob evaluates
    identically.
  - Priority = list order: filters apply in order and a later one
    overwrites an earlier color assignment for the same object (`Map.set`
    last-wins), matching the up/down reorder controls in the editor
    (`CustomHighlightFilterRow.tsx` / `CustomHighlightConditionRow.tsx` /
    `CustomHighlightEditor.tsx`, all under `src/components/panels/`). An
    inline banner warns when 2+ enabled filters match the same object.
  - Save/Load as JSON (`exportCustomFilters`/`importCustomFilters`,
    `downloadBlob` + a hidden file input — same mechanism as the
    Shortcuts keymap export). The file format is versioned
    (`FILTER_FILE_VERSION = 2`); a version mismatch or malformed shape
    fails with a clear message rather than attempting to migrate.

### M10 — Model-driven validation (core landed 2026-08-22)

Validate every object against the DEXPI class model itself instead of
hand-written per-fact rules. The class tables exist machine-readable in
the repo three times over: the EA/XMI information model in
`refrences/dexpi-2.0-supporting-materials.zip` (authoritative — a
one-off generator turns it into `src/lib/generated/metaModel.ts`), the
prior-art viewer's `metaModel.js` cardinality tables (proven shapes),
and DiscProfile.xml's own ClassExtension/DataProperty declarations +
allowed-property whitelist (so profile-added attributes validate with
the same walker, closing the long-open profile-validation item).

- [x] XMI → TS metamodel generator (scripts/generateMetaModel.mjs, run
      via `npm run generate:metamodel`; source refrences/Dexpi-2.0.xmi,
      extracted from the official supporting materials): 484 classes,
      89 enums, supertype chains, per-property kind/target/lower/upper.
      Output is VERSIONED (src/lib/generated/metaModel-2.0.ts); the
      registry in src/lib/dexpi/metaModel.ts detects the version a
      document declares via its data.dexpi.org Import URIs and picks
      the matching tables — a declared version without tables falls
      back to the newest and reports MDL-000, so a future 2.1 file is
      never silently judged by 2.0 rules (director's requirement)
- [x] Generic walker rule family (src/lib/dexpi/modelValidation.ts):
      MDL-000 version fallback, MDL-001 unknown class, MDL-002 unknown
      attribute, MDL-003 missing required property (RETIRES META-001,
      which it generalizes), MDL-004 illegal enum literal / wrong-enum
      reference, MDL-005 unknown reference property, MDL-006
      cardinality, MDL-007 reference-target class mismatch (chases
      PROFILE-DECLARED extension ancestry — DiscProfile.classSupers
      parses ConcreteClass/AbstractClass superTypes, so
      WedgeGateValve→OperatedValve targets validate correctly; unknown
      extensions are skipped, never guessed), MDL-008 unknown component
      property, MDL-009 abstract class instantiated. New "Model"
      category in the severity config. Value-KIND checks (string vs
      double) deliberately skipped for now — false-positive prone
- [x] Tuning pass done: DISC sheets (with profile) are MODEL-CLEAN
      (zero MDL findings once extension ancestry landed — the initial
      35-55 MDL-007/sheet were all extension-typed targets);
      reference_pid yields 10 genuine errors (ExportDateTime + 8×
      Shape.SymbolRegistrationNumber missing — real spec findings the
      hand-written rules never covered; parity test updated). Findings
      flow into the severity config, Properties Issues, Inspect cards
      and CSV automatically
- [ ] Later by-product: attribute fill-rate/completeness dashboard

Scope note: covers per-object SHAPE only — cross-object semantics
(CON-*) stay hand-written.

### M11 — Conceptual Model Tree & Diagram Tree panels ✅

- [x] Two new dockable panels (ids `conceptualModelTree`/`diagramTree`,
      ribbon Panels toggle, T+C / T+D; not in the default layout;
      alongside the existing Explorer/Properties, not replacing them —
      director's explicit call after an earlier attempt at reshaping
      the Explorer itself was reverted) mirror the file's raw
      `ConceptualModel`/`Diagram` XML containment exactly: one
      expandable group row per `<Components property=…>` bucket (e.g.
      `ActuatingSystems`, `PipingNetworkSystems`), one row per object
      underneath, nesting arbitrarily deep — instead of the Explorer's
      flattened containment. Both start fully collapsed and expand to
      reveal whatever the app's global selection currently is.
- [x] `plantModel.ts`: `PlantNode` gained `ownerProperty` (the owning
      `<Components property=…>` name, captured via a new
      `componentObjectsWithProperty` walk helper) and `buildPlantModel`'s
      second parameter became `PlantModelBranch | boolean`
      (`"conceptual" | "diagram" | "full"`, booleans still accepted for
      the existing call sites) so a Diagram-only walk
      (`buildPlantModel(root, "diagram")`, memoized as
      `diagramPlantModel`) is possible without touching the existing
      conceptual/full paths. New pure `groupByProperty(plant)` inserts a
      synthetic group `PlantNode` per distinct `ownerProperty` between a
      node and its children — same shape as an earlier, since-reverted
      `restructureByPlantStructure` transform, but keyed on XML property
      instead of the plant-breakdown overlay. Not wired into the
      existing Explorer/`TopologyPanel`.
- [x] Each panel embeds a bottom section (`ObjectDataView`, new,
      `src/components/panels/objectDataView/`) showing the selected
      row's Data table (extracted from `PropertiesPanel.tsx` into a
      shared `DataTable` in `PropertiesSections.tsx` — no behavior
      change there) and an **Inverse References** list: `referencedBy`
      entries grouped by `` `${ReferencingTypeName}.${property}` ``
      (e.g. `AttributeRepresentation.Object [2]`), single-target groups
      inline, multi-target groups collapsible (native `<details>`). A
      new `PlantNodeChip` (`PropertiesSections.tsx`) resolves against an
      explicit `PlantModel` instead of the global document's conceptual
      model, since Diagram Tree ids aren't in it.
- [x] Cross-linking: `ConceptualModelTreePanel` reuses `PlantTree`/
      `plantTreeFilter`/`useTreeSelection` exactly like `TopologyPanel`
      (conceptual ids are already valid global selection targets).
      `DiagramTreePanel` cannot reuse `useTreeSelection` — Diagram rows
      carry synthetic positional-xpath ids (real Diagram objects have no
      `id` in DEXPI files) that would corrupt global selection — so it
      keeps its own local `selectedDiagramId` and a small
      `crossLinkTarget` helper reading a row's own `Represents`/`Object`
      reference; clicking a row also calls the global `setSelectedObject`
      when that reference resolves. Reverse sync (an external selection
      revealing itself in the Diagram Tree) looks up
      `diagramModel.referencedBy.get(selectedId)`, preferring a
      `Represents` referrer over `Object`, and skips re-picking when the
      row already shown already represents the same target (so it
      doesn't fight a user's choice among multiple representations).
- [x] Row content, resizable-column follow-up (director's first real-app
      pass, several rounds): the main column shows the bare **type**
      (matching the raw XML property-grid look) and the resizable side
      column shows the resolved **value/tag** — the reverse of the
      Explorer's name-first layout — blank on synthetic property-group
      rows where they'd be identical. `SegmentNumber` added to
      `plantModel.ts`'s `LABEL_PRIORITY` (confirmed as the real DEXPI
      attribute on `PipingNetworkSegment` against `reference_pid.xml`)
      so segment rows get a value there too, benefiting Explorer's own
      labels the same way the other `…Number` fields already do.
- [x] Resizable UI, two new pieces: `useDragResize` (pointer-drag width/
      height with min/max clamping, no persistence) and `TreeDataSplit`
      (the tree/Data-Inverse-References vertical split, plus the tree's
      type-column width feeding `--pt-type-col-width` to `PlantTree`'s
      `resizableTypeColumn` rows). `PropertiesSections.tsx`'s `DataTable`
      gained the same treatment for its attribute-name/value columns
      (shared with the plain Properties panel too — the attribute name
      now wraps instead of truncating, so a long one is never fully
      hidden regardless of width). All three drag handles ended up as a
      persistent thin line (not just a hover-only strip) after the first
      version proved too thin/invisible to find — thickens and turns
      blue on hover, wide invisible grab zone either side.
- [x] Aggregate Data values (`values.ts`'s generic `"Type { a: 1, b: 2 }"`
      fallback for Stroke/Color/etc. — anything without a dedicated
      formatter) render as an indented multi-line block in `DataTable`
      (`prettyPrintValue`, brace/comma-driven — safe because
      `formatAggregate` never puts a literal brace or comma inside a leaf
      value) instead of one flattened line. Plain values (numbers,
      strings, PhysicalQuantity, …) pass through unchanged. Presentation
      only — `formatDataValue`'s string contract (drawing labels, CSV
      export, tooltips) is untouched.
- [x] Virtualized `PlantTree` (director noticed real scroll jank on a
      large, mostly-expanded PipingNetworkSystems subtree — no
      virtualization existed anywhere in this codebase, confirmed no
      `react-window`-type dependency either): the tree now owns its own
      scrolling and windows the row list to `OVERSCAN_ROWS` beyond the
      viewport, each row forced to a fixed `ROW_HEIGHT_PX` so the offset
      math stays exact — hand-rolled rather than a new dependency, since
      row height is uniform (indentation is padding, not height) and the
      math is simple. New shared `flattenVisibleNodes` (`plantTreeFilter.ts`)
      is the single source of truth for "visible row order," reused by
      both the windowing and `useTreeSelection`'s shift-range math (previously
      two separate traversals that could drift). The old scroll-into-view
      mechanism (`querySelector` a `data-object-id`, `setTimeout` to let
      newly-expanded rows render first) couldn't survive virtualization —
      an off-screen row simply isn't in the DOM. Replaced with a
      `revealRequest: {id, nonce} | null` prop `PlantTree` reacts to
      internally: computes the target's pixel offset directly from its
      flattened index (no DOM query, no timing hack), keyed on the nonce
      (not on the flattened list itself) so an unrelated expand/collapse
      elsewhere never re-triggers a scroll the user didn't ask for. This
      benefits **Explorer too** (shared component) — `TopologyPanel.tsx`
      moved to the same `revealRequest` pattern, dropping its own
      duplicate `containerRef`/`querySelector` version.
- [x] `npm run lint`/`npm run typecheck` clean throughout (checked after
      every round). `vitest` still can't execute in this sandbox
      (pre-existing Node-version/jsdom mismatch, Node 20 vs jsdom 30's
      required ^22/^24/≥26) and Playwright's Chromium download is
      blocked by the sandbox's network allowlist (403), with no system
      Chromium/sudo available for `--with-deps` either — verified
      instead via the dev server (every changed module serves 200, no
      esbuild/Vite import errors) plus hand-tracing the tree/grouping/
      virtualization logic. The director then actually ran the app and
      iterated several rounds from real screenshots (column swap,
      SegmentNumber, resize-handle visibility, scroll perf, indented
      values) — real usage this time, not just the sandbox's static
      checks.
- **2026-09-02** `profileLabels.ts` mirroring fix: `buildProfileLabelOverlays`
  was hard-coding `isMirrored: false` on a LabelTemplate's own transform
  instead of inheriting the placement's real mirror state — a mirrored
  ShapeUsage drew correctly but its overlay label (e.g. a TypeCode badge)
  used un-mirrored math, landing on the wrong side. Fixed: the label
  transform now spreads the placement's transform as-is. Verified against
  a reporter's real file by running the app's parse/scene-graph code
  offline (not guessed).
- **2026-09-02** Profile catalogue now resolves throughout Inspect and the
  Diagram Tree, not just the canvas (director/reporter round, several
  iterations against a real file with duplicate/rotated `ActuatingSystem`
  data): `stubCard()`/`buildObjectDiagram` (`objectDiagram.ts`) checked
  only the profile's published *instances* for an unresolved reference
  target — never its *symbol* catalogue — so a `SymbolUsage`'s `Symbol`
  reference always rendered as a false "unresolved target" even with the
  profile loaded. Now checks `profile.symbols` too, rendering a "profile
  symbol" card. That card's rows went from a bare variant/primitive count
  to the actual content — shape id, condition, and every primitive/
  LabelTemplate, each prefixed with its real DEXPI/profile class name
  (`Core/Diagram.Ellipse`, `Profile/LabelTemplate`, …) — via a new shared
  `src/lib/dexpi/profileSymbolSummary.ts` (`profileSymbolDetailRows`,
  `resolveSymbolReferenceName`), reused by the Diagram Tree's own
  References section. *Noted for later, not done*: representing each
  primitive/label as its own full graph node instead of rows on the
  parent card (bigger `buildObjectDiagram` change).
  Since a profile stub has nothing of its own to navigate into, `DiagramCard`
  gained `navigateId` (separate from its own `id`): a stub now re-centers on
  the real object that referenced it instead of being a dead end. Exposed a
  pre-existing wiring bug while landing this: `InspectPanel.tsx`'s
  `onNavigate={() => handleNavigate(placed)}` silently discarded whatever id
  `InspectCardView`'s click handler actually passed (always used
  `placed.card.id`) — harmless while a card's `id` and `navigateId` were
  always the same, but a stub's now legitimately differ, and navigating to
  a bare catalogue string like `"DiscProfile/ND0049"` (not a node in any
  plant model) made `buildObjectDiagram` return null, blanking the whole
  panel. Fixed to forward the actual id.
- **2026-09-02** Diagram-side navigation/identity follow-ups (same round,
  reporter's real file): (1) `plantModel.ts` gained
  `nearestRepresentedId(model, id)` — walks a node's own chain then its
  ancestors for the first `Represents`/`Object` reference target, i.e. the
  real conceptual object a diagram-side node (or its closest enclosing
  group) actually draws; `useInspectDiagram.navigate()` and
  `DiagramTreePanel`'s row-click now both use it (replacing
  `DiagramTreePanel`'s narrower, own-references-only `crossLinkTarget`),
  so clicking a bare `SymbolUsage` with no reference of its own
  cross-links to global selection via its enclosing group, in both
  panels symmetrically. Clicking a synthetic node in Inspect always
  re-centers Inspect on the exact node clicked first (an earlier version
  of this fix skipped straight to the represented object instead,
  regressing "expand into this node"); the global-selection nudge to the
  represented object is a separate, non-destructive side effect (a ref
  guard stops it resetting the local re-center that fired first). (2)
  Since `nearestRepresentedId` picks *a* real object a node represents,
  not necessarily the *exact* clicked node, a small dedicated store
  (`src/state/diagramReveal/`, deliberately separate from global
  `selectionState` — most Diagram-side ids are synthetic and would
  degrade Properties/canvas if pushed through there) lets Inspect ask the
  Diagram Tree to reveal that exact node directly. (3)
  `DiagramTreePanel`'s reverse sync (a selection made elsewhere revealing
  itself in the tree) only searched *inbound* Represents/Object
  references — never checked whether the selected id was simply one of
  its own diagram-node ids — so selecting a real-id diagram-only object
  (e.g. an `InstrumentationNodePosition`) elsewhere never revealed it in
  the tree; added a direct-match check ahead of the inbound search. (4)
  `PlantTree.tsx`'s hover tooltip showed a synthetic (positional-XPath)
  id under "ID:" — misleading, since it's an internal stand-in, not a
  real DEXPI id — now omitted there for synthetic ids (real ids stay,
  middle-elided past 60 chars: the shared tooltip widget, vendored
  prebuilt under `external/` and not editable here, only wraps at
  whitespace and would otherwise overflow its fixed-width box on an
  unbroken XPath). (5) New shared `IdentitySection`
  (`PropertiesSections.tsx`, factored out of `PropertiesPanel.tsx`) shows
  ID (omitted for a synthetic id)/Type/Persistent ID/XPath, now used by
  the Properties panel AND both tree panels' embedded `ObjectDataView` —
  XPath is always visible there, properly labeled, instead of only (or
  not at all) in the tooltip. (6) `ObjectDataView` gained an outgoing
  **References** section (it previously showed only inverse references),
  resolving each target in three steps — the panel's OWN model, then the
  document's ConceptualModel, then the profile catalogue (instance or
  symbol, expandable to the same detail rows as the Inspect card) — with
  an explicit "unresolved" marker only when none of them has it. The
  middle step is load-bearing for the Diagram Tree, whose model holds
  Diagram-branch objects only: every `Represents`/`Object` target is a
  ConceptualModel id (1110 of them in the reporter's file, none in the
  panel's own model), so a two-step version marked essentially every
  diagram row's reference falsely broken-red. Conceptual hits render as
  the existing `ObjectChip`, which navigates through GLOBAL selection —
  the panel's own `onSelect` expects a diagram-tree id. Also a prominent
  one-line "Symbol: ND0049" summary right under the header for a
  `Symbol`/`Shape`-carrying row, since that's the single most useful fact
  about an object otherwise described only by Position/Rotation/Scale.
  (7) The tree row's own resizable type column (right of the tree/
  vertical splitter) picks up the same resolved name when a row's label
  is nothing but its own type name — in EITHER spelling, bare
  (`SymbolUsage`) or qualified (`Diagram.ShapeUsage`), since
  `resolveLabel` falls back to the qualified one while the main column
  shows the bare one. Strictly additive: when no profile symbol resolves
  (a `Core/Diagram.ShapeUsage` pointing into the document's own shape
  catalogue rather than the profile's), the column keeps exactly the
  previous label rule. `PlantTree`/`TreeRow` gained an optional
  `profile` prop; both tree panels pass their loaded profile through.
  All verified against the reporter's real file by running the app's
  parsing/graph-building/resolution code directly (offline, not guessed);
  `npm run check` clean throughout. `vitest` still can't execute in this
  sandbox (same pre-existing Node/jsdom mismatch as M11's own entry
  above) — `objectDiagram.ts`'s signature changes are backward-compatible
  optional-parameter additions, so no regression is expected, but this is
  worth a real `npm run test` pass outside the sandbox.
- **2026-09-02** Diagram Tree → Inspect sync, the mirror of the above
  (director spotted the asymmetry: selecting in Inspect revealed the row
  in the Diagram Tree, but clicking a Diagram Tree row whose content only
  Inspect can show didn't move Inspect). `DiagramTreePanel.handleSelect`
  only pushed global selection when `nearestRepresentedId` found a real
  object, and Inspect's center is otherwise driven by its own panel-local
  state that nothing outside could reach — so a row with nothing
  representable anywhere in its chain moved nothing at all. Added the
  symmetric `src/state/inspectReveal/` store (same shape/rationale as
  `diagramReveal`): every Diagram Tree row click asks Inspect to center on
  the EXACT clicked id, and Inspect's handler also forces `showDrawing`
  on, since every Diagram Tree row lives only in the diagram-inclusive
  model — ignoring ids no model holds, i.e. `groupByProperty`'s synthetic
  `parent::Property` group rows (1638 of them in the reporter's file),
  which would otherwise force drawing mode on and blank the panel.
  Both directions now: exact node through the dedicated channel, nearest
  represented real object through global selection for Properties/canvas.
  `DiagramTreePanel`'s `selectionFromTree` ref keeps its own global-
  selection write from bouncing back through its sync effect, and its
  reveal effect is declared AFTER that sync effect so the exact requested
  row wins over the merely-representing one when both fire in one commit.
- **2026-09-02** Inspect's panel-local re-center is self-describing rather
  than effect-reset (`useInspectDiagram`, found in review of the round
  above). It used to be a bare id cleared by an effect on
  `[selectedId, showDrawing]`, with a "was that me?" ref so the panel's
  own writes (navigate()'s global-selection nudge, the reveal handler's
  `setShowDrawing(true)`) didn't wipe the center they had just set. That
  ref leaks: it must be consumed by exactly one later run of that effect,
  but a no-op write — forcing drawing mode that is ALREADY on — re-runs
  nothing, so the flag survives and swallows the NEXT genuine selection
  change, freezing Inspect on a stale center. `localCenter` now records
  the context it is valid for (`forSelectedId`/`forShowDrawing`/
  `forDocRevision`) and is simply ignored once any of them moves on — no
  flag, no effect ordering to get right. A small cleanup effect nulls an
  inactive one so it can't re-activate later if the selection happens to
  return to the value it was recorded for.

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
- **2026-08-27** Heat tracing graphical convention, director-supplied
  (dash-dash or dash-dot-dash line style throughout), three placement
  cases per base-symbol kind:
  1. **Pipeline**: shown offset to the right-hand side of the line, in
     the direction of flow.
  2. **Instrument**: shown outside the base instrument symbol,
     encompassing it (e.g. a dashed ring around a PSV balloon — see the
     D-20/PSV-0002 reference image, AP110/AP310/AS200/AD750 tie-in
     labelled above it).
  3. **Piping component**: shown below the base piping-component symbol,
     spanning its width; where the label layout permits, the base symbol
     should be rotated/mirrored so its heat-trace mark stays contiguous
     with the connecting pipe's trace.
  This refines the 2026-08-20 addendum in the M9 section
  (`buildHeatTraceSymbolOverlays`): the inline-component overlay (dashed
  line below the symbol when horizontal, to its right when rotated
  ~90°/270°) already matched case 3. Case 1 matches the existing
  pipeline lateral-offset overlay (2026-08-21 entry) in intent;
  reconcile the offset SIDE against this "right-hand side in flow
  direction" wording when that code is next touched.
  **Case 2 implemented same day**, then corrected same day against real
  DISC data: `buildHeatTraceSymbolOverlays` first branched on the
  represented object's DEXPI class (`Plant/Instrumentation.*`), but the
  bundled example (`public/examples/DISC_EXAMPLE-14-13.xml`) showed this
  is wrong — its D-20/PSV-0002 (the exact reference image case) is
  `SafetyValveOrFitting1`, type `Plant/Piping.SafetyValveOrFitting`
  (physical piping component, per the 2.0 model), drawn with the plain
  round DiscProfile symbol `ND0248B` (a single 6mm-radius
  `Core/Diagram.Ellipse`) — so a class check routed it to the side-line
  path and it never got a ring. **The decision is shape-based, not
  class-based:** `isRoundShape` (heatTracing.ts) looks at the resolved
  catalogue shape's own primitives — if a Circle/Ellipse primitive's
  bounding box covers ≥60% of the shape's overall local bounds in both
  axes (`ROUND_SHAPE_COVERAGE_RATIO`), the symbol reads as a round
  "instrument bubble" and gets the ring; a bowtie/polygon valve body
  does not, regardless of its DEXPI class. This matches the actual P&ID
  drafting convention the director's spec describes — instrument-style
  round symbols get encompassed, everything else gets a side-line — and
  correctly covers both `Plant/Instrumentation.ProcessInstrumentation-
  Function` balloons and `Plant/Piping.SafetyValveOrFitting` drawn
  round. The ring itself is a `CirclePrim` centered on the symbol's
  world bounds, transparent fill, radius = half the larger bound
  dimension + the trace lateral offset (reuses the existing
  style/stroke resolution, so profile `LineStroke` still wins over the
  viewer defaults). `sceneGraph.ts` passes its `shapes` map into
  `buildHeatTraceSymbolOverlays` alongside the existing `boundsOf`
  callback. `CirclePrim`/`EllipsePrim` and their dashed-stroke rendering
  already existed in all three renderers (canvas, SVG, PDF), so no
  renderer changes were needed. Unit-tested (`heatTracing.test.ts`,
  "instrument heat-trace overlays"): a traced round-symbol instrument
  gets exactly one ring sized/centered on its bounds, an untraced
  sibling gets none; manually verified against a
  `Plant/Piping.SafetyValveOrFitting` + `ND0248B`-shaped fixture
  (vitest itself can't run in this sandbox — Node 20 vs. jsdom 30/undici
  incompatibility, pre-existing and unrelated to this change).
  **Second correction, same day (director caught it live: the D-20/
  PSV-0002 balloon still rendered as a plain solid circle, no ring):**
  the shape-based check above was right, but `buildHeatTraceSymbolOverlays`
  still only processed `role === "symbol"` nodes. In the real DISC file
  the PSV's `ND0248B` `Profile/SymbolUsage` sits INSIDE a
  `Core/Diagram.Label` group (it carries the tag text "PSV/0002"), so
  `walkGroup` tags it `role: "label"` — and the overlay builder silently
  skipped it. Fixed: the node-kind filter now also accepts `role ===
  "label"`, but only draws the ring when the shape is round (`isRound`
  computed once up front); a non-round label placement still gets no
  overlay — there's no established convention for what a dashed mark
  under an arbitrary label shape (a tag box, say) would mean, so that
  stays undrawn rather than guessed. Regression-tested: a Label-wrapped
  round balloon (mirroring the real `SafetyValveOrFitting1` structure)
  now rings; a non-round Label placement still renders nothing.
  **Third correction, same day (director spotted a `PropertyBreak` — the
  wing symbol between AP110/AS200 and AP310/AD750 — drawing its own
  dashed side-line, and asked whether that was right):** it wasn't.
  `PropertyBreak2` in the bundled example carries no `HeatTracingType` of
  its own — only `DiscProfile/BreakValue1`/`BreakValue2` — it's a
  logical area/piping-class transition marker, and only lands in
  `tracedIds` because it's nested as an `Items` sibling of
  `SafetyValveOrFitting1` inside the traced `PipingNetworkSegment31`
  (the same "a segment classification covers everything nested inside
  it" inheritance rule that correctly traces real pipes/valves/nozzles).
  That inheritance is right for the *pipeline's own* lateral-offset
  overlay (case 1 — it already runs through the break point
  uninterrupted via the parent pipe geometry) but wrong for the
  *symbol*-level overlay: `buildHeatTraceSymbolOverlays` gave the
  break's own wing symbol (`ND0007`) a dashed mark purely because its
  `objectId` was in `tracedIds`, misrepresenting a logical annotation as
  traced hardware — the same category of mistake already ruled out for
  `DiscProfile/InformationModel.HeatTracingBreak` (excluded from the
  start; see the file-header comment). Fixed: `buildHeatTraceSymbolOverlays`
  now takes a `typeOf` callback (`sceneGraph.ts` threads it from the
  `objectsById` map, alongside `boundsOf`/`shapes`) and skips any node
  whose represented-object type ends with `PropertyBreak`
  (`isPropertyBreakType`, mirroring `validation.ts`'s `hasPropertyBreak`
  pattern) before any ring/side-line decision — regardless of shape.
  They stay in `heatTracedIds` itself (untouched), so the Highlight
  panel's "Heat traced" tint on a break sitting inside a traced run is
  unaffected — only the dedicated dashed mark is suppressed.
  Regression-tested: a traced segment's valve sibling still overlays,
  its `PropertyBreak` sibling gets nothing.
- **2026-08-31** Multi-level heat-trace inheritance + `NoHeatTracingSystem`
  override (director's clarification of an upcoming DISC Profile addendum —
  not yet published, so this is the viewer getting ahead of the profile
  based on the director's description, not a profile-file change). Previous
  behavior: `collectHeatTracedIds` did a flat `querySelectorAll` over every
  `Object` in the document, and any object with an explicit non-none
  `HeatTracingType` unconditionally added itself + ALL nested descendants,
  regardless of a descendant's own classification — so a lower-level
  `NoHeatTracingSystem` override was silently ignored, and a `NULL` value
  more than one level below the nearest classified ancestor never inherited
  (there was no true ancestor walk, just one level of "parent classified →
  child added"). New rule, confirmed by the director: `HeatTracingType` set
  to any of the four active enum literals (`ElectricalHeatTracingSystem`/
  `HeatTracingSystem`/`SteamHeatTracingSystem`/`TubularHeatTracingSystem`)
  covers that object and everything nested below it; `NULL`/absent inherits
  the nearest ancestor's EFFECTIVE value, climbing as many levels as
  needed, defaulting to untraced when no ancestor has one set; and
  `NoHeatTracingSystem` at any level blocks inheritance for that object and
  its descendants until something below re-classifies with an active type.
  `collectHeatTracedIds` (`heatTracing.ts`) is now a single top-down
  recursive walk from the Model's top-level `Object` children (via
  `directChildrenByTag`/`componentObjects`) threading an `inherited: boolean`
  down through the tree — the walk naturally implements "climb to the
  nearest ancestor with a value" without an explicit upward search, since
  ineligible classes (signals, etc.) just pass the inherited state through
  unchanged rather than resetting it. `isHeatTraceEligible`'s existing class
  list already covered the DISC Profile's promised additions (`Nozzle`,
  `ProcessInstrumentationFunction` were already accepted local names, `Pipe`
  via the `Plant/Piping.` prefix) — no change needed there. Also added:
  `IsHeatTracingSafetyCritical`, a new boolean DISC Profile attribute
  alongside `HeatTracingType`. No inheritance rule was specified for it, so
  `collectHeatTracingSafetyCriticalIds` only picks up an object's own
  explicit `true` value, filtered to ids already in `tracedIds`. Both sets
  are threaded onto `SceneGraph` (`heatTracedIds` /
  `heatTracingSafetyCriticalIds` in `types.ts`, computed in
  `sceneGraph.ts`) — the safety-critical set has no consumer yet (no
  highlight mode, no validation rule); wiring that up is a follow-up once
  there's a concrete UI ask. Unit-tested (`heatTracing.test.ts`): inheritance
  through two NULL levels from a top ancestor, override-then-nothing,
  override-then-re-classify-below, and no-ancestor-defaults-to-untraced;
  plus safety-critical collection ignoring untraced and non-flagged ids.
  All existing heat-trace fixtures re-verified by hand against the new
  algorithm (vitest itself can't run in this sandbox — Node 20.20.2 vs.
  jsdom 30's `^22.22.2` engine requirement, pre-existing and unrelated to
  this change). `tsc --noEmit` and `biome check` both pass.
- **2026-08-31** Five heat-trace placement/shape corrections, director's
  direct instruction (not yet visually verified in this sandbox — see the
  Node/jsdom note above; hand-traced against the geometry instead):
  1. **Always bottom/right, never derived from travel direction.** The
     connector-line overlay (`buildHeatTraceOverlays`) used to offset by the
     LineStroke's own signed `LateralOffset` relative to each pipe's point
     order — a right-to-left or bottom-to-top connector could land the trace
     on the top/left instead. New `resolveAbsoluteLateralOffset` picks the
     sign (once per polyline, from its longest/dominant segment, so a
     multi-bend run still offsets as one continuous parallel curve rather
     than flipping side-to-side) so the result is always toward bottom for a
     horizontal-dominant run and right for a vertical-dominant one; only the
     magnitude comes from the profile/default now, never the sign. This is a
     deliberate override of the 2026-08-21 entry's "profile LineStroke sign
     wins" behavior — flagged here in case that's not what was meant.
     `buildHeatTraceSymbolOverlays`'s side-line was already bottom/right-only
     (always adds to `maxX`/`maxY`), so it needed no change for this part.
  2. **Round vs. straight line is now a named-symbol allowlist, not shape
     geometry.** `isRoundShape` (silhouette-coverage heuristic) is replaced
     by `isRoundTraceSymbol`: exactly `ND0023`/`ND0248A`/`ND0248B`
     (`ShapeDef.name`, which already carries the DISC symbol name for
     profile-resolved shapes) get the encompassing ring; everything else —
     including a BallValve whose body happens to be drawn round — gets the
     straight side-line. `isBallValveType` is a belt-and-suspenders guard on
     top (never round even if a shape name coincidentally matched).
  3. **OffPageConnector never gets a mark.** New `isOffPageConnectorType`
     (local name ending `OffPageConnector`) is skipped in
     `buildHeatTraceSymbolOverlays` exactly like `PropertyBreak` — it can
     still sit in `heatTracedIds` (so Highlight-panel tinting is unaffected),
     it just never draws its own dashed ring/line.
  4. **DoubleBlockAndBleedValve / …AndCheckValve trace their flat side.**
     These bodies (DiscProfile `ND0004`/`ND0005`, DISC RDL names starting
     "Modular Valve …") have a bleed-port stub that pushes one bounding-box
     side far out (verified against the real profile geometry: both symbols
     have `MinY=-9` at the stub, `MaxY=2` at the flat body edge). Tracing the
     default max side would land the line on the stub. New `isMaxSideFlat`
     compares the shape's own LOCAL bounds (pre-transform, via the existing
     `extendLocalBounds`) to decide whether MIN or MAX is the flat side, and
     `buildHeatTraceSymbolOverlays` uses that side instead of always-max for
     `isDoubleBlockAndBleedType` objects only. Local axes are treated as
     mapping straight onto world axes (no rotation applied) — consistent
     with how `computeSceneBounds` already treats polyline/polygon shape
     bounds (ignores rotation entirely, per its own "conservative"
     doc-comment), but means a rotated instance's flat side isn't
     re-derived precisely; flagged as a known limitation pending a real
     rotated example to verify against.
  5. **Flange/plug-on-valve placement is unchanged by design.** No
     class-specific code was added for flanges or plugs — they were never
     round-eligible (allowlist-only now) and always got the standard
     `DEFAULT_SYMBOL_TRACE_WIDTH_MM`/offset side-line; the new
     DoubleBlockAndBleed special case is gated strictly on
     `isDoubleBlockAndBleedType` so it can't leak onto a neighboring
     flange/plug symbol.
  Tests added in `heatTracing.test.ts`: a reversed-order horizontal
  connector still traces on the bottom; the profile-stroke test now expects
  magnitude-only (sign always bottom/right); a BallValve reusing an
  `ND0248B`-named shape still gets a straight line; a traced OffPageConnector
  gets no overlay at all; a synthetic DoubleBlockAndBleedValve shape with the
  bleed stub mirrored onto the MAX side traces its MIN side instead of the
  plain default. `tsc --noEmit` and `biome check` both pass.
- **2026-08-31 (same day, director caught it from a real document screenshot):**
  the "always bottom/right" fix above was wrong for a bent (L-shaped) pipe —
  the vertical leg traced on the LEFT instead of the right. Root cause: my
  first implementation (`resolveAbsoluteLateralOffset`) picked ONE sign for
  the entire polyline from its longest segment, then applied that single
  sign uniformly via `offsetPolyline`'s existing shared-`offsetMm` design.
  For an L-bend where the horizontal leg is longer, the sign was chosen to
  put THAT leg on the bottom — correct for the horizontal leg, but the same
  sign, applied to the vertical leg's own (different) normal direction,
  landed it on the left instead of the right. Fixed by moving the bias
  choice INSIDE `offsetPolyline` and making it per-segment: each segment now
  independently keeps or flips its own unit normal to whichever of the two
  perpendicular directions has a non-negative x+y component, rather than
  sharing one sign across the whole run. `resolveAbsoluteLateralOffset` is
  deleted — no longer needed since the bias lives in the core geometry
  function now. Verified this doesn't reintroduce a miter spike on ordinary
  bends: two perpendicular segments both biased into the bottom-right
  quadrant produce compatible (non-opposing) normals, so the existing miter
  math still joins them cleanly (hand-traced: a (0,0)→(10,0)→(10,10) bend
  now offsets to (0,1)→(11,1)→(11,10), a clean corner, not a spike). The one
  existing near-180°-reversal test (`clamps near-reversal bends instead of
  spiking`) still passes — hand-traced the exact numbers; the bias happens
  to resolve that particular case into a small clean miter rather than
  needing the explicit clamp path, but the assertion only checks the result
  stays bounded, which it does. Updated the direct `offsetPolyline` unit
  tests for the new "magnitude only, always bottom/right" contract (the old
  sign-relative-to-travel-direction premise no longer holds) and added two
  regression tests: an L-bend traces bottom AND right on its two legs, and a
  long vertical leg with a short horizontal leg (mirroring the reported bug
  more closely) keeps the vertical leg on the right despite being the
  dominant segment.
- **2026-08-31 (same session):** two more director corrections:
  1. `MeasuringLineFunction` (a physical impulse/sensing line) now inherits
     heat tracing from a traced parent — added to `isHeatTraceEligible`
     alongside the existing classes. It's distinct from a logical
     `SignalConveyingFunction`, which still never carries or inherits a
     classification. Fixture/tests in `heatTracing.test.ts` updated: `Sig1`
     (a `MeasuringLineFunction` nested in the traced `Seg1`) now expects a
     traced overlay instead of asserting it stays untraced.
  2. The default heat-trace dash pattern is shortened from `[2.4, 1.6]` to
     `[1.6, 1.0]` mm per director feedback. Confirmed first: DISC/DEXPI has
     no published DashArray example for the heat-trace LineStroke (same gap
     noted in the 2026-08-21 entry), so this was always a viewer-only
     aesthetic default, free to adjust without touching spec compliance.
     Adjusted again same day to `[1.0, 1.0]` per further director feedback.
- **2026-08-31 (same session, director flagged from a real-document
  screenshot — a ball valve + integrated bleed-branch symbol with an
  instrument ring above it):** two more corrections:
  1. **Instrument ring width.** The screenshot showed the ring around a
     traced instrument bubble noticeably heavier than the pipe's own trace
     line beside it. Researched before changing anything: real
     `ConnectorLine` strokes (`primitives.ts` `parseStrokeAggregate`, an
     explicit per-element `Data property="Width"`, default
     `DEFAULT_STROKE_WIDTH_MM = 0.25`) are uniformly **0.25mm** across every
     bundled real DISC example drawing (piping and instrument/signal lines
     alike) — there's no per-pipe variation to match in practice, and no
     existing mechanism maps a symbol back to "the pipe it's mounted on"
     (would need a real object-graph walk: symbol → enclosing
     PipingNetworkSegment/System → that segment's own connector scene nodes
     → their stroke width; doesn't exist anywhere yet). Building that
     lookup for a value that's constant in every real file would be
     over-engineering, so `DEFAULT_SYMBOL_TRACE_WIDTH_MM` (used for every
     symbol ring/side-line, `heatTracing.ts`) is simply changed from `0.35`
     to `0.25` to match.
  2. **Flat-side placement generalized beyond DoubleBlockAndBleedValve.**
     The screenshot's ball valve has an integrated bleed/drain branch drawn
     as part of its OWN catalogue shape (not a separate object) pointing
     down; the bottom-default trace ran straight through it, and the actual
     flat side was above. The flat-side check (`isMaxSideFlat` against
     `localShapeBounds`) was gated to `isDoubleBlockAndBleedType` only —
     removed that gate entirely. It's now applied to every non-round
     straight-line symbol overlay unconditionally: a plain symmetric valve
     shape has `|localMin| ≈ |localMax|` on both axes, so `isMaxSideFlat`
     still resolves to the same bottom/right default as before (verified:
     no change to the existing GlobeValve/PropertyBreak fixtures' expected
     output) — only a shape with genuine asymmetry (a stub, branch, or
     off-center body) picks the other side. `isDoubleBlockAndBleedType` is
     now dead code and deleted. Added a regression test: a synthetic
     `Plant/Piping.BallValve` whose catalogue shape has a downward stub
     traces above it, not through it.
  `tsc --noEmit` and `biome check` both pass; vitest still can't run in this
  sandbox (same pre-existing Node/jsdom mismatch) — hand-traced the new
  test's numbers instead.
- **2026-08-31 (same session, three more director corrections from a
  DoubleBlockAndBleedValve screenshot — a T-shaped valve with an integrated
  bleed valve pointing down):**
  1. **Trace width is now one fixed constant everywhere, never derived from
     the traced pipe/symbol's own line width.** Director's explicit call —
     every heat-trace mark should read as one consistent style, not vary
     per component. `overlayStroke` no longer takes a per-call fallback
     width parameter; `buildHeatTraceOverlays` no longer passes the pipe's
     own `node.prim.stroke.width`. Both call sites (connector-line and
     symbol) now fall back to one shared `DEFAULT_HEAT_TRACE_WIDTH_MM`
     (renamed from the symbol-only `DEFAULT_SYMBOL_TRACE_WIDTH_MM` added
     earlier the same day) whenever the profile doesn't specify its own
     `LineStroke.Width`.
  2. **The flat-side fix from earlier today was still wrong for a rotated
     instance — found and root-caused from the screenshot.** The
     DoubleBlockAndBleedValve there has its bleed branch pointing DOWN, but
     `isMaxSideFlat` was reading the shape's LOCAL bounds and mapping them
     straight onto WORLD axes — an assumption already flagged as a "known
     limitation" in the first flat-side entry. Researched properly this
     time: the real ND0004/ND0005 catalogue geometry stubs out on local
     MinY (native "up"), so an instance rotated 180° to point the stub down
     (matching the screenshot) needs its ACTUAL rotation applied to know
     the flat side landed on world MIN Y (top) instead. Found the exact
     rotation formula already used by all three renderers (canvas
     `ctx.rotate`, SVG `rotate()`, and `flattenScene.ts`'s manual
     `transformPoint` for PDF export/hit-testing) — translate → rotate →
     scale/mirror, degrees unnegated, y-down space so positive rotation is
     visually clockwise — and reused it rather than re-deriving: exported
     `transformPoint` from `flattenScene.ts` (was module-private) and
     imported it into `heatTracing.ts`. New `resolveFlatSideIsWorldMax`
     identifies the shape's more-asymmetric LOCAL axis, then actually
     rotates that axis's flat-side point through the instance's real
     `UseTransform` and compares it against the transformed origin to see
     which WORLD side it lands on — correct for the 0/90/180/270°
     placements DEXPI symbols actually use. Also added `rotatedWorldBounds`
     (transforms the shape's local bounding corners the same way) and
     switched both the ring and the side-line to use it INSTEAD of the
     injected `boundsOf` callback, since `boundsOf` ultimately calls
     `computeSceneBounds`, which deliberately ignores rotation for
     polyline/polygon primitives (fine as a general scene-bounds
     approximation, provably wrong for this specific decision — verified
     by hand that a 90°-rotated symmetric valve's TRUE bounds are narrower/
     taller than the rotation-ignorant approximation, e.g. a 4×2 shape
     becomes 2×4, not 4×2 again). Caught and fixed a real bug while
     verifying by hand: the first version of `resolveFlatSideIsWorldMax`
     had no tie-break for a shape with equal (typically zero) asymmetry on
     both local axes — it arbitrarily fell through to the Y-axis check
     regardless of placement axis, which for a ROTATED symmetric shape
     (e.g. the existing 90°-rotated `GlobeValve` test fixture) produced the
     wrong side. Fixed with an explicit epsilon guard
     (`COINCIDENT_EPSILON_MM`, already defined for point-dedup): no real
     asymmetry on either axis just returns the plain bottom/right default
     immediately, skipping the rotate-and-compare entirely. Re-verified by
     hand against the existing rotated `GlobeValve` fixture (still resolves
     to the right side, confirming no regression) and added a new
     regression test mirroring the actual screenshot: a DoubleBlockAndBleed
     shape with ND0004-shaped local bounds (stub at local MinY), placed
     with `Rotation=180`, traces above it (world MinY side) rather than
     through the now-downward stub.
  `tsc --noEmit` and `biome check` both pass; vitest still can't run in this
  sandbox (same pre-existing Node/jsdom mismatch) — every number above was
  hand-traced through the actual formulas rather than executed.
- **2026-08-31** Validation CSV export gains two columns: source XML line
  number and an XPath locator, per director request ("helps a lot" when
  cross-referencing a finding against the raw file). `ValidationIssue`
  carries only a string `objectId` (often `null` for unaddressable/aggregate
  findings) — never an `Element` — so both new columns are resolved at
  export time in `exportService.ts`, not stored on the issue itself.
  **Line number:** a parsed DOM `Element` carries no source position
  (confirmed: both `parseDocument.ts` and `discProfile.ts` use the plain
  `DOMParser`, no SAX/line-tracking parser anywhere in the repo), so
  `buildLineNumberIndex` does a separate one-time regex scan over the
  ORIGINAL raw XML text (`viewerState.get().file?.text`, already retained
  end-to-end since `readDocumentFile`/`fetchExampleDocument` — not a DOM
  re-serialization, which could reformat and silently break the
  correspondence) — matches every `<Object … id="…">` tag regardless of
  attribute order or attributes spanning multiple lines, keyed by id,
  first occurrence wins. **XPath:** `plantModel.ts` already had a private
  `elementXPath(el)` (positional path like `/Model/Object[2]/Components[1]/
  Object[4]`, 1-based, index omitted for an only child of its tag) used
  internally for synthetic diagram-object ids — just exported it rather
  than writing a second implementation. Resolves `objectId` → `Element` via
  a `root.querySelectorAll("Object[id]")` map built once per export.
  Refactored `exportIssuesCsv` to extract a pure, exported
  `buildIssuesCsv(issues, root, xmlText): string` (header + rows) from the
  `downloadBlob` side effect, so the new logic is directly unit-testable
  without mocking viewer state/browser download APIs — new
  `exportService.test.ts` hand-verifies both the line-number arithmetic and
  the exact `elementXPath` output against a small XML string with known
  line breaks (vitest itself still can't execute in this sandbox; every
  number was traced by hand through the actual regex/algorithm). New
  columns land between `objectId` and `message`:
  `rule,category,severity,objectId,line,xpath,message`. Both are blank for
  an issue with `objectId: null` or one whose id doesn't resolve to any
  element.
- **2026-09-01** `@tredespace/ui` bumped 0.0.56 → 0.0.80 (director);
  `external/tredespace-ui-0.0.56.tgz` replaced with
  `external/tredespace-ui-0.0.80.tgz`, `package.json`'s `file:` dependency
  path updated to match, `package-lock.json` regenerated. Also removed
  `external/tredespace-client.ts` — an unused SDK file the app never
  imported (confirmed: no reference anywhere in `src/`). `npm run
  typecheck` and `npm run lint` both still pass against the bumped
  version, no code changes needed on this side.
- **2026-09-03** Validation CSV `line`/`xpath` now locate the OFFENDING
  ELEMENT, not the object that happens to own it (director: a SCH-002 row
  said "Reference TargetItem points to missing object …" but pointed at the
  owning object's line/XPath — you want the `<References>` element itself).
  Three parts:
  1. `ValidationIssue` gains an optional `xpath` string — the positional
     XPath of the element the rule is really talking about. Deliberately a
     STRING, not an `Element`: the 2026-08-31 "issues stay plain data"
     stance holds (they live on `DexpiDocument`, get spread by
     `applySeverityOverrides`, and are read by panels/graph code that has no
     business holding DOM handles). Rules set it wherever a finer element
     exists — `<References>` for SCH-002/SCH-004/MDL-007, the `<Data>`
     element for MDL-004 and META-002's `AttributeName`, `<Components>` for
     MDL-006, the usage/line/nozzle/segment element for GFX-*/CON-*, the
     first occurrence for the MDL aggregates (`Aggregate` now carries that
     element alongside `firstId`, kept in sync so line and objectId always
     describe the same occurrence). Absent on rules that span many elements
     (the GFX-001 profile-symbol aggregate, MDL-000); those fall back to the
     `objectId` object as before.
  2. `elementXPath` moved `plantModel.ts` → `xml.ts`. It is a generic DOM
     helper with no plant-model semantics, and `validation.ts` /
     `modelValidation.ts` already import `xml.ts` — importing `plantModel.ts`
     from a rule module would have been a layer inversion.
  3. Line numbers are no longer id-keyed. The old `<Object … id="…">` regex
     scan could only ever locate id-bearing objects; `buildLineIndex` now
     keys EVERY element by its XPath, by pairing a raw-text scan of opening
     tags (`openingTagLines` — quote-aware, so `>` inside an attribute value
     doesn't end a tag; comments/CDATA/PIs/DOCTYPE skipped) with a top-down
     `xpathsInDocumentOrder` walk of the DOM. Both are pre-order, so the two
     sequences correspond element-for-element; on a length mismatch the index
     is dropped whole rather than emitting lines that are off by some
     elements. The walk computes XPaths top-down (one tag count per parent),
     O(elements) instead of `elementXPath`'s per-element ancestor+sibling
     re-walk. Side benefit: id-less objects (e.g. `Core/EngineeringModel`,
     which owns the `ExportDateTime` MDL-003 finding) now get a line and an
     XPath too — that row used to be blank in both columns.
  Verified: `exportService.test.ts` covers the reference element case, the
  quote/comment-aware line counting, and the objectId fallback, plus an
  end-to-end invariant over `reference_pid.xml` — every CSV row's reported
  line really contains the tag its XPath ends in (all rows located).
  `validationRules.test.ts` pins SCH-002's locator on the second
  `<References>` and META-002's on the fragment's `<Data>`.
- **2026-09-03** vitest CAN run in this sandbox after all — the blocker was
  never our code: `jsdom@30` pulls `undici@8`, which requires Node ≥ 22.19
  because it imports `markAsUncloneable` from `node:worker_threads` (absent
  in the sandbox's Node 20.20.2), so the fork worker died before any test
  ran. Running with a `--require` shim that stubs that one export
  (`NODE_OPTIONS="--require wtshim.cjs" npx vitest run`) executes the whole
  suite: 252 passed. Nothing was changed in the repo for this — the real fix
  is Node ≥ 22 in the dev environment (or pinning jsdom back). One
  PRE-EXISTING failure surfaced this way and is unrelated to the CSV work
  (confirmed by re-running it on a clean checkout):
  `objectDiagram.test.ts > collects outgoing references, children, and
  profile-instance stubs` expects a profile-instance stub card to be
  `navigable: false`, and it now comes back `true` — presumably drift from
  the 2026-09-02 "profile catalogue resolves throughout Inspect" round.
  Left untouched pending the director's call on which side is right.
- **2026-09-03** Validation report also exports as **Excel** (`.xlsx`),
  director request ("easier to use on Windows"). Written by hand, no
  dependency: `src/lib/zip.ts` (stored-entry ZIP writer, CRC-32 table, fixed
  1980 entry timestamps so a report is byte-reproducible) plus
  `src/lib/xlsx.ts` (minimal SpreadsheetML — one sheet, inline strings,
  numeric cells, bold frozen header, auto-filter, per-column widths).
  **Why not a library:** the licence question the director raised has a clean
  answer for both routes (`exceljs`/`write-excel-file` are MIT, SheetJS
  community is Apache-2.0 — all one-way compatible with this project's
  AGPL-3.0-only), so this was decided on engineering grounds instead: a
  7-column report needs perhaps 200 lines of the OOXML grammar, against
  ~1 MB of `exceljs` in the bundle, a new entry in the generated third-party
  notices, and a transitive zip dependency. Registry access was confirmed
  first (`npm view exceljs version` → 4.4.0), so this was a choice, not a
  workaround. If the report ever needs real formatting (merged cells, charts,
  multiple sheets, styled ranges) that trade flips and `exceljs` is the one to
  reach for.
  **Shared shape:** `exportService.ts` now has one `buildIssueReportRows`
  (rule, category, severity, objectId, line, xpath, message) that both writers
  consume — `buildIssuesCsv` formats it as text, `buildIssuesSheet` as cells —
  so the two reports can never drift apart (a test pins their headers to each
  other). `line` stays a NUMBER in the workbook so Excel sorts/filters it
  numerically instead of lexically ("9" before "10").
  **Excel's pickiness, learned the hard way:** worksheet children must appear
  in schema order (dimension → sheetViews → cols → sheetData → autoFilter);
  `styles.xml` needs the `gray125` fill at index 1 and a named "Normal"
  `cellStyle` or readers warn about a missing default style; XML 1.0 control
  characters must be stripped from cell text (`escapeXml` keeps tab/LF/CR).
  **UI:** ribbon Export gains an **Excel** button (`IconFileTypeXls`, hotkey
  `E + X`, id `export.reportXlsx`) and the CSV button's label changed from the
  vague "Report" to **CSV**; the Validation panel toolbar gained a matching
  Excel button next to CSV. `documentation/export.md` now documents both
  reports and the column table — NOTE: `documentation/images/export-ribbon.png`
  still shows the old three-button ribbon and needs a fresh screenshot (can't
  be taken from this sandbox).
  **Verified for real, not just in unit tests:** `zip.test.ts` reads its own
  archives back through a minimal central-directory reader and checks the
  CRC-32 of "hello" against the published value; `xlsx.test.ts` asserts the
  generated parts; `exportService.test.ts` covers the sheet rows. On top of
  that, the reference P&ID's report was written to a real file and opened with
  python `zipfile` (every CRC intact) and `openpyxl` (23 rows × 7 columns,
  sheet "Validation findings", freeze `A2`, auto-filter `A1:G23`, bold header,
  `line` cells typed `n`, 18.4 KB) — i.e. a third-party spreadsheet reader
  accepts the file, which is the closest check available without Excel itself.
- **2026-09-03** Profile-label rotation, corrected (supersedes the
  2026-08-22 entry above): a label's **anchor follows the placement's TRUE
  rotation** — the same transform the symbol's own artwork gets — and only
  its **glyph orientation** is normalized to the readable half-plane
  (90→270, 180→0). The sheet-space families (PropertyBreak **and now
  OffPageConnector**) opt out of both.
  **What was wrong:** `normalizeLabelRotation` was applied to the label's
  POSITION as well as its orientation, so a 90° placement's template offset
  was rotated by 270 — a full 180° displacement of the anchor. Harmless
  while offsets are ~1 unit; catastrophic for ND0049 (actuator badge, type
  code at local (0,−10.5), circle at (0,−10) r3), which the director hit
  with a 90°-rotated, mirrored placement: the "M"/"FM" texts rendered ~21
  units away, on the opposite side of the anchor from their own circle.
  **On the mirroring:** the director asked whether the text was being
  "rotated then mirrored". Effectively yes — and that framing pinned it
  down. Both artwork and label go through the same `transformPoint`
  (mirror → rotate → translate), but the label's angle was
  normalize(90) = 270 = −90, and `R(−θ)·M ≡ M·R(θ)`, so the label came out
  exactly as if the two operations had been applied in the opposite order,
  which for a 90° rotation is a 180° displacement. For ND0049 the mirror
  flag itself is a red herring (its circle and type code both sit on x=0,
  so mirroring x moves neither — verified through `transformPoint`: circle
  → +10.0, label → −10.5 mirrored AND unmirrored).
  **How the rule was settled (the ground truth the paused TODO thought was
  missing):** the note claimed no official example places ND0049 rotated.
  Not so — DISC_EXAMPLE-14-01..04 place it at 270°, position (292,160), and
  the official SVG draws "M" at (283.15,160) rotate(270), i.e. inside the
  circle at (282,160) at the ROTATED offset; sheet space would have put it
  at (292,149.5), where nothing is drawn. Instrumenting which placements
  actually render template overlays across all 15 official sheets:
  1409 at 0°, 168 at 270° (81 with offsets > 4 units), 32 at 180°, **0 at
  90°, 0 mirrored+rotated**. So the 90→270 branch that broke the director's
  sheet was never validated by official data — it was inferred by symmetry
  from the 180° case, and every one of those 32 labels belongs to
  ND0009A/B, i.e. `FlowOutPipeOffPageConnector` /
  `FlowOutSignalOffPageConnector` — a class family, not a general rule.
  Hence the family exception rather than a position flip.
  **Scored, not guessed:** a new `profileLabelsOfficial.test.ts` matches
  every rendered label against the official SVG text carrying the same
  string across all 15 sheets (same coordinate system, 5-unit tolerance;
  alignment/baseline differences are 1–3 units, a wrong rotation rule
  misses by 8–25). Current rule: **1862 matched / 12 missed** (the 12 are
  pre-existing and unrelated — a duplicated "D-20HA001" sheet label and an
  "SI" tag the sheets draw elsewhere). Positioning by the true rotation
  WITHOUT the off-page exception scored 1857/17, and the 5 regressions were
  exactly those connectors — which is how the exception was found rather
  than assumed.
  **Also:** `localTypeName`/`isPropertyBreakType`/`isOffPageConnectorType`
  moved out of `heatTracing.ts` into a shared `typeNames.ts` (both modules
  now key rendering rules off the same class-family predicates), and the
  two synthetic rotated-label fixtures in `profileLabels.test.ts` were
  re-anchored: instead of re-pointing their coordinates at whatever the new
  code prints (the circular fix the TODO warned about), they now assert the
  RULE — a badge fixture shaped like ND0049 (offset 3.5× its own radius),
  placed at 90° both mirrored and not, must land its label *inside the
  circle the scene actually draws*. Under the old rule that distance was
  20.5 units with r=3.
  Heavy-fixture note: the official catalogue is 30 MB, so the new sweep
  memoizes its profile/sheet parses per file — without that, three
  unrelated official-data tests started tripping vitest's 5 s timeout from
  parallel load alone.
- **2026-09-03** Selection halo survives deep zoom (director: "if I select
  and zoom in a lot the yellow outline is gone"). The marker-pen halo was
  sized as `7 × minWidthMm` (the 2026-08-23 entry above), and every stroke
  width is `max(stroke.width × widthScale, minWidthMm)` — with
  `minWidthMm = minStrokePx / viewport.scale` that factor only ever widened
  HAIRLINES. Past roughly 530% zoom (`7 / scale < 0.35 mm`, a typical line
  width) the clamp stopped binding, the halo was drawn at *exactly* the
  authored width, and the blue re-stroke on top covered it pixel-for-pixel.
  A factor on a zoom-relative clamp can't express "always thicker than the
  line", so the halo now carries an additive `extraWidthMm` on the draw
  context, set from `SELECTION_HALO_PAD_PX (3) × 2 × mmPerPx`: the yellow
  sticks out a constant ~3 screen px on each side at ANY zoom, which is
  within a pixel of what the old factor produced at fit/100% zoom, so the
  approved look at normal zooms is unchanged. `SceneDrawOptions` gained
  `mmPerPx` (= `1 / viewport.scale`) for zoom-invariant overlay geometry;
  the surviving 2.5× hairline clamp on overlay passes is now the named
  `HIGHLIGHT_MIN_WIDTH_FACTOR`, shared by the classification pass.
- **2026-09-03** Export ribbon split three ways + "As viewed" exports
  (director). The single Export section became **Export** (PDF, SVG — the
  drawing as authored), **As viewed** (PDF, SVG) and **Validation** (Excel,
  CSV); two mini buttons per section is one clean column each, so both drawing
  sections keep the plain "PDF"/"SVG" labels and the section title carries the
  distinction. `E + SHIFT&P` / `E + SHIFT&S` are the new shortcuts.
  **What "as viewed" means:** black & white, classification tints, "dim
  others", the trace overlays and the underlay — but NOT the selection halo or
  hover (director: "we can skip selected yellow outline"); those are where the
  pointer happens to be, not a property of the drawing.
  **How:** the canvas paints highlights as extra PASSES over the drawing (a
  veil, then re-strokes); the file writers emit each primitive exactly once and
  have no pass mechanism. Rather than teach both writers about view state, a
  pure `lib/dexpi/sceneAsViewed.ts` bakes every pass into the colors and hands
  back a DERIVED SceneGraph — the writers stay untouched apart from an optional
  underlay argument. The compositing is reproduced arithmetically rather than
  approximated: veil = 80% paper over the color, tinted fill = 35% tint over
  the veiled fill, tinted stroke = the tint (the re-stroke is opaque) — the same
  constants the renderer uses, cross-checked in `sceneAsViewed.test.ts`.
  Catalogue shapes are shared by many usages, so a shape is cloned once per
  DISTINCT treatment (`shapeId|rules`), not per placement.
  Export colors come from the **light** palette whatever theme the app is in:
  a dark-theme B/W export would otherwise print as pale ink on nothing. That is
  stated where it can be acted on rather than left as a surprise — the As viewed
  buttons' tooltip and the manual both say the export is always light and that
  the theme changes nothing in the file (director).
  **Underlay:** the canvas draws it through a Skia paint (SrcIn tint filter,
  Multiply for hide-white, alpha). PDF and SVG have neither filter, so
  `lib/canvas/underlayExport.ts` bakes tint and hide-white into the pixels via
  a 2D canvas and only the opacity travels as data. Hide-white becomes
  white→transparent rather than a multiply blend — identical against a white
  sheet, and the only version both formats can reproduce. The underlay is a
  raster (up to 4096 px), so an as-viewed export with one is part-raster and
  correspondingly larger; `placement` decides whether it lands under or over
  the drawing, as on screen.
  `requireDocument`/`baseName` moved to `exportShared.ts` so the report service
  and the new as-viewed service can both use them, and the ribbon's
  `reportError` became `ribbon/exportError.ts` shared by all three sections.
- **2026-09-03** Selection readability in dark mode (director, from a
  screenshot): the halo read as muddy OLIVE and the selected label was
  unreadable. Two causes, two fixes. (1) `selectionFill` was 55% alpha in the
  dark palette — over the near-black paper that desaturates into olive; it is
  now 92% (and light 85%), so the marker-pen yellow stays yellow. (2) The blue
  re-stroke pass was drawing selected TEXT in accent blue directly on top of
  the yellow backdrop rect — light blue on yellow, unreadable. Text over a
  backdrop now draws in a new `palette.selectionInk` (near-black in BOTH
  themes, because the backdrop is light in both) via a `glyphColor` override
  that applies to glyphs only, and the backdrop rect itself is now drawn fully
  opaque regardless of the halo alpha, so the content pass's glyphs underneath
  can no longer ghost through it.
- **2026-09-03** "Zoom to" now fits the whole selection, not just the
  primary object. Root cause: Explorer's "Select children" sets
  `selectedIds` to the whole subtree but leaves the primary `selectedId`
  pointing at the parent GROUP node, which has no drawn geometry of its
  own — `computeObjectBounds(scene, selectedId)` returned null and the
  button silently did nothing unless the anchor happened to be a leaf
  with geometry. `computeObjectBounds` became `computeObjectsBounds(scene,
  objectIds)` (`sceneGraph.ts`): it now unions the scene nodes of ALL
  given ids through the existing `computeSceneBounds` before padding —
  no new geometry math, since that function already accepted an
  arbitrary node array. The zoom-target state/action followed suit
  (`zoomTargetId` → `zoomTargetIds`, `requestZoomToObject` →
  `requestZoomToObjects`), and `useCanvasStage`'s `zoomToObject` →
  `zoomToObjects` fits the union box (same `MAX_OBJECT_ZOOM_PERCENT`
  clamp as before). The Explorer button now passes the full
  `selectedIds` instead of the single anchor; the Issues jump-link and
  the Topology graph's double-click still zoom to one object, now
  wrapped as a single-element array. Effect: selecting far-apart items
  (multi-select, or a group with scattered children) frames a bounding
  box containing all of them, instead of the zoom action being a no-op.
- **2026-09-04** Highlight panel becomes three composable sections
  (director): the existing classification UI moves unchanged into a
  **General Highlight** `Collapsible` (`GeneralHighlightSection.tsx`), joined
  by **Label Inspect** and **Node Positions**. `HighlightPanel.tsx` is now
  just the shell + the no-document empty state. The three overlays compose —
  each paints on top of whatever the others drew.
  **Label Inspect** (`src/state/labelInspect/`) draws every profile
  LabelTemplate at the template's own position/rotation/size/alignment, in a
  chosen color, opacity and depth, so a generated file's actual label
  placement can be compared against what the profile prescribes. The
  placements worth checking are exactly the ones the viewer SUPPRESSES (the
  2026-08-20 rule: an explicit diagram label beats a template), so the
  overlay needs the unfiltered set. Rather than resolve templates twice,
  `buildSceneGraph` now calls `buildProfileLabelOverlays` ONCE with an empty
  suppression set and keeps the result as `scene.labelTemplateNodes`; the
  rendered set is that list filtered by `collectExplicitlyLabelledIds`.
  Equivalent because suppression is per-placement and every emitted node
  carries its placement's objectId, and because `roleCounters` is per-entry
  so skipping an entry never shifted another's counters. Cost: templates on
  explicitly-labelled objects are now resolved at parse time instead of
  skipped — bounded by the profile-symbol placement count, worth measuring
  alongside the open M3 performance pass.
  "Behind drawing" means behind the geometry but still ON the sheet, so
  `drawPaper` split out of `drawSceneContent` and the recorded picture is
  taken with `hidePaper` in that mode (the picture cache key already tracks
  `hidePaper`, so toggling re-records once).
  **Node Positions** (`src/state/nodePositions/`) marks connection points:
  a circle per file node position, an X per profile attachment point.
  `Profile/NodePosition` was never parsed — `discProfile.ts` now reads it per
  SymbolVariant (`Position` + the bare `Profile/NodePositionType` literal,
  read as an open string so a future profile's new literal surfaces instead
  of being dropped; 0.6.3 publishes Piping/Instrumentation/Auxiliary/Label),
  and each placement transforms its points by the use-transform.
  `parseNodePositions` gained the file side: same single scan that feeds
  connector stitching now also emits markers, id-less ones included (they
  cannot be connector endpoints but are still real attachment points), and
  skips `Profile/`-prefixed types so an embedded catalogue cannot leak in.
  Both land in `scene.nodePositionMarkers`; rows come from
  `collectNodePositionKinds` over the loaded drawing, so the panel never
  hardcodes a type list. Per-kind color/scale live in a store keyed
  `"<source>:<kind>"` with defaults by source (file blue, profile orange) —
  untouched kinds stay absent from the store rather than being pre-seeded.
  Marker size was screen-constant on the first cut and is now in drawing mm —
  see the correction below.
  Not wired into the "As viewed" exports — these are inspection aids, not a
  property of the drawing; say so if that should change.
- **2026-09-04** Node-position marker sizing corrected to drawing mm
  (director, from screenshots). Screen-constant markers were chosen up front
  on the reasoning that a mm size would vanish at fit zoom; on real drawings
  that backfired in BOTH directions, because a fixed screen size means the
  size RELATIVE to the annotated symbol swings with zoom. At fit zoom 9 px
  blobs swamped an A1 sheet whose symbols are a few px across; zoomed right
  in they shrank to specks beside a symbol filling the viewport. Markers are
  now `MARKER_BASE_MM = 1.2` × the row's scale, so the proportion to the
  symbol is fixed at every zoom. 1.2 mm is measured, not guessed: symbol
  placements in DISC_EXAMPLE-14-13 have a median bounding size of 12 mm, and
  the size the director picked is about a tenth of the symbol. The STROKE
  stays screen-constant (`MARKER_STROKE_PX = 1.4`) — it is an annotation
  line, not drawing content. General lesson for overlays: pick screen-constant
  only for things sized against the POINTER or the viewport (the selection
  halo's 3 px pad); anything read against the drawing belongs in mm.
  Scale and color now persist to `localStorage` (`dexpi.nodePositions`,
  same idiom as `dexpi.rendering`, restored in `main.tsx`), because a tuned
  size is worth keeping. `enabled` deliberately does NOT persist: an overlay
  that switched itself back on at startup would read as the drawing having
  changed. `NODE_MARKER_SCALE_MIN/MAX/STEP` are exported from the actions
  module so the stepper and the stored-value validator cannot drift apart.
  A **Reset scale** button puts every scale back to 1× — including kinds
  stored from other drawings, so it reads the whole store rather than the
  visible rows.
- **2026-09-04** Inspection overlays, second pass (four director asks off a
  screenshot of the panel).
  (1) **Triangle, not X.** The profile marker's X hid a coinciding circle;
  it is now an unfilled triangle INSCRIBED in the circle of the same radius,
  so a matching pair reads as a triangle inside its circle — which is the
  whole point of putting both on screen. Both glyphs are outlines
  (`Fill.style = "Transparent"`).
  (2) **Per-kind outline width** in mm (`widthMm`, default 0.15), alongside
  color and scale.
  (3) **"Dim drawing"** in both sections — superseded the same day, see the
  linked-dim entry below.
  (4) **Both overlays now reach the "As viewed" PDF/SVG.** The mm sizing from
  the entry above is what made this cheap: marker geometry no longer depends
  on the viewport, so ONE builder (`lib/dexpi/inspectOverlays.ts`,
  `buildNodeMarkerPrims`) produces the primitives for the canvas and the
  exporters alike and they cannot drift. `ViewAppearance` gained `dimAll`
  (the inspection veil, applied after the tint in both `inkColor` and
  `areaColor`, and part of `rulesKey` so shape cloning still dedupes) and
  `overlays: {behind, front}`, appended AFTER the recolor so no veil, tint or
  B/W remap can touch annotation — matching the canvas, which paints them
  over the finished passes. Label Inspect's opacity is flattened onto white
  (`fadeToPaper`) because a file has no compositing stage, the same trick
  sceneAsViewed already uses for the highlight passes.
  Markers are now ordinary `ScenePrimitive`s drawn through `drawPrimitive`
  rather than bespoke Skia calls, so they inherit the min-px width clamp for
  free and `drawNodeMarkers.ts` is gone. `DrawContext` gained `rawColors`:
  annotation carries its own colors, so the theme/monochrome remap that
  exists to make FILE colors readable is skipped for overlays — without it,
  B/W mode would flatten the markers to ink.
- **2026-09-04** Test files are NOT typechecked, and have drifted
  (found while adding the above). `tsconfig.test.json` extends
  `tsconfig.app.json`, which carries `"exclude": ["src/**/*.test.ts"]`; an
  `include` in the child does not cancel an inherited `exclude`, so
  `npm run typecheck`'s second command checks nothing — a deliberate type
  error in a `.test.ts` file is reported clean. Nine real errors are hiding
  behind it, most of them SceneGraph literals in test helpers that have been
  missing `heatTracedIds`/`heatTracingSafetyCriticalIds` since M9, plus a
  `PolylinePrim`/`PolyLinePrim` typo and three possibly-undefined indexes.
  FIXED the same day (director): `tsconfig.test.json` now sets
  `"exclude": []` with a comment saying why, and the nine errors are gone —
  four SceneGraph literals completed, the `PolylinePrim` typo corrected, and
  the layer-overlap assertion rewritten to walk a running bottom edge instead
  of indexing `sorted[i - 1]` (clearer, and no unchecked index access). Two
  of the four were `doc?.scene ?? {empty scene}` fallbacks whose only purpose
  was satisfying the type; they now throw if the fixture fails to parse,
  because silently exporting an empty sheet is a worse failure than a loud
  one. Verified the check really bites by planting a deliberate type error in
  a test file and watching `npm run typecheck` fail. This also means the
  drift cannot recur: the next required field added to `SceneGraph` breaks
  the build at every fixture instead of rotting silently.
- **2026-09-04** One shared "Dim drawing", painted below every overlay
  (director: "Dim buttons in all sections should be linked… since dim should
  not dim other highlight"). The three sections had three independent dim
  flags, and the inspection one veiled the sheet AFTER the classification and
  trace passes — so turning it on faded the very highlights it was meant to
  make readable. Both halves of that are wrong, and fixing them collapses a
  lot of machinery rather than adding any:
  - `highlightState.dimOthers` becomes `highlightState.dimDrawing`, the single
    shared flag; `labelInspectState.dimDrawing` and
    `nodePositionsState.dimDrawing` are gone. All three checkboxes read and
    write the one store, so toggling any one moves the others. They share a
    label ("Dim drawing") and tooltip too — two names for one switch would be
    a lie. None of them is disabled: it is a shared setting, and disabling a
    shared control from one section's local state reads worse than a toggle
    that is briefly a no-op.
  - The veil goes back to its original position, first inside
    `drawSceneHighlights`, so classification, trace, label-inspect and node
    markers all repaint at full strength on top of a faded drawing.
    `drawInspectDimVeil` is deleted. The old gate
    (`dimOthers && classification.size > 0`) moves to the caller as
    `dimDrawing && hasOverlay`, where `hasOverlay` now also counts label
    templates and node markers — so dim works with highlight mode Off, while
    still never fading the sheet for an overlay that would draw nothing.
  - Export follows: `ViewAppearance.dimAll` and the `dimAll()` colour step are
    gone, `dimOthers` → `dimDrawing`, and `inkColor`/`areaColor` return to
    their pre-change form. The existing per-node rule
    (`dimmed = dimDrawing && tint === null`) already expresses "fade the
    drawing, keep the overlays", and appended overlay nodes are never
    recolored at all.
  - One asymmetry is deliberate: a "behind"-placed Label Inspect overlay IS
    dimmed, because on canvas it is painted before the drawing and the veil
    covers it. `sceneAsViewed` reproduces that with `dimNode` rather than
    quietly improving on it — "as viewed" means as viewed. Behind + dim
    therefore still gains no contrast; use "in front" with dim.
