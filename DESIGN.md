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
  panel; left topology (object tree) panel; right properties panel; bottom issues
  panel (collapsed by default).
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
      source — the DISC profile spec is not publicly available, so this
      is best-effort until real DiscProfile.xml data arrives; the
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
