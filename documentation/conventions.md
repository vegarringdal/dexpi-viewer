# Conventions beyond the spec

Several things every reader of DEXPI files must decide are **not defined by any spec**: neither the DEXPI 2.0 specification, the XML schema, nor the DISC profile says how to draw them. This page documents where this viewer follows *conventions recovered empirically* from the official DISC_EXAMPLE-14 renderings (15 sheets with authoritative SVGs), what the evidence was, and which known deltas remain. Everything here is a candidate for standardization upstream.

## Signal-line styling

The XML gives **every** signal-family ConnectorLine the same authored stroke (`LongDash`, 248 lines across all 15 sheets), and the DiscProfile defines only the `SignalConveyingFunctionTypeRepresentation` *attribute* — no line graphics. The official renderings override the stroke by semantics and synthesize mark glyphs that exist in no XML. Recovered mapping (zero exceptions across all sheets):

| Semantics | Preview | Rendering |
| --- | --- | --- |
| `MeasuringLineFunction` | ![measuring](signals/measuring.svg) | solid |
| `SignalConveying` | ![signal](signals/signal.svg) | dashed 3/3 |
| `ElectricalSignalConveying` | ![electrical](signals/electrical.svg) | solid + square-bracket glyphs every 6.5 mm, rotated to the line direction |
| `BusSignalConveying` | ![bus](signals/bus.svg) | dashed 2.75/4.75 + hollow circle marks (r 1.25 mm) |
| `HydraulicSignalConveying` | ![hydraulic](signals/hydraulic.svg) | solid — **no official sample exists**; project decision: a hydraulic signal is a fluid-filled line like a measuring line |
| any other value | ![authored](signals/authored.svg) | the file's authored stroke is kept unchanged (LongDash shown) |

Known uncertainty: the bus-circle cadence rests on a single 9 mm sample (one circle, 5 mm in — modelled as a 10 mm cadence).

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
