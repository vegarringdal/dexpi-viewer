# DEXPI Viewer — Design

A fast, polished DEXPI P&ID viewer and checker. Successor in spirit to
[ToniaPedersen/DEXPIViewer](https://github.com/ToniaPedersen/DEXPIViewer)
(cloned for study under `refrences/DEXPIViewer`), but with a
GPU-accelerated Skia canvas instead of a React-managed SVG tree, strict
TypeScript, and a panel/ribbon workbench UI.

This file describes how the app works **now** and the rules it follows.
History lives in [CHANGELOG.md](CHANGELOG.md) and git; todos and maybes in
[OPEN_ITEMS.md](OPEN_ITEMS.md). When a rule changes, edit it in place —
don't append a dated correction.

## Goals

- Open DEXPI 2.0+ XML files and render the P&ID faithfully, with DISC
  profile symbols and label templates.
- Stay fluid on large drawings: one Skia CanvasKit surface, not thousands
  of DOM nodes.
- Help people check generated files: validation, structural inspection,
  verification underlay, label/node-position overlays.
- Workbench UX: dockable panels, ribbon, light/dark theme, rebindable
  hotkeys — built from `@tredespace/ui`.

## Non-goals

- Proteus XML 4.x (DEXPI 1.2–1.4). DEXPI 2.0 and above only; the Proteus
  example under `refrences/examples/proteus-1.3` is background material.
- Editing/authoring DEXPI files. This is a viewer.
- Repairing source data: panels always show the raw stored values, even
  where the drawing hides a placeholder.

## Tech stack

| Concern  | Choice |
| -------- | ------ |
| Build    | Vite, TypeScript (strict), Biome (lint + format) |
| UI       | React, `@tredespace/ui` (widgets, ribbon, dockable, hotkeys) — tarball in `external/`, not on npm |
| Styling  | Tailwind CSS v4; dark-theme utilities only (see Theming) |
| Drawing  | Skia CanvasKit (`canvaskit-wasm`), WebGL surface |
| Parsing  | Browser `DOMParser`; framework-agnostic core |
| Exports  | Own SVG writer; `pdf-lib` + fontkit for PDF; hand-written xlsx/zip |
| Underlay | `pdfjs-dist` for PDF references |
| Tests    | Vitest + jsdom |

## Architecture

Three layers with one-way dependencies. React never touches Skia objects
directly; the parser knows nothing about React or Skia.

```
src/
├─ components/  React shell: ribbon sections, dock panels, settings,
│               hotkeys, export services. Components render; logic in hooks.
├─ state/       createStore domains shared across panels
│               (*.state.ts + *.actions.ts — rules in CLAUDE.md)
└─ lib/         Non-React code:
   ├─ dexpi/     XML → document model, scene graph, plant model, profiles,
   │             label resolution, heat tracing, validation, SVG writer.
   │             Pure TS, no React, no Skia.
   ├─ canvas/    CanvasKit runtime: surface, viewport, scene drawing,
   │             picture cache, underlay.
   ├─ graph/     Topology semantic graph + Inspect object diagram, layouts
   ├─ assets/    bundled fonts (+ license texts)
   └─ generated/ metamodel tables (generate:metamodel), notices (generate:notices)
```

- The parsed `DexpiDocument` (Maps, big scene graph) is a module-level
  handle in `viewer.actions.ts` (`getLoadedDocument()`), not store state;
  the store carries `docRevision` and subscribers re-read the handle when
  it bumps. The same pattern holds other non-serializable handles (the
  parsed profile catalogue, the underlay bitmap).
- `createStore` is a local implementation (`src/lib/createStore.ts`) — the
  `@tredespace/ui` package doesn't export it.

### Persistence

Every `localStorage` key goes through `storageKey()` (`src/lib/storageKey.ts`),
which prefixes it per build (`PROD_`, `PREVIEW_`, `LOCAL_`) because prod
and preview share one origin. A missing prefixed key is seeded from the old
unprefixed one.

Persisted: dock layout, theme, rendering settings, profile autoload,
validation severity overrides, topology-graph options, node-position marker
appearance. Deliberately **not** persisted: trace, highlight mode, overlay
on/off switches — an overlay that switched itself back on at startup would
read as the drawing having changed.

## Document model (`src/lib/dexpi/`)

DEXPI 2.0 XML is a generic object graph: `<Object type="Pkg/Class">` with
`<Data property>` values, `<Components property>` children and
`<References>`. Graphics live in `Core/Diagram.*` classes. The parser
produces:

- `DexpiDocument` — metadata, raw object index, root element, findings.
- `SceneGraph` — flat, render-ready primitives in drawing mm, each
  back-referencing its owning object id; plus derived sets
  (`heatTracedIds`, `labelTemplateNodes`, `nodePositionMarkers`, …).
- `PlantModel` — the engineering hierarchy for the panels, with
  `referencedBy` reverse index and `elementsById`. Built per branch:
  conceptual (Explorer/Properties), diagram (Diagram Tree), full (Inspect
  "Drawing" mode).

Rules:

- **Coordinates are y-down (SVG-like)**, unlike Proteus. Proof: the spec's
  EllipseArc runs "in positive direction (clockwise)" with the standard
  (cosθ, sinθ) parameterization. No axis flip anywhere; rotations and arc
  sweeps map 1:1 onto Skia.
- Drawing objects carry no ids in real DISC files, so diagram-side nodes
  use their **positional XPath** as a synthetic id
  (`/Model/Object[2]/Components[1]/Object[4]`, `elementXPath` in `xml.ts`).
  Synthetic ids never enter global selection; they are hidden where an "ID"
  label would mislead.
- Multi-valued Data properties keep every value (`dataValues`).
  Undefined-valued properties show as dimmed "(undefined)" rows
  (`undefinedAttributes`), kept out of `attributes` so labels and
  classification can't consume them.
- Row labels: TagName, PositionNumber, InstrumentationLoopFunctionNumber,
  ActuatingSystemNumber, SubTagName, SegmentNumber, Identifier, Name,
  Description, then the raw id (never shortened — truncation is the UI's job).
- Units: drawing text always uses conventional symbols (barg, °C, m³/h).
  Settings → "Spec unit names" affects the Properties panel only.
- Follow the spec, not guesses: the XSD, the spec PDF, and the spec's own
  Python model sources (`refrences/spec-model-Core-Diagram.py`) are the
  references for graphics semantics.

## Rendering (`src/lib/canvas/`)

- One `CanvasStage` owns the `<canvas>`; an invalidation-driven loop
  redraws only when dirty. Viewport = pan + uniform zoom under one mm→px
  matrix.
- The scene body records into an **SkPicture**, keyed on document, theme,
  stroke parameters, monochrome and `hidePaper`. Pan, hover and selection
  replay it; a zoom step re-records (the min-px clamp depends on zoom).
- Stroke width = `max(width × widthScale, minPx / scale)`. Strokes use
  round caps/joins; scaled ShapeUsages draw non-scaling strokes (symbol
  scale must not fatten linework).
- Fill semantics from the spec's own reference SVGs: `Solid` = filled with
  the stroke colour, `Transparent` = none, `Hatch` = 45° lines in the
  stroke colour (spacing 10× stroke width). Consequence: some files draw
  text that is invisible by their own data — not our bug.
- Text needs three things: metric-compatible faces (Calibri→Carlito,
  Verdana/Tahoma→DejaVu Sans, else Liberation Sans), `linearMetrics` +
  `subpixel` + no hinting (mm-sized fonts otherwise get quantized
  advances), and per-primitive font resolution.
- Multiline text: `textLayout.ts` is shared by canvas, SVG, PDF and
  hit-test — split on `\r?\n`, trim each line (browsers collapse whitespace
  in the official SVGs), per-line horizontal alignment, block vertical
  alignment, line spacing 1.4 × size.
- Dark theme adapts document colours (near-black → ink, white → paper);
  Black & white mode maps all file colours to ink/paper.
- Hit-testing walks the scene graph (point-to-segment distance with a px
  tolerance), including transformed symbol instances.
- Minimap is a CPU raster per document/theme; Topology and Inspect are
  inline SVG — never a second WebGL context.

### Overlay passes

Paint order: paper → recorded content → **dim veil** (shared "Dim
drawing", paper at 80 %) → classification tints → trace → Label Inspect /
node markers → hover → selection. The veil sits below every overlay so
highlights stay at full strength on a faded sheet; it only paints when
some overlay has something to draw.

- Overlays carry their own colours (`rawColors`) — the theme/monochrome
  remap is for file colours only.
- Re-strokes preserve dash patterns, so a selected heat-traced pipe keeps
  its trace distinguishable.
- Selection: yellow geometry-following halo that sticks out a constant
  ~3 screen px (`SELECTION_HALO_PAD_PX`) at any zoom, blue re-stroke on
  top; selected text gets an opaque yellow backdrop rect (toggle in
  Settings) and draws in `selectionInk` (near-black in both themes).
- The classification ramp contains no blue, so tints never read as
  selection.
- **Sizing rule:** screen-constant only for things sized against the
  pointer or viewport (selection pad, marker stroke); anything read against
  the drawing is in mm (node markers: `1.2 mm × scale`, about a tenth of a
  median symbol).

## Drawing text and labels

Where text on the sheet comes from, in priority order. The goal is never
to show a tag twice, never show junk, and never guess.

### Explicit labels win

1. Authored `Core/Diagram.Label` text is authoritative. Property- and
   profile-derived tags are fallback only; profile catalogue objects are
   never plant objects.
2. SymbolUsage rotation/mirroring transforms symbol geometry only —
   explicit text keeps its own position and rotation.
3. A profile LabelTemplate renders only when its object has no authored
   label covering it. Ownership is computed on the XML representation tree
   (`collectExplicitlyLabelledIds`): Represents propagates down; an
   authored label with no association of its own is attributed to the
   nearest enclosing subtree that represents exactly one object. Scope is
   per represented object — never by text value, position or symbol type.
   **Exception:** a template whose sole placeholder is `TypeCode` is
   suppressed only when an authored text names `TypeCode` (so a symbol's
   type-code badge still draws beside an authored tag).

### TextTemplate resolution (explicit texts)

- **All-or-nothing:** a template replaces the XML `Text` value only when
  every attribute fragment resolves to a non-empty, renderable value.
  Otherwise the authored literal stays — never a partial concatenation.
- **Ambiguity guard:** when sibling texts of one represented object hold
  distinct literals but resolve to the same value (one template stamped on
  prefix/code/suffix parts), that subset keeps its literals
  (`collectAmbiguousIndices`).
- `<Attr>Representation` twins (e.g. `FailActionRepresentation="FM"`) are
  preferred when the base attribute is named. A bare enum without a twin
  never replaces a non-empty literal ("Sloped" loses to the authored text);
  the viewer never turns a classification into a directional word.

### Attribute lookup

`lookupAttribute` (resolveTemplates.ts): own object — folding in id-less
component descendants (e.g. `PipeOffPageConnectorReferenceByNumber`),
Core value objects excluded — then a 2-hop related-object search. Several
objects at the same hop with differing values → unresolved. Final fallback
for plant-context codes (`(Site|…|PlantSystem|PlantTrain)(IdentificationCode|Name)`):
resolve from the document's carriers only when they all agree.

### Display-quality policy

`isRenderableLabelValue` (labelPolicy.ts) is the single gate: empty, the
sentinel list (`?`, `N/A`, `TBD`, `#VALUE!`, …), leaked template tokens
(`<Word>`, `{Word}`) and exporter filler (length ≥ 2, every char a symbol or
`x`/`X`) never render. A profile template renders that field blank; an
explicit template treats it as a failed fragment.

### Profile LabelTemplates (`profileLabels.ts`)

- Expressions are VB-style (`labelExpression.ts`): single-quoted literals,
  `''` escape, `&` concatenation. 0.6.3's malformed alarm templates (missing
  opening quote) are repaired on read.
- `<Attr>` resolves via the lookup above; `ClassName:<Attr>` picks a
  specific child — by PortStatus for H/HH/L/LL alarm prefixes, else
  positionally; an unmatched role path suppresses the template.
- A template that is only an alarm letter (`'H'`, `'L'`) renders only when
  a SignalConveyingFunction child has the matching PortStatus
  (`resolveLiteralText`).
- A placeholder matching a **References** property (e.g.
  `DiscProfile/TypeCode`) resolves to the referenced profile instance's
  `Abbreviation` ("MCC", "M").
- Fallback tag attributes: `DiscProfile/ItemTag`, `DiscProfile/ObjectDisplayName`.
- One multi-line text primitive per template, block-aligned by its
  vertical alignment.

**Placement:**

- The anchor follows the placement's **true** transform (mirror → rotate →
  translate, the same `transformPoint` the artwork uses); only glyph
  **orientation** is normalized to the readable half-plane (90→270, 180→0).
  Mirroring flips the anchor, never the glyphs.
- Template position and size are **sheet units**: placement scale applies
  to symbol geometry only (verified on official sheets — ND0044 at scale 4
  draws its 3.3 mm tag unscaled at the unscaled offset).
- **Sheet-space families** opt out of rotation entirely: PropertyBreak and
  OffPageConnector represented types (`typeNames.ts`).
- Scored against the official renderings by `profileLabelsOfficial.test.ts`
  (every label matched by string across all 15 DISC_EXAMPLE-14 sheets).

## Signal lines (`signalLines.ts`)

The official renderings restyle signal-family ConnectorLines by the
represented object's `SignalConveyingFunctionTypeRepresentation` and add
mark glyphs that exist in no XML. Director-supplied table:

| Type | Line | Marks |
| ---- | ---- | ----- |
| MeasuringLineFunction | solid | — |
| SignalConveying (plain) | dash 3/3 | — |
| Electrical | solid | repeated italic E |
| Hydraulic | solid | upright L |
| Bus | solid | circles (10 mm cadence from 5 mm) |
| Pneumatic | solid | ^ chevron |
| Capillary | solid | x |
| Undefined | solid | / |
| EM-guided | solid | ~ |
| EM-unguided | hidden | ~ (marks only) |
| attribute absent | as authored | — |

Marks are hand-drawn vector glyphs (no font dependency in exports), every
6.5 mm from 2.5 mm in, rotated to the readable half-plane; lines shorter
than the cadence get one centred mark. A profile-published
`Profile/LineStroke` for the literal overrides the table; Settings →
Rendering → "Built-in signal-line styling" forces the table back (re-parses).
The table is also in `documentation/conventions.md`, with SVG previews
generated from this code.

## Heat tracing (`heatTracing.ts`)

Heat tracing is main-file data (`HeatTracingType` on piping objects),
drawn as dashed overlays beside untouched base geometry.

**Classification:**

- An active value (`ElectricalHeatTracingSystem`, `HeatTracingSystem`,
  `SteamHeatTracingSystem`, `TubularHeatTracingSystem`) covers the object
  and everything nested below it.
- Absent, `NULL` or `None` inherits the nearest ancestor's effective value,
  any number of levels up; no ancestor → untraced. `NoHeatTracingSystem`
  blocks inheritance until something below re-classifies. Ineligible
  classes pass the inherited state through unchanged.
- Eligible classes: PipingNetworkSystem/Segment, piping components,
  OfflineMeasuringElement, Nozzle, ProcessInstrumentationFunction,
  MeasuringLineFunction (a physical impulse line). Logical signals never
  carry or inherit tracing. `HeatTracingBreak` is a logical property break,
  never drawn.
- `IsHeatTracingSafetyCritical` (own explicit `true`, traced objects only)
  is collected but not yet used.

**Pipelines:** a parallel polyline, always on the **bottom** of
horizontal segments and the **right** of vertical ones — each segment picks
its own normal (non-negative x+y), joined with miters (clamped to
4×|offset|). The profile's `LateralOffset` supplies the magnitude only.

**Symbols:**

- Ring (encompassing circle) only for the round instrument symbols
  `ND0023`/`ND0248A`/`ND0248B` (allowlist by shape name; a BallValve is never
  round). This applies even when the placement sits inside a Label group.
- Every other symbol gets a straight side-line on its **flat side**: the
  shape's more asymmetric local axis is pushed through the real
  use-transform (`rotatedWorldBounds`, `resolveFlatSideIsWorldMax`), so a
  bleed stub or branch never gets traced through; symmetric shapes default
  to bottom/right.
- PropertyBreak and OffPageConnector placements never get a mark (they may
  still be in `heatTracedIds`, so Highlight tints them).

**Style:** a loaded profile's `Profile/LineStroke` wins (colour, DashArray,
Width, LineRounding, Offset). Defaults: dash 1.0/1.0 mm, width 0.25 mm
(one constant everywhere — never derived from the traced pipe), orange
217/108/24, lateral offset 1.5 mm.

## DISC profiles

`discProfile.ts` parses a DiscProfile.xml catalogue: symbols and variants
with `PropertyValueCondition`s (also matching `Plant/Piping.`- and
`Plant/Instrumentation.`-prefixed attributes), LabelTemplates,
`Profile/NodePosition`s, named instances (for TypeCode/Abbreviation),
class extension supertypes (`classSupers`), and signal LineStrokes.

**Bundled releases** live in `public/profiles/DiscProfile-<v>.xml`
(byte-identical to upstream); every test parses those, so `refrences/`
mirrors only upstream's current release. Versioning lives in
`profileVersion.ts`:

- `BUNDLED_PROFILE_VERSIONS`, `LATEST_BUNDLED_PROFILE` (Ctrl+Shift+L,
  generated symbols.md), `RIBBON_PROFILE_VERSIONS` (the ribbon minis —
  three at most).
- Releases ≥ 0.6.4 stamp `MetaData/version` and import
  `http://www.to.define/DiscProfile/<v>`. An unversioned import means
  0.6.3 (`PRE_STAMP_VERSION`), which therefore stays bundled.
- The loader detects the declared version from the file **prologue** text
  (before the first `<Object>`), so it can pick a catalogue before parsing
  a multi-megabyte drawing.

**Selection:** `src/state/profile/` holds an `ActiveProfile` union (none /
bundled + version / custom + file name), `isPinned`, persisted `autoLoad`
(off by default) and the document's `declaredVersion`. A hand-picked
version pins; Auto releases the pin. A version we don't bundle is never
substituted: META-003 warns and the status bar turns amber.

**Behaviour follows the selected profile** — not the document's declared
release and not a newer/older one. No aliasing of renamed attributes:
render what the selected catalogue publishes.

**Adding a release:** copy the XML to `public/profiles/`, extend the
version constants, add a "what X changed" block to
`discProfileOfficial.test.ts` (symbol/variant/template counts), sync
`refrences/discdexpi-2026pack/`, run `npm run generate:docs`.

## Validation

Neither the DEXPI spec nor the XSD defines an error-code catalogue, so the
app keeps its own stable, category-prefixed ids. The generated
[rule reference](documentation/rules.md) lists every rule.

| Prefix | Category | Source |
| ------ | -------- | ------ |
| SCH | Schema | ids, references, XSD lexical patterns |
| GFX | Graphics | shapes, connectors, extent |
| CON | Connectivity | flow source/target, orphans, nozzles, DN, piping class |
| MDL | Model | generic walker over the DEXPI metamodel + profile classes |
| META | Meta data | template attributes, profile version mismatch |

Design choices:

- **Model-driven:** `scripts/generateMetaModel.mjs` turns the official XMI
  into versioned tables (`src/lib/generated/metaModel-2.0.ts`). The
  registry picks tables by the document's data.dexpi.org Import URIs; a
  version without tables falls back to the newest and reports MDL-000 —
  a future 2.1 file is never silently judged by 2.0 rules. Covers
  per-object shape only; cross-object semantics (CON-*) stay hand-written.
- Profile extension classes validate through declared ancestry
  (`classSupers`); unknown extensions are skipped, never guessed. MDL-010
  flags classes in the document's DiscProfile namespace that the selected
  catalogue doesn't define.
- Namespace-qualified reference targets (published models, enum
  instances) and data.dexpi.org URIs are identifiers, not resolvable
  links.
- GFX-001 is profile-aware and aggregated per symbol; well-known rootless
  shapes like `/Border` warn instead of erroring.
- CON-004 compares nominal diameter only across a connection's two nodes
  and only like with like (numeric vs numeric, text vs text) — a reducer
  inside a segment legitimately changes DN.
- Findings are plain data (`ValidationIssue`): optional `xpath` of the
  offending element itself (the `<References>`/`<Data>`, not just its
  owner) and `attributeName` so Inspect can mark the row red in place.
  Never DOM handles.
- Severity overrides (incl. Ignore) map at render/export time; raw findings
  on the document never change and nothing re-parses.

**Reports:** one `buildIssueReportRows` feeds both CSV and Excel, so they
can't drift. Line numbers come from pairing a quote/comment-aware scan of
opening tags in the original text with a pre-order DOM walk (dropped whole
on a length mismatch rather than reporting lines that are off). The xlsx
is written by hand (`zip.ts` + `xlsx.ts`, byte-reproducible): a 7-column
report doesn't justify ~1 MB of `exceljs`. Switch to it if the report ever
needs real formatting.

## Workbench and panels

**Default layout** (`App.tsx`): ribbon on top (locked); columns
Explorer | Validation, Drawing, Topology graph / Inspect (collapsed to
rails), Properties | Connections | Highlight | Settings over Minimap.
Conceptual Model Tree and Diagram Tree open from the ribbon. Users keep
their persisted layout until ribbon Reset. Panel ids are persisted keys —
the Explorer's id stays `topology`.

**Ribbon:** File, Profile, View, Export, As viewed, Validation, Panels,
Help. **Hotkeys** default to plain keys (F fit, 0 zoom 100 %, Z+I/Z+O, D
theme, B black & white, 1–9 panels, E+… exports, F1 docs); every ribbon
tooltip shows the live binding; keymaps export/import as JSON overrides.
`hotkeys.test.ts` pins the table.

**Theming:** author dark-theme Tailwind utilities only — the library
inverts `--color-*` under `html[data-theme="light"]`. Only the slate and
blue scales are remapped, so theme-sensitive fills use those; other hues
only at mid-scale (500–600) where both themes stay legible.

**Selection:** `selectedIds` (ordered) plus a primary `selectedId` (what
Properties/Connections show). Ctrl/cmd toggles, shift range-selects
visible tree rows. Selecting a grouping object doesn't select its subtree.
"Zoom to" fits the union of all selected objects. An active trace follows
the primary selection.

**Diagram-side navigation:** synthetic ids can't go through global
selection, so `nearestRepresentedId` maps a diagram node to the conceptual
object it draws, and two small stores carry exact-node requests between
panels (`diagramReveal`: Inspect → Diagram Tree; `inspectReveal`: Diagram
Tree → Inspect). Inspect's local re-centre records the context it is valid
for (selection, drawing mode, doc revision) and is ignored once that moves —
no "was that me?" flags.

**Trees:** `PlantTree` (Explorer and both XML trees) is virtualized with
fixed row height; `flattenVisibleNodes` is the single source of visible
order for windowing and shift-range selection; scroll-to-reveal goes
through a `revealRequest {id, nonce}` prop, not DOM queries.

**Topology graph** (`src/lib/graph/`): plant objects as nodes with
connection hardware collapsed into its owner; flow, containment and
reference edges (the Source/Target family is flow only). Deterministic
hand-written layered layout, flow left→right, no new dependencies. A plain
click re-roots the neighbourhood while keeping the clicked node at its
screen position; ctrl-toggles keep the layout still; auto-fit only on
structural changes.

**Inspect:** UML-style instance diagram of the selected object and its
one- to three-hop relations, edges labelled with the real property names.
Profile symbols and instances resolve as stub cards that navigate back to
the referencing object. Validation problems show structurally — a
missing required property is a red "(missing)" row — not as error blobs.

**Highlight panel**, three composable sections sharing one Dim drawing
switch:

- *General* — built-in classifications (heat traced, signal lines by
  semantics, fluid code, piping class by nearest-ancestor value) or
  *Custom* filters: fields TYPE / ATTR / ID / XPATH / PERSISTENT_ID,
  (not) contains/equals with `*` glob, optional `&`/`|` expression
  syntax, list order = priority (last wins), JSON file format
  `FILTER_FILE_VERSION = 2` (mismatch fails, no migration). An object
  missing the field never matches, even under a negated operator.
- *Label Inspect* — every profile LabelTemplate at its prescribed place,
  including the ones the viewer suppresses (`scene.labelTemplateNodes` is
  the unfiltered set).
- *Node Positions* — circles for the file's node positions, inscribed
  triangles for the profile's attachment points, so a matching pair reads
  as a triangle in its circle.

**Verification underlay:** a reference raster/SVG (rasterized at 4096 px)
or PDF page 1, stretched to the diagram extent (official DISC SVGs align
exactly), with opacity, under/over, 0.1 mm nudges, "hide white" (multiply)
and ink tint (SrcIn). Under the drawing, the paper rect is skipped.

## Exports

- **SVG** (`exportSvg.ts`) and **PDF** (pdf-lib) write the scene as
  authored. pdf-lib gotchas: `drawSvgPath`'s `scale` applies before line
  width/dash, so pass widths in drawing mm; embed fonts **unsubsetted**
  (fontkit subsetting emits a corrupt glyf table).
- **As viewed:** `sceneAsViewed.ts` bakes black & white, tints, dim veil,
  trace and the inspection overlays into a *derived* SceneGraph — the
  writers don't know about view state. Compositing uses the renderer's own
  constants (veil 80 % paper, fill tint 35 %). Shapes are cloned once per
  distinct treatment. Always the **light** palette, whatever the theme.
  The underlay is baked to pixels (tint, white→transparent) with opacity
  as data. Selection and hover are never exported.
- Validation reports: see Validation.

## Documentation and deployment

- `documentation/` is the user manual (hand-written pages + generated
  rules/metamodel/symbols/signal previews, `npm run generate:docs`, which
  renders through the app's own code). `npm run build` first converts it
  to static HTML in `public/manual/` (gitignored).
- Screenshots: `scripts/generateDocScreenshots.mjs` drives the real app
  (fresh context, default layout, DISC_EXAMPLE-14-08 + profile 0.6.3,
  1560×900 @1.5×) and records numbered marks in
  `documentation/images/shots.json`; the site overlays them as HTML.
  Markdown extensions (figure + legend list, `(#n)` chips,
  `<!-- steps -->`, `> [!NOTE]` callouts) degrade to plain GFM on GitHub.
- CI (`.github/workflows/`): PRs run typecheck, lint, test and build; a PR
  to `main` must bump the version (`scripts/checkVersionBump.mjs`).
  `main` deploys to the `livedemo` branch root, `dev` to `livedemo/preview/`
  with version `<v>-next.<run>` and its own storage prefix. Build output is
  `dist/` with `base: "./"`.

## Testing

- Fixtures: `refrences/reference_pid.xml` (C01, richest DEXPI 2.0 file),
  the 15 DISC_EXAMPLE-14 sheets with their official SVGs, and the bundled
  profile catalogues. Official-data tests memoize parses — the catalogues
  are large enough to trip vitest's timeout under parallel load.
- Regressions are scored against official renderings where they exist
  (label placement, signal glyphs, TypeCode badges, plant-context codes),
  not against whatever the code currently prints.
- `tsconfig.test.json` sets `"exclude": []` because an inherited `exclude`
  isn't cancelled by `include` — without it test files go unchecked.
- Vitest inlines `@tredespace/ui` (its ESM has extensionless imports).
- jsdom 30 needs Node ≥ 22.

## Reference material

| Path | What |
| ---- | ---- |
| `refrences/DEXPI_Specification_2.0.pdf` | DEXPI 2.0 spec (data model + XML serialization) |
| `refrences/DEXPI_XML_Schema.xsd` | DEXPI 2.0 XML schema |
| `refrences/spec-model-Core-Diagram.py` | The spec's own Core.Diagram model source — authoritative for graphics semantics |
| `refrences/Dexpi-2.0.xmi`, `refrences/dexpi-2.0-supporting-materials.zip` | UML information model (source for `generate:metamodel`) |
| `refrences/DEXPI_PID_Specification_1.4.pdf`, `refrences/DEXPI-Process-1.0-Information-Model.pdf` | Older/adjacent specs, background only |
| `refrences/reference_pid.xml` | C01 reference P&ID as DEXPI 2.0 — main test fixture |
| `refrences/examples/` | DEXPI 2.0 (Tennessee Eastman) and Proteus 1.3 examples |
| `refrences/DEXPIViewer/` | Prior-art viewer (JS + SVG) |
| `refrences/discdexpi-disc-profile/` | DISC Profile 0.4/0.5 spec + schema |
| `refrences/discdexpi-2026pack/` | DISC Profile 0.6.x: current release XML, upstream zips, change reports, transfer requirements, `Blueprint/DISC_EXAMPLE-14/` sheets with official SVGs. HTML extractions are not committed — unzip on demand |
| `external/tredespace-ui-*.tgz`, `external/treDeSpaceUI.md` | UI library and its usage guide |

## Decisions log

Lasting decisions and why. One line each; edit in place if one changes.

- DEXPI 2.0+ only; Proteus out of scope entirely.
- `https://data.dexpi.org/models/2.0.0/*.xml` imports are namespace
  identifiers, not fetchable resources.
- License AGPL-3.0-only.
- Exports are SVG and PDF; PNG dropped ("SVG and PDF is enough").
- Measurement tool and recent files dropped (the browser can't reopen
  local files without stored File System Access handles).
- Validation keeps its own rule taxonomy — no official catalogue exists.
- Excel report written without a dependency (size and notices, not
  licensing — the libraries are AGPL-compatible).
- Profile behaviour follows the selected catalogue; unbundled versions are
  reported, never substituted; renamed attributes are not aliased.
- Where no spec exists, conventions are recovered from the official
  renderings and documented in `documentation/conventions.md` as candidates
  for upstream standardization.
- Inspection overlays and highlights are viewing aids: never persisted as
  "on", included in As viewed exports, never in plain exports.
