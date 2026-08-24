# Conventions beyond the spec

Several things every reader of DEXPI files must decide are **not defined by any spec**: neither the DEXPI 2.0 specification, the XML schema, nor the DISC profile says how to draw them. This page documents where this viewer follows *conventions recovered empirically* from the official DISC_EXAMPLE-14 renderings (15 sheets with authoritative SVGs), what the evidence was, and which known deltas remain. Everything here is a candidate for standardization upstream.

## Signal-line styling

The XML gives **every** signal-family ConnectorLine the same authored stroke (`LongDash`, 248 lines across all 15 sheets), and DiscProfile 0.6.3 defines only the `SignalConveyingFunctionTypeRepresentation` *attribute* — no line graphics. The viewer styles the line by semantics and synthesizes repeated mark glyphs, following the DISC decoration table:

| `SignalConveyingFunctionTypeRepresentation` | Preview | Rendering |
| --- | --- | --- |
| — (`MeasuringLineFunction`) | ![measuring](signals/measuring.svg) | solid, no marks |
| `SignalConveying` (plain, no sub-type) | ![signal](signals/signal.svg) | dashed 3/3, no marks |
| `ElectricalSignalConveying` | ![electrical](signals/electrical.svg) | solid + repeated italic **E** |
| `HydraulicSignalConveying` | ![hydraulic](signals/hydraulic.svg) | solid + repeated upright **L** |
| `BusSignalConveying` | ![bus](signals/bus.svg) | solid + repeated small circle |
| `PneumaticSignalConveying` | ![pneumatic](signals/pneumatic.svg) | solid + repeated **^** chevron |
| `CapillarySignalConveying` | ![capillary](signals/capillary.svg) | solid + repeated small **x** |
| `UndefinedSignalConveying` | ![undefined](signals/undefined.svg) | solid + repeated **/** slash |
| `ElectromagneticGuidedSignalConveying` | ![em-guided](signals/em-guided.svg) | solid + repeated **~** squiggle |
| `ElectromagneticUnguidedSignalConveying` | ![em-unguided](signals/em-unguided.svg) | line hidden entirely — only the repeated **~** squiggle draws (no physical conductor to depict) |
| attribute absent / unknown value | ![authored](signals/authored.svg) | the file's authored stroke is kept unchanged (LongDash shown) |

Marks repeat every 6.5 mm starting 2.5 mm in (cadence measured from the official electrical samples), rotated to the local line direction; circles keep the observed 10 mm cadence starting 5 mm in. Glyphs are hand-drawn vectors (~2.5 mm tall) so SVG/PDF exports need no font.

**Profile precedence:** if a loaded DISC profile publishes `Profile/LineStroke` styling for signal types (0.6.3 publishes none), the profile's styling wins by default. Settings → Rendering → *Built-in signal-line styling* forces the table above instead — useful while profile styling is early-stage.

## Profile label placement

The profile defines label templates but not how a placement's rotation affects them. Recovered rules:

- Labels follow the placement rotation **normalized to the readable half-plane**: 90→270 and 180→0 flip by 180° (offsets rotate with the flipped angle); 0 and 270 stay. Official evidence: vertical valves and line labels render `rotate(270)` whether the usage says 90 or 270; the 180°-rotated off-page connector's text stays upright at unrotated offsets.
- **Exception:** PropertyBreak placements keep their value labels entirely in sheet space (the 270°-rotated breaks show them horizontal at unrotated offsets).
- Multi-line label values are ONE bottom-anchored block growing upward. Known delta: this viewer uses its global 1.4× line spacing; the official tool uses 1.0× for break labels (top line ~1.3 mm higher here).
- Per-line whitespace is trimmed — browsers collapse it when rendering the official SVGs, and real data pads lines (a BreakValue line carries 48 leading spaces in DISC_EXAMPLE-14-12); drawing the literal spaces shoved the line ~44 mm sideways.

## Attribute resolution for labels

- `<ProcessPlantIdentificationCode>-<PlantSystemIdentificationCode>` ("D-20") on balloons whose represented object carries no references (inline flow elements): resolved from the document's **unique** PlantStructureItem carriers — only when every carrier agrees; multi-system files stay blank rather than guessed.
- `<TypeCode>` placeholders resolve through the object's References into the profile's published instances, rendering the instance's `Abbreviation` ("MCC", "PSD", "M").

## Display codes not applied

`FailAction` enum literals render as their literal name ("FailClose") when the file omits the spec's `FailActionRepresentation` display string. The official tool substitutes conventional codes (FC / FM); this viewer deliberately does not invent them (pending project decision) — supply `FailActionRepresentation` in the data for the short codes.

## Other notes

- The rootless "/Border" shape is a well-known representation shape whose geometry no published catalogue ships — the exporting tool draws it; this viewer reports it as a warning and cannot draw it.
- Validation conventions with empirical tuning: nominal-diameter mismatch (`CON-004`) compares like representations only and skips segment endpoints (a PipeReducer inside a segment legitimately changes DN); piping-class changes (`CON-005`) are informational because PropertyBreaks legitimately mark transitions.

Details and dated evidence for each item live in the repository's `DESIGN.md` decisions log.
