# Changelog

Newest first. Each heading is the date and the package.json version the
work came *after*; the release that follows ships it. Format rules are in
CLAUDE.md.

- **2026.11.19** (>0.1.39):
  - **Changelog format: detailed entries** — director: the dated entries
    that used to live in DESIGN.md were more useful than one-line
    summaries, so the changelog now carries that level of detail.
    - CLAUDE.md's changelog rule now spells out the entry shape: a bold
      title with the what/why/trigger, then detail bullets for the rule
      now in force (with files/functions), root cause, decisions and
      rejected alternatives, verification, known gaps (also to
      OPEN_ITEMS.md) and corrections to earlier entries. It also states
      that history belongs here and DESIGN.md keeps only the current rule.
    - The backfilled entries below (0.1.34 → today) were rewritten to that
      shape from the old DESIGN.md log and the commits.
  - **Documentation cleanup** — README.md, DESIGN.md and the milestone list
    had grown into an unreadable mix of current rules, history and stale
    facts (director's ask).
    - README.md (260 → ~110 lines): a plain feature list linking to the
      manual pages, getting started with the full scripts table, stack,
      layout, license. Nothing release-specific (no profile versions, rule
      counts or milestone status), so it doesn't need touching at release
      time.
    - DESIGN.md (2,600 → ~590 lines): rewritten as the current design.
      Milestones and the dated decisions log were dropped; every rule still
      in force is stated once, in its final form, per subsystem (document
      model, rendering and overlay passes, drawing text and labels, signal
      lines, heat tracing, DISC profiles, validation, panels, exports,
      docs/deploy, testing). The decisions log is now a short list of
      lasting decisions.
    - New OPEN_ITEMS.md for todos and maybes (Todo / Waiting on data or the
      spec / Maybe), gathered from the open milestone items and the
      "deferred"/"not done" notes in the old log.
    - New CHANGELOG.md, backfilled from 0.1.34.
    - Stale facts fixed on the way: README described the ALT+4-digit
      hotkeys (replaced in August), `build` writing to `docs/` (now `dist/`,
      deployed by CI), "all milestones complete" (performance pass still
      open), Vite 7, an incomplete scripts table and layout; DESIGN.md
      referenced `tredespace-ui-0.0.56.tgz` and the removed
      `external/tredespace-client.ts`, an outdated architecture tree, and
      carried an unchecked TextTemplate item that M2 marked done.
    - Checked against the code while rewriting: signal-line styles (every
      marked type is solid; only plain SignalConveying is dashed) and
      heat-trace inheritance (`None` inherits like an absent value — only
      `NoHeatTracingSystem` blocks).
    - Deferred: the old `docs/` build output (~410 tracked files) is no
      longer used by deployment; listed in OPEN_ITEMS.md, not deleted.
    - Added to OPEN_ITEMS.md after review: ND0043's 0.6.7 template still
      names `<CommissioningPackage>`, which the same release renamed to
      `CommissioningPackageIdentifier` — the 2026.11.18 entry recorded it
      as accepted, but it is an open upstream bug. Director: the test user
      reports it to DISCDEXPI; no alias in the viewer.
    - OPEN_ITEMS.md audited against the old DESIGN.md log and the code (no
      TODO/FIXME comments exist): the profile-`LineStroke` item now covers
      heat tracing too (no bundled catalogue publishes any LineStroke);
      the safety-critical item notes the attribute is published since
      0.6.4; added a maybe for declaring Node ≥ 22 in package.json.
      Confirmed closed: the outdated export screenshot (retaken in the
      2026.10.10 manual rewrite), the `objectDiagram` navigable test drift,
      Node Positions in As viewed exports, and the heat-trace "reconcile
      the offset side" note (superseded by the always bottom/right rule).
    - New todo (director): open multiple diagrams with the minimap showing
      them all, scheduled after the stability bugs; OPEN_ITEMS.md lists the
      single-document assumptions it has to change.

- **2026.11.18** (>0.1.39):
  - **DiscProfile 0.6.7 bundled as the latest release; 0.6.3 dropped from
    the ribbon** — director, off the pack's
    `DiscProfile_Changes_0.6.6_to_0.6.7.md` and requirements rev 6.3.
    - `public/profiles/DiscProfile-0.6.7.xml` (8.3 MB, byte-identical to
      upstream's `DISC Profile 0.6.7.xml.zip` and `Profile/xml/`).
      `BUNDLED_PROFILE_VERSIONS` is 0.6.7 / 0.6.6 / 0.6.4 / 0.6.3 and
      `LATEST_BUNDLED_PROFILE` 0.6.7 (Ctrl+Shift+L, symbols.md). Version
      detection needed no change: the stamp and URIs keep the 0.6.4 shape.
    - New `RIBBON_PROFILE_VERSIONS` (0.6.7 / 0.6.6 / 0.6.4) drives the
      version minis, still three high. 0.6.3 stays bundled because
      `PRE_STAMP_VERSION` resolves unversioned imports to it under Auto and
      the DISC_EXAMPLE-14 blueprints only validate against it. When Auto
      lands on 0.6.3 no mini lights; the status bar still names it.
    - No code change was needed for the profile content; everything is
      data-driven. ND0003 / ND0272 gain the bare `'H'` / `'L'` alarm
      letters, and the 2026.10.22 rule (`resolveLiteralText`) already keys
      on the text, not the symbol, so they stay conditional. The new
      text-only labels ND0314–ND0321 are Core.Diagram.Label symbols with no
      primitives; a Label group's `Represents` target is the object their
      placeholder resolves on, the same path the 32 Label symbols of 0.6.6
      use.
    - Director's rule for this release: behaviour follows the SELECTED
      profile, not the document and not a newer/older release.
    - New MDL-010 "Class not in selected DISC profile" (warning,
      `profileClassValidation.ts`). Base-model validation leaves
      `DiscProfile/…` classes out of scope and uses `classSupers` only for
      reference-target compatibility, so before this an unknown profile
      class passed silently. MDL-010 checks every object typed in the
      document's DiscProfile namespace (its own Import prefix, via
      `detectProfileImportPrefix`) against the loaded catalogue's classes,
      one aggregated finding per class. TieInPoint passes against 0.6.6 and
      is flagged against 0.6.7. Silent with no catalogue loaded (GFX-001
      covers that) or no DiscProfile import. Across the 15 DISC_EXAMPLE-14
      sheets: clean against 0.6.3 (their release); against 0.6.4+ two
      sheets flag LevelMeasuringInstrumentNuclear, which 0.6.4 removed.
    - Not purely additive, unlike 0.6.6. Property-break values move off the
      break onto the PipingNetworkSegments either side (rev 6.3); ND0007 /
      ND0242 lose their `<BreakValue1>` / `<BreakValue2>` labels and, with
      ND0043, are relinked to Core.Diagram.Label. The sheet-space rule in
      `buildProfileLabelOverlays` keys on a PropertyBreak represented type,
      so 0.6.7 break labels placed on a Label rotate with their placement.
    - ND0043's template still reads
      `<TieInPointIdentifier>\n<CommissioningPackage>`, though 0.6.7 renamed
      the attribute to `CommissioningPackageIdentifier` (on Nozzle and
      PipeFitting). Director: render what the selected profile publishes —
      no alias from the old name to the new one, so the second line picks
      up `CommissioningPackage` only. If upstream fixes the template, the
      next catalogue carries the fix. Tracked in OPEN_ITEMS.md: on a
      0.6.7-conformant drawing that line is always blank.
    - Verification: pinned in `discProfileOfficial.test.ts` ("what 0.6.7
      changed against 0.6.6"; 354 symbols / 401 variants / 253 with
      templates; the primitive-less list is now per release). Generated
      docs refreshed; `documentation/symbols/ND0273.svg` removed (ND0273 is
      text-only now). Needs testing in the app.
    - Known gaps (in OPEN_ITEMS.md): no 0.6.7 sample drawing exists (the
      blueprints are 0.6.3); accepted by the director that 0.6.7
      break-value labels on a Label rotate with their placement — revisit
      when a sample exists; profile-property checks (UsageConstraint
      allowed properties, e.g. the dropped BreakValue1/2) are not covered.

- **2026.11.10** (>0.1.38):
  - **CI deploys and a preview build** — run prod and a preview of `dev`
    side by side.
    - `.github/workflows/pr.yml`: PRs to `main`/`dev` run typecheck, lint,
      test and build; a PR to `main` must raise the version
      (`scripts/checkVersionBump.mjs` compares against `origin/main`).
    - `deploy.yml` (reusable, called by `update_main_demo.yml` /
      `update_dev_demo.yml`, one at a time via a `livedemo` concurrency
      group): runs check + test, builds, and publishes to the `livedemo`
      branch — `main` at the root (<https://vegarringdal.github.io/dexpi-viewer/>),
      `dev` under `/preview/`. Each deploy replaces only its own part.
    - Dev builds carry version `<v>-next.<run>` (`APP_VERSION`, read by
      `vite.config.ts`) so the About tab shows which preview is live.
    - Build output moved from the committed `docs/` folder to `dist/`.
  - **localStorage keys prefixed per build** — prod and preview share the
    `vegarringdal.github.io` origin and would otherwise share settings.
    - `storageKey()` (`src/lib/storageKey.ts`) prefixes every key with
      `VITE_STORAGE_PREFIX` (`PROD_` / `PREVIEW_` from CI, `LOCAL_`
      otherwise); every persisting actions module goes through it.
    - Migration: the first time a prefixed key is missing, the old
      unprefixed value is copied over and left in place, so prod and
      preview both pick up existing users' settings.
  - **Test timeout raised for GitHub Actions** — `testTimeout` and
    `hookTimeout` 20 s in `vitest.config.ts`; the official-catalogue tests
    are slow on CI runners.
  - **Lint fix** in `src/globals.d.ts`.

- **2026.10.22** (>0.1.37):
  - **DiscProfile 0.6.6 bundled as the latest release** — director, off the
    pack's `DiscProfile_Changes_0.6.4_to_0.6.6.md`. Upstream skipped 0.6.5;
    there is no such file, so no document can legitimately declare it.
    - `public/profiles/DiscProfile-0.6.6.xml` (8.2 MB, byte-identical to
      upstream's `DISC Profile 0.6.6.xml.zip` and `Profile/xml/`);
      `BUNDLED_PROFILE_VERSIONS` is 0.6.6 / 0.6.4 / 0.6.3 and
      `LATEST_BUNDLED_PROFILE` 0.6.6, which moves the Ctrl+Shift+L hotkey
      and the generated symbols.md along. Version detection needed no
      change: the 0.6.6 stamp and URIs have the 0.6.4 shape. The
      `refrences/` mirror is synced to upstream `dbbd4ec` (0.6.6 XML, both
      0.6.6 zips, the change reports, requirements rev 6.2).
    - Ribbon Profile section relaid (director): Auto and Custom profile as
      mediums sharing the first column, the three version minis stacked in
      the second — the section packs children by size, so this is order and
      size only. Custom profile is no longer a big button.
    - The one behavioural change: 0.6.6 cuts the H and L alarm templates of
      ND0006 / ND0269 / ND0270 / ND0271 to bare literals (`'H'`, `'L'`). The
      `SignalConveyingFunction:<AlarmValue>` role path that used to suppress
      them on an instrument WITHOUT that alarm went with the value, so a
      literal template would have lit H and L on every such instrument
      lacking authored text. Director's call: a template that is nothing
      but an alarm letter stays conditional on a SignalConveyingFunction
      child with the matching PortStatus (`resolveLiteralText` in
      profileLabels.ts) — the 0.6.4 behaviour minus the value. A scan of all
      three catalogues found bare alarm letters only on those four symbols
      and only in 0.6.6, so the rule catches nothing else.
    - Everything else is additive and data-driven: 51 symbols, 20 classes,
      IOPS → IOPPS, the High/Low type codes, ND0186's label moved to
      LeftTop.
    - Verification: pinned in `discProfileOfficial.test.ts` ("what 0.6.6
      changed against 0.6.4"; 343 symbols / 388 variants / 244 with
      templates, cross-checked against an independent count of the XML).
    - Deferred on purpose (in OPEN_ITEMS.md): equipment boxes
      (ND0300–ND0310) resolve their placeholders through the 2-hop search,
      which cannot tell the heat exchanger box's Cooling Chamber (rows D/E)
      from its Heating Chamber (rows F/G); rev 6.2 has the B label carry
      authored Text rows, which suppress the overlay anyway, and no 0.6.6
      sample drawing exists. Rev 6.2 §7.5's "rule B" label alignment under
      rotation/mirroring is a requirements change rather than a profile
      one, and the note it cites is not in the pack — not implemented.

- **2026.10.10** (>0.1.37):
  - **Manual rewrite with numbered screenshots** — director: "improve our
    user documentation a lot", modelled on the tredespace.com guide.
    - Callouts are no longer baked into the PNGs:
      `generateDocScreenshots.mjs` captures clean images and records
      numbered marks (boxes measured with Playwright `boundingBox()` of the
      real controls, CSS px relative to the clip) in
      `documentation/images/shots.json`; `buildDocsSite.mjs` overlays them
      as positioned HTML (percent boxes + fixed-size badges), so badges stay
      sharp at any width, follow the theme, and match `(#n)` chips in the
      text.
    - Markdown conventions on top of GFM, all degrading to readable plain
      markdown on GitHub: an image alone in a paragraph becomes a
      click-to-zoom figure; an ordered list right after it is its legend;
      `(#3)` is a marker chip; `<!-- steps -->` before an ordered list
      renders numbered step bullets; `> [!NOTE]`/`[!TIP]`/`[!WARNING]`
      become callouts; headings get slug ids for deep links.
    - Every shot runs in a fresh browser context (default layout, no
      localStorage) on DISC_EXAMPLE-14-08 + profile 0.6.3, at 1560×900 —
      narrower and the ribbon scrolls, cutting off Help — and 1.5× pixel
      ratio; figures display at native pixel size (`scale` in the
      manifest). Shots are named functions so
      `node scripts/generateDocScreenshots.mjs <name…>` re-takes just
      those; a failing shot saves `temp/<name>-failed.png` and the run
      continues.
    - Gotchas found driving the UI: hidden dock tabs keep their DOM, so
      locators need `:visible`; widening a dock resizes the canvas without
      a re-fit, so sheet-mm clicks press Fit first; Label Inspect / Node
      Positions sections start open (clicking their header collapses them).
    - Content: pages restructured task-first (legend + steps + reference
      detail); new pages `tasks.md` (common recipes), `explorer.md`
      (Explorer + Properties, previously undocumented), `highlight.md`
      (split from topology.md; Label Inspect and Node Positions now
      documented) and `settings.md` (all settings, full default keymap,
      what persists). Sidebar grouped (Guide / Panels / Reference); the
      landing page is a card grid of thumbnails.
    - Stale statements fixed against the code: "Dim others" is **Dim
      drawing** (a whole-sheet veil under every overlay); double-click zooms
      the drawing only from Topology graph nodes (Explorer has **Zoom to**,
      Validation's ↳ link selects + zooms); Inspect drawing cards drive the
      Diagram Tree and global selection; as-viewed exports include the
      Label Inspect / Node Positions overlays.

- **2026.09.22** (>0.1.36):
  - **LabelTemplate position and size are sheet units** — a placement's
    ScaleX/ScaleY applies to symbol geometry only, never to its profile
    labels. Reported from a real enhanced file: a CustomEquipmentPackage
    drawn with ND0044 stretched ~4.5× in X and ~32× in Y rendered its
    3.3 mm tag ~107 mm high, a third of the sheet.
    - Recovered from the official renderings, not assumed:
      DISC_EXAMPLE-14-13 places ND0044 at (126,195) scale 4 — template
      offset (0,−0.5), size 3.3 — and the official SVG draws "D-20XX001" at
      (126,194.5) `font-size="3.3px"`, i.e. both offset and glyph height
      unscaled (a scaled offset would land at 193, a scaled size at 13.2px).
      ND0087 at (252,222) scale (1.25,1.5) with offset (0,17) confirms it
      on a non-uniform scale (official y 240.65 = 222+17 plus the
      CenterCenter baseline shift, not 222+25.5).
    - Rejected: the prior-art viewer counter-scales only the glyphs, which
      still mispositions the anchor. `placeLabelText` (profileLabels.ts) now
      transforms the template through the placement's
      position/rotation/mirror with scale forced to 1 — mirroring still
      flips the anchor, since that follows the geometry the label annotates.
    - Verification: pinned by `profileLabelsOfficial.test.ts` ("keeps a
      label at its authored size and offset on a scaled placement").
    - Known gap (in OPEN_ITEMS.md): text primitives baked into a symbol's
      own catalogue geometry still scale with the placement — the prior art
      exempts only TextTemplate-driven ones, and no official fixture places
      such a symbol at a non-unit scale.

- **2026.09.22** (>0.1.35):
  - **TypeCode badges render beside an authored tag** — director, from a
    real enhanced DEXPI+DiscProfile file: a MagneticFlowMeter's inline
    symbol carries two overlaid Profile/Symbols representing the same
    InlineMeasuringElement — ND0124's `<TypeCode>` template drawing the
    abbreviation on the symbol, ND0248B's five templates drawing the
    tag/setpoint bubble around it. The authored diagram label only covers
    Sequence/TagSuffix, yet the ownership rule (any authored text on the
    object suppresses every LabelTemplate) killed ND0124's TypeCode overlay
    too, so the DISC-mandated "M" never rendered.
    - `collectExplicitlyLabelledIds` (sceneGraph.ts) now records, per
      object, the bare attribute names its authored Text elements name
      (from `Core/Diagram.Text`'s `Template`/`Fragments`/`AttributeName`).
      `isLabelTemplateCovered` (profileLabels.ts) uses that only for a
      template whose sole placeholder is TypeCode: it is suppressed only
      when an authored text names TypeCode. Every other placeholder keeps
      the coarser rule — any authored text on the object covers it.
    - Rejected: matching attribute names generally under-suppressed
      ND0248B's SetPoint/TagType/Sequence templates whenever their names
      didn't line up with the authored text (director: "you render too much
      junk now"), so the rule stays narrow to TypeCode.
    - `buildProfileLabelOverlays` moved the check from a whole-object gate
      to per-template; `buildSceneGraph` calls it twice — once with an
      empty map for the unfiltered Label Inspect overlay, once with the
      ownership map for the rendered set.

- **2026.09.15** (>0.1.34):
  - **DiscProfile 0.6.4 vendored, both releases bundled, and the catalogue
    follows the document's version** — director, off the pack's
    `DiscProfile_Changes_0.6.3_to_0.6.4.md`. 0.6.4 is the first release to
    stamp a version (`MetaData/version` plus a version-qualified
    `Model/@uri`); drawings written against it import
    `http://www.to.define/DiscProfile/0.6.4` instead of the bare
    `http://www.to.define`. That stamp is what makes multi-version support
    possible at all.
    - `public/profiles/` holds `DiscProfile-0.6.3.xml` and
      `DiscProfile-0.6.4.xml`; the `refrences/` mirror tracks upstream's
      current release only. Every test parses the bundled files, so the
      same 6.4 MB catalogue is not stored twice per release.
    - `profileVersion.ts` owns the version vocabulary: the bundled
      registry, `PRE_STAMP_VERSION` (an unversioned import means 0.6.3, not
      "unknown"), the URI parser, and two readings of a document's
      declaration — `detectDeclaredProfile(root)` for validation, and
      `detectDeclaredProfileFromText` for the loader, which must choose a
      catalogue before the document is parsed and won't DOM-parse a
      multi-megabyte drawing twice for one URI (it scans the prologue
      before the first `<Object>`).
    - Profile state moved out of `viewer.state` into `src/state/profile/`:
      `ActiveProfile` is a discriminated union (none / bundled+version /
      custom+fileName+version), plus `isPinned`, the persisted `autoLoad`
      opt-in and the document's `declaredVersion`. `profile.actions.ts`
      owns the parsed-catalogue handle and knows nothing about documents;
      `viewer.actions.ts` composes the two, keeping the dependency
      one-directional.
    - Autoload is off by default (director): the ribbon Profile section
      (Auto / 0.6.4 / 0.6.3 + Custom profile) is the primary control, and
      Settings → Profile carries the opt-in with a live "declares X /
      active Y" readout. A hand-picked version pins; Auto releases the pin.
      A version we don't bundle is never substituted: the new **META-003**
      rule warns and the status bar turns amber.
    - Root cause of the one real bug in the diff: 0.6.3 shipped its alarm
      templates malformed (`H=' & SignalConveyingFunction:<AlarmValue>`,
      missing the opening quote) and profileLabels.ts compensated with a
      blunt `replace(/'\s*&\s*/g, "")`. Against 0.6.4's corrected
      `'H=' & …` (plus new `'SP = ' & <SetPoint>` /
      `'Min: ' & <LowerLimitEndToEndLength>`) that leaves a stray leading
      quote, which defeats `extractPortStatusHint`'s `^(HHH|HH|H|…)=` anchor
      — alarm placeholders would silently fall back to positional matching
      and show the wrong alarm's value. `labelExpression.ts` now reads the
      VB-style form properly (single-quoted literals, `''` escape, `&`
      concatenation) and repairs the 0.6.3 spelling on the way in (an odd
      quote count means the first quote closes a literal never opened).
    - Everything else in the report is data-driven: the new
      class/attributes, 8 new symbols, relinked ND0035/ND0129, and the
      withdrawn `MeasuringLineFunction` rule (the Profile.xml rule set was
      never implemented here).
    - Verification: `discProfileOfficial.test.ts` is parameterized over
      both releases (284/320/210 for 0.6.3, 292/328/215 for 0.6.4) with a
      diff block tracking §3–§4 of the report, and asserts both alarm
      spellings normalize to the same text; the DISC_EXAMPLE-14 sheet
      regressions stay on 0.6.3, the release those sheets declare.

- **2026.09.04** (>0.1.33):
  - **Highlight panel becomes three composable sections** — director. The
    classification UI moves unchanged into **General Highlight**
    (`GeneralHighlightSection.tsx`), joined by **Label Inspect** and **Node
    Positions**; `HighlightPanel.tsx` is just the shell + empty state. The
    overlays compose, each painting on top of the others.
    - Label Inspect (`src/state/labelInspect/`) draws every profile
      LabelTemplate at its own position/rotation/size/alignment, in a
      chosen colour, opacity and depth, to compare a generated file's label
      placement against what the profile prescribes. The placements worth
      checking are exactly the ones the viewer suppresses, so
      `buildSceneGraph` resolves templates once with an empty suppression
      set (`scene.labelTemplateNodes`) and filters that for rendering —
      equivalent because suppression is per placement and `roleCounters`
      are per entry.
    - "Behind drawing" means behind the geometry but still on the sheet:
      `drawPaper` split out of `drawSceneContent`, and the picture is
      recorded with `hidePaper` in that mode.
    - Node Positions (`src/state/nodePositions/`) marks connection points.
      `Profile/NodePosition` was never parsed — `discProfile.ts` now reads
      it per SymbolVariant (`Position` + the `Profile/NodePositionType`
      literal, kept as an open string so a future literal surfaces) and
      each placement transforms its points. `parseNodePositions` emits the
      file side from the same scan that feeds connector stitching, id-less
      ones included, skipping `Profile/`-prefixed types. Rows come from
      `collectNodePositionKinds` over the loaded drawing — no hardcoded type
      list. Per-kind colour/scale live in a store keyed `"<source>:<kind>"`
      with defaults by source (file blue, profile orange).
    - Cost to measure (in OPEN_ITEMS.md): templates on explicitly-labelled
      objects are now resolved at parse time instead of skipped.
  - **Node-position markers sized in drawing mm** — director, from
    screenshots; corrects the screen-constant first cut.
    - Root cause: a fixed screen size makes the size relative to the symbol
      swing with zoom — 9 px blobs swamped an A1 sheet at fit zoom, and
      shrank to specks when zoomed in. Markers are now
      `MARKER_BASE_MM = 1.2` × the row's scale — measured: median symbol
      size in DISC_EXAMPLE-14-13 is 12 mm, and the director's pick is about
      a tenth of that. The stroke stays screen-constant
      (`MARKER_STROKE_PX = 1.4`).
    - General rule recorded: screen-constant only for things sized against
      the pointer or viewport; anything read against the drawing is in mm.
    - Scale and colour persist (`dexpi.nodePositions`); `enabled`
      deliberately does not — an overlay that switched itself back on at
      startup would read as the drawing having changed.
      `NODE_MARKER_SCALE_MIN/MAX/STEP` are exported so the stepper and the
      stored-value validator can't drift. **Reset scale** resets every
      stored kind, including ones from other drawings.
  - **Inspection overlays, second pass** — four director asks off a
    screenshot.
    - The profile marker is an unfilled triangle inscribed in the circle of
      the same radius (was an X that hid a coinciding circle), so a
      matching pair reads as a triangle inside its circle.
    - Per-kind outline width in mm (`widthMm`, default 0.15).
    - Both overlays reach the **As viewed** PDF/SVG. One builder
      (`lib/dexpi/inspectOverlays.ts`, `buildNodeMarkerPrims`) produces the
      primitives for canvas and exporters, so they can't drift. Overlays
      are appended after the recolour so no veil, tint or B/W remap touches
      them; Label Inspect opacity is flattened onto white (`fadeToPaper`).
    - Markers are ordinary `ScenePrimitive`s through `drawPrimitive`
      (`drawNodeMarkers.ts` deleted), inheriting the min-px clamp.
      `DrawContext.rawColors` skips the theme/monochrome remap for
      annotation, which would otherwise flatten markers to ink in B/W.
  - **Test files are typechecked again** — found while adding the above.
    - Root cause: `tsconfig.test.json` extends `tsconfig.app.json`, which
      excludes `src/**/*.test.ts`; an `include` in the child doesn't cancel
      an inherited `exclude`, so the second half of `npm run typecheck`
      checked nothing. Nine real errors were hiding (SceneGraph literals
      missing `heatTracedIds`/`heatTracingSafetyCriticalIds`, a
      `PolylinePrim` typo, three possibly-undefined indexes).
    - Fix: `"exclude": []` with a comment saying why; errors fixed. Two
      `doc?.scene ?? {empty scene}` fallbacks now throw if the fixture
      fails to parse — silently exporting an empty sheet is a worse failure
      than a loud one.
    - Verification: a deliberate type error planted in a test file makes
      `npm run typecheck` fail.
  - **One shared "Dim drawing", painted below every overlay** — director:
    "Dim buttons in all sections should be linked… since dim should not dim
    other highlight". Supersedes the per-section dim from the second pass
    above.
    - Root cause: three independent dim flags, and the inspection one
      veiled the sheet after the classification and trace passes, fading
      the highlights it was meant to make readable.
    - `highlightState.dimOthers` → `dimDrawing`, the single shared flag;
      the per-section flags are gone. All three checkboxes share one label
      and tooltip, and none is disabled.
    - The veil goes back first inside `drawSceneHighlights`, so
      classification, trace, label inspect and node markers repaint at full
      strength on a faded drawing (`drawInspectDimVeil` deleted). The gate
      is `dimDrawing && hasOverlay`, where `hasOverlay` counts label
      templates and node markers, so dim works with highlight mode Off.
    - Export follows: `ViewAppearance.dimAll` is gone; the existing
      per-node rule (`dimmed = dimDrawing && tint === null`) already
      expresses "fade the drawing, keep the overlays".
    - Deliberate asymmetry: a "behind"-placed Label Inspect overlay is
      dimmed, because on canvas the veil covers it; `sceneAsViewed`
      reproduces that with `dimNode` — "as viewed" means as viewed.
