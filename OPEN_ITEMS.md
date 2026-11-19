# Open items

Todos and maybes. Remove an item when it lands (and log it in
CHANGELOG.md); move a decision that came out of it into DESIGN.md.

## Todo

Stability bugs come first; start the multi-diagram work only after them.

- **Open multiple diagrams, with the minimap showing all of them** — needs
  a short design before work starts, because the app assumes one loaded
  document throughout. Known touch points:
  - one document handle (`getLoadedDocument()`, `docRevision`) →
    a collection of documents, with an active one;
  - scene layout: where each sheet sits in a shared space, and what Fit /
    zoom-to do across sheets;
  - minimap: one raster per document today → all sheets, with the
    viewport rectangle across them;
  - object ids are unique per file only → selection, trace, highlight,
    Inspect and the reveal stores need document-qualified ids;
  - per-document state: validation findings, declared profile version
    (sheets may declare different releases), underlay;
  - panels (Explorer, XML trees, Validation, Topology) — per active sheet
    or combined;
  - exports — per sheet or all.
- **Performance pass on multi-MB drawings** — measure fps and parse time,
  add culling. The scene body is already cached as a Skia picture; profile
  label templates are now resolved twice per parse (rendered set + the
  unfiltered Label Inspect set), worth measuring at the same time.
- **Remove the stale `docs/` folder** — old GitHub Pages build output
  (~410 tracked files). Deployment now builds to `dist/` and CI publishes
  to the `livedemo` branch.
- **Profile property validation** — MDL-010 checks profile *classes*, but
  `DiscProfile/…` *properties* are never checked: a misspelled
  `DiscProfile/ItemTagg`, or a property the profile dropped (e.g.
  `BreakValue1/2` in 0.6.7), passes silently. The profile declares them
  (ClassExtension/DataProperty, UsageConstraint allowed properties).
- **Self-validation of a loaded DiscProfile.xml** — symbols without
  variants, malformed conditions/templates (prior-art PRF-E01…E05).

## Waiting on data or the spec

- **ND0043 template uses a renamed attribute (0.6.7)** — the template reads
  `<TieInPointIdentifier>\n<CommissioningPackage>`, but 0.6.7 renamed the
  attribute to `CommissioningPackageIdentifier` (on Nozzle and PipeFitting)
  and declares nothing called `CommissioningPackage`. On a drawing that
  follows 0.6.7 the second line is always blank. The director's rule is to
  render what the selected profile publishes, with no alias. Being
  reported upstream to DISCDEXPI by the director's test user; no viewer
  change. Close this when a catalogue with a fixed template is bundled.
- **0.6.7 break-value labels** placed on a Core.Diagram.Label rotate with
  their placement; the PropertyBreak sheet-space rule is not extended to
  them. Revisit when a 0.6.7 sample drawing exists.
- **Equipment boxes ND0300–ND0310** (0.6.6+) resolve placeholders by 2-hop
  search, which cannot tell a heat exchanger's cooling chamber from its
  heating chamber. Needs a 0.6.6+ sample drawing.
- **Requirements rev 6.2 §7.5 "rule B"** label alignment under
  rotation/mirroring — the note it cites is not in the pack.
- **`/Border` title block** is not drawn: no published catalogue ships its
  geometry (the exporting tool draws it). Spec/profile gap.
- **Profile `LineStroke` overrides are untested on real data** — no bundled
  catalogue (0.6.3–0.6.7) publishes a single `LineStroke` or
  `AggregatedStroke`. Heat-trace styling finds LineStrokes regardless of
  nesting, and the signal-line matcher keys on an ancestor named after the
  representation literal; both are best-effort until a profile publishes
  real instances.
- **Bus signal-line circles** use a 10 mm cadence from 5 mm, modelled on a
  single short official sample.
- **Hatch fill** has no fixture, so it is visually unverified; the PDF
  writer draws it as 25 % solid (pdf-lib has no pattern fills).
- **Text baked into catalogue symbol geometry** still scales with a scaled
  placement (only LabelTemplates are exempt); no official fixture places
  such a symbol at non-unit scale.
- **Heat-trace flat-side detection** is verified only for 0/90/180/270°
  placements.
- **Default heat-trace lateral offset** (1.5 mm when no profile
  `LineStroke` gives one) is a viewer choice awaiting sign-off.

## Maybe

- `IsHeatTracingSafetyCritical` is collected onto the scene
  (`heatTracingSafetyCriticalIds`) but nothing uses it yet. The attribute
  is now published (DiscProfile 0.6.4+), so a highlight mode or
  validation rule is possible once there is a concrete ask.
- Declare `"engines": { "node": ">=22" }` in package.json — jsdom 30
  (via undici) can't start under Node 20, so the test suite fails with an
  unhelpful worker error there. CI already uses Node 24.
- Heat-trace overlays that follow a PIF outline (the prior-art viewer's
  third category).
- Attribute fill-rate / completeness dashboard (a by-product of model
  validation).
- Model validation value-kind checks (string vs double) — skipped as
  false-positive prone.
- Id-less conceptual children are invisible to the plant model and the
  Properties panel (labels already resolve through them).
- Inspect: show each profile-symbol primitive/LabelTemplate as its own
  graph node instead of rows on the symbol card.
- Recent files via the File System Access API (the browser cannot reopen
  local files without stored handles).
- Profile break labels use the global 1.4× line spacing; the official tool
  uses 1.0× (top line ~1.3 mm higher). Accepted delta.
