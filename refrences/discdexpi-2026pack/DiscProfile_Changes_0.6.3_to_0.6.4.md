# DiscProfile Model Comparison Report

### Class Modelling and Symbol Library: Version 0.6.3 → Version 0.6.4

**Prepared:** 14 September 2026
**Prepared for:** Users of the DiscProfile DEXPI extension model

## 1. Purpose and Scope

This report documents all differences between the version 0.6.3 and version 0.6.4 releases of the DiscProfile DEXPI extension model — the information model that defines equipment classes, attributes, and graphical symbols used across the DiscProfile profile.

Files compared:
*  DiscProfile.xml
*  Profile.xml

`Profile.xml` — the metamodel that defines symbols, symbol usage and the validation rules — has changed; see §5.

DiscProfile.xml change review covers changes to the class model (new, removed, reclassified, and modified classes and attributes), the usage constraint (profile scope), the feature-level constraint files, the symbol library (graphical objects, label templates, and their linkage to classes). Purely cosmetic differences in the underlying XML — element ordering, indentation, and floating-point coordinate rounding — are excluded.

The comparison was produced by structurally parsing both model files and diffing their class definitions, data properties, enumerations, constraint objects, and symbol catalogue entries.

## 2. Summary of Changes

| Model Element | v0.6.3 | v0.6.4 | Net Change |
|---|---|---|---|
| Concrete Classes | 173 | 172 | −1 (1 added, 2 removed) |
| Abstract Classes | 4 | 4 | No change |
| Class Extensions | 23 | 23 | No change (6 modified) |
| Data Properties on extensions | 101 | 110 | +9 |
| Enumerations | 3 | 3 | No change |
| Type-code packages | 5 | 5 | No change |
| Symbols (graphical) | 284 | 292 | +8 |
| Symbols modified | — | 49 | — |
| Allowed classes (UsageConstraint) | — | — | −2 / +1 |
| Allowed properties (UsageConstraint) | — | — | +9 |
| Validation rules (`Profile.xml`) | 7 | 6 | −1 (1 removed, 1 message reworded) |

### 2.1 Version Stamping (new in 0.6.4)

Version 0.6.4 is the first release to carry an explicit, machine-readable version stamp. This is a structural change to the file header that tooling reading the profile should be aware of:

| Item | v0.6.3 | v0.6.4 |
|---|---|---|
| `Model/@uri` (DiscProfile) | `http://www.to.define` | `http://www.to.define/DiscProfile/0.6.4` |
| `Profile` import source | `.../Temp/Profile` | `.../Temp/Profile/0.6.4` |
| `Model/@uri` (Profile.xml) | `http://www.dexpi.org/specification/Temp/Profile` | `http://www.dexpi.org/specification/Temp/Profile/0.6.4` |
| `MetaData/version` element | absent | `<String>0.6.4</String>` in all three files |

## 3. Class Model Changes

### 3.1 New Classes

| Class Name | Type | Superclass | Description |
|---|---|---|---|
| FlangeSpadeSpacer | ConcreteClass | `Plant/Piping.PipingComponent` | Flange Spade And Spacer — paired with new symbol ND0268 |

No new class extensions, abstract classes, or enumerations were introduced.

### 3.2 Removed Classes

| Class Name | Type | Superclass (v0.6.3) | Disposition |
|---|---|---|---|
| LevelMeasuringInstrumentNuclear | ConcreteClass | `Plant/Piping.InlineMeasuringElement` | Removed. Its symbol (ND0035 *Level Element*) is relinked to the standard DEXPI class `Plant.Instrumentation.ProcessInstrumentationFunction`. |
| PipingInstrInterface | ConcreteClass | `/InformationModel.LogicalBreak` | Removed. No symbol referenced it; no replacement. |

Both removals reflect a move away from DISC-specific subclasses where a standard DEXPI class already carries the meaning.

### 3.3 New Attributes (Data Properties)

Nine new data properties were added across six existing class extensions. All are optional (`lower="0" upper="1"`) and, unless noted, are an optional string union (`Undefined | String`).

| Class Extension | Attribute | Data Type | Description | RDL URI |
|---|---|---|---|---|
| CheckValveExtension | ShutoffCapability | Undefined \| String | Value to show on P&ID to indicate if there is a shutoff leakage capability e.g. Tight Shut-off (TSO). | `http://noaka.org/rdl/ShutoffCapabilityAssignmentClass` |
| OperatedValveExtension | ShutoffCapability | Undefined \| String | As above. | `http://noaka.org/rdl/ShutoffCapabilityAssignmentClass` |
| PipingComponentExtension | PipingToFromEndpoint | Undefined \| String | Text string, typically from a predefined project list of values, to be shown at the start/end point of a line where there is no further piping connection. | `http://noaka.org/rdl/PipingToFromEndpointAssignmentClass` |
| PipingNetworkSegmentExtension | LineId | Undefined \| String | Line ID to drive the line break. | `http://noaka.org/rdl/LineIdAssignmentClass` |
| PipingNetworkSegmentExtension | ScopeIdentification | Undefined \| String | Scope identifier to drive the scope break. | `http://noaka.org/rdl/ScopeIdentificationAssignmentClass` |
| PipingNetworkSegmentExtension | PipeSlopeRatio | Undefined \| String | Show the slope ratio. | `http://noaka.org/rdl/PipeSlopeRatioAssignmentClass` |
| PipingNetworkSegmentExtension | LowerLimitEndToEndLength | Undefined \| PhysicalQuantity bound to LengthUnit | The minimum length of the PipingNetworkSegment. | `http://data.posccaesar.org/rdl/RDS376649` |
| ProcessEquipmentExtension | SpecialItemNumber | Undefined \| String | Text for special item identification, to be shown in the SpecialItem label. | `http://noaka.org/rdl/SpecialItemNumberAssignmentClass` |
| SignalConveyingFunctionExtension | HeatTracingType | `Plant/Enumerations.HeatTracingTypeClassification` | Indicates which type of heat tracing is used. | `http://sandbox.dexpi.org/rdl/HeatTracingTypeSpecialization` |

Notes:

- `LineId` and `ScopeIdentification` are the driving attributes behind the `LineIdBreak` and `ScopeBreak` logical break types; adding them to PipingNetworkSegment closes a gap where those break types had no source attribute in the model.
- `LowerLimitEndToEndLength` is the only new attribute that is a physical quantity rather than a display string, and the only one that reuses a POSC Caesar RDL reference rather than a noaka.org assignment class.
- `HeatTracingType` on SignalConveyingFunction is a strongly typed enumeration reference, not a union — an undefined value is not permitted.

No data properties were removed.

### 3.4 Modified Attributes

| Class Extension | Attribute | Change |
|---|---|---|
| CheckValveExtension | NominalDiameterRepresentation | RDL URI moved from `http://noaka.org/rdl/...` to `http://sandbox.dexpi.org/rdl/NominalDiameterRepresentationAssignmentClass` |
| OperatedValveExtension | NominalDiameterRepresentation | Same URI move as above |

Data type, cardinality, description, and RDL label are unchanged for both. This is a reference-source correction, migrating the attribute from the DISC/noaka namespace to the DEXPI sandbox namespace.

### 3.5 Enumerations and Type-Code Packages

No changes. All three enumerations and all five type-code packages (`ControlledActuatorTypeCodes`, `InlineMeasuringElementTypeCodes`, `MotorTypeCodes`, `ProcessInstrumentationFunctionTypeCodes`, `TurbineTypeCodes`) are identical between the two versions.

### 3.6 Profile Scope (UsageConstraint)

**Allowed classes**

| Change | Entry |
|---|---|
| Added | `DiscProfile.InformationModel.FlangeSpadeSpacer` |
| Removed | `DiscProfile.InformationModel.LevelMeasuringInstrumentNuclear` |
| Removed | `DiscProfile.InformationModel.PipingInstrInterface` |

**Allowed properties** — nine additions, matching the nine new data properties in §3.3 one-for-one:

- `CheckValveExtension.ShutoffCapability`
- `OperatedValveExtension.ShutoffCapability`
- `PipingComponentExtension.PipingToFromEndpoint`
- `PipingNetworkSegmentExtension.LineId`
- `PipingNetworkSegmentExtension.LowerLimitEndToEndLength`
- `PipingNetworkSegmentExtension.PipeSlopeRatio`
- `PipingNetworkSegmentExtension.ScopeIdentification`
- `ProcessEquipmentExtension.SpecialItemNumber`
- `SignalConveyingFunctionExtension.HeatTracingType`

No allowed properties were removed.


## 4. Symbol Library Changes

Total symbols: 284 → 292. No symbols were removed. Eight were added and 49 were modified. Label template objects rose from 299 to 328.

### 4.1 New Symbols

| Symbol | Description | Linked Class (`MetaData/usage`) | Variants | Nodes | Bounding Box |
|---|---|---|---|---|---|
| ND0268 | Flange Spade And Spacer | `DiscProfile.InformationModel.FlangeSpadeSpacer` | ND0268_0 | 2 | (−3, −8) – (3, 8) |
| ND0269 | SAS Function | `Plant.Instrumentation.ProcessInstrumentationFunction` | ND0269_0 | 4 | (−6, −6) – (6, 6) |
| ND0270 | SAS Function Inaccessable | `Plant.Instrumentation.ProcessInstrumentationFunction` | ND0270_0 | 4 | (−6, −6) – (6, 6) |
| ND0271 | SAS Function VDU Local | `Plant.Instrumentation.ProcessInstrumentationFunction` | ND0271_0 | 4 | (−6, −6) – (6, 6) |
| ND0272 | Non Sas Function Local | `Plant.Instrumentation.ProcessInstrumentationFunction` | ND0272_0 | 4 | (−10, −6) – (6, 6) |
| ND0273 | Segment Minimum Length | `Core.Diagram.Label` | ND0273_0 | 2 | (−5, −1) – (5, 3) |
| ND0274 | Instrument Piping Delimiter | `Core.Diagram.Label` | ND0274_0 | 1 | (−8, −12) – (8, 0) |
| ND0275 | Chemical Cleaning | `Core.Diagram.Label` | ND0275_0 | 1 | (0, −12) – (4, 0) |

Groupings:

- **ND0269–ND0272** are the new SAS / non-SAS instrument function symbols supporting the new `NonSAS` ProcessInstrumentationFunctionType introduced in the requirements document (§6.4).
- **ND0273** is the graphical counterpart to the new `LowerLimitEndToEndLength` attribute.
- **ND0268** is the graphical counterpart to the new `FlangeSpadeSpacer` class.
- **ND0273–ND0275** are label-class symbols (`Core.Diagram.Label`) rather than object symbols.

### 4.2 Modified Symbols

#### 4.2.1 Valve label template — `ShutoffCapability` added (38 symbols)

The valve label template text changed from:

```
<NominalDiameterRepresentation><ValveDataSheet>
<TrimType> <LockMechanism>
```

to:

```
<NominalDiameterRepresentation><ValveDataSheet>
<TrimType> <LockMechanism> <ShutoffCapability>
```

Affected symbols (72 label template occurrences across all variants):

| Symbol | Description | | Symbol | Description |
|---|---|---|---|---|
| ND0004 | Modular Valve Double Isolation and Bleed | | ND0185 | Valve Min. Flow And Check |
| ND0005 | Modular Valve Double Block Bleed and Check | | ND0186 | Valve Choke |
| ND0012 | Wedge Gate Valve (Manual Valve) | | ND0188 | Valve Check |
| ND0012A | Wedge Gate Valve (actuated valve) | | ND0189A | Valve Pinch (Manual Valve) |
| ND0029 | Double Isolation Ball Valve (DIB-2), manual | | ND0189B | Valve Pinch (Actuated Valve) |
| ND0029A | Double Isolation Ball Valve (DIB-2), actuated | | ND0190A | Valve Diaphragm (Manual Valve) |
| ND0030 | Double Isolation Ball Valve (DIB-1), manual | | ND0190B | Valve Diaphragm (Actuated Valve) |
| ND0030A | Double Isolation Ball Valve (DIB-1), actuated | | ND0191A | Valve Needle (Manual Valve) |
| ND0042A | Axial Valve (Manual Valve) | | ND0191B | Valve Needle (Actuated Valve) |
| ND0042B | Axial Valve (Actuated Valve) | | ND0192A | Valve Butterfly (Manual Valve) |
| ND0180A | Valve Three Way (Manual Valve) | | ND0192B | Valve Butterfly (Actuated Valve) |
| ND0180B | Valve Three Way (Actuated Valve) | | ND0193A | Valve Ball (Manual Valve) |
| ND0181A | Valve Four Way (Manual Valve) | | ND0193B | Valve Ball (Actuated Valve) |
| ND0181B | Valve Four Way (Actuated Valve) | | ND0194 | Valve Block Bleed |
| ND0182A | Valve Gate (Manual Valve) | | ND0195 | Flow Control Check Valve |
| ND0182B | Valve Gate (Actuated Valve) | | ND0196A | Valve Plug (Manual Valve) |
| ND0183A | Valve Globe (Manual Valve) | | ND0196B | Valve Plug (Actuated Valve) |
| ND0183B | Valve Globe (Actuated Valve) | | ND0237 | Monoflange Valve |
| ND0184A | Valve Floate (Manual Valve) | | | |
| ND0184B | Valve Floate (Actuated Valve) | | | |

#### 4.2.2 Actuator label template — `FailAction` → `FailActionRepresentation` (5 symbols)

The actuator label placeholder was changed from the enumeration attribute `<FailAction>` to the display-string attribute `<FailActionRepresentation>` (both are standard DEXPI `Plant.Instrumentation.ControlledActuator` properties; both were already in the profile's allowed-properties list).

| Symbol | Description |
|---|---|
| ND0049 | Actuator Type E H M |
| ND0054 | Piston |
| ND0055 | Ballast Diaphragm Actuator |
| ND0056 | Diaphragm Actuator |
| ND0241 | Electro Hydraulic Actuator |

#### 4.2.3 Instrument label template — set point and alarm prefixes (2 symbols)

| Symbol | Description | Change |
|---|---|---|
| ND0006 | Function available on VDU | Set point label: `<SetPoint>` → `'SP = ' & <SetPoint>`. Alarm labels corrected for a missing opening quote: `H=' & …` → `'H=' & …`, and likewise for `HH`, `L`, `LL`. |
| ND0248B | Instrument Label | Set point label: `<SetPoint>` → `'SP = ' & <SetPoint>` |

The alarm-label change on ND0006 fixes a malformed expression in 0.6.3 (the opening single quote was missing), which would have produced an invalid or mis-rendered label.

#### 4.2.4 Class relinking (2 symbols)

| Symbol | Description | v0.6.3 usage | v0.6.4 usage |
|---|---|---|---|
| ND0035 | Level Element | `DiscProfile.InformationModel.LevelMeasuringInstrumentNuclear` | `Plant.Instrumentation.ProcessInstrumentationFunction` |
| ND0129 | Flow T. Flow Glass | `DiscProfile.InformationModel.FlowIndicator` | `Plant.Piping.InlineMeasuringElement` *Renamed:`In-line Mounted Instrument`  |

Both moves point the symbol at a standard DEXPI class instead of a DISC-specific one. The ND0035 relink is a consequence of the removal of `LevelMeasuringInstrumentNuclear` (§3.2); `FlowIndicator` still exists in the model but is no longer the symbol's declared usage.

#### 4.2.5 Label templates added or removed (2 symbols)

| Symbol | Description | Change |
|---|---|---|
| ND0224 | Pipeline slope | **Added** a label template (index A, Arial 3.3, right-bottom aligned, at −3.885, −3.008) with text `<PipeSlopeRatio>` — the graphical counterpart to the new `PipeSlopeRatio` attribute. |
| ND0187 | Valve Vacuum Release | **Removed** its valve label template (the `NominalDiameterRepresentation` / `ValveDataSheet` / `TrimType` / `LockMechanism` block). The symbol now carries geometry only. |

The ND0187 removal is why *Valve Vacuum Release* does not appear in the ShutoffCapability list in §4.2.1.

#### 4.2.6 Rotation permission (2 symbols)

| Symbol | Description | Change |
|---|---|---|
| ND0004 | Modular Valve Double Isolation and Bleed | `RotationAllowed` `false` → `true` on all three variants (_0, _1, _2) |
| ND0005 | Modular Valve Double Block Bleed and Check | `RotationAllowed` `false` → `true` on all three variants (_0, _1, _2) |

`MirroringAllowed`, `ResizingXAllowed`, and `ResizingYAllowed` are unchanged on both symbols.

### 4.3 Removed Symbols

None.


## 5. Validation Rule Changes (`Profile.xml`)

`Profile.xml` is the DEXPI Profile metamodel that the DiscProfile imports. Its class definitions (Symbol, SymbolVariant, SymbolUsage, LabelTemplate, Stroke, NodePosition, Constraint, Rule, etc.) are **unchanged** between the two releases — no classes, data properties or reference properties were added, removed or modified. The only substantive change is to the rule set, plus the version stamping of the model URI (§2.1).

### 5.1 Rule Set Summary

| Rule Name | v0.6.3 | v0.6.4 |
|---|---|---|
| invalid rotation | ✓ | ✓ (unchanged) |
| invalid mirroring | ✓ | ✓ (unchanged) |
| invalid scaling in x-direction | ✓ | ✓ (unchanged) |
| invalid scaling in y-direction | ✓ | ✓ (unchanged) |
| wrong symbol usage | ✓ | ✓ (unchanged) |
| invalid SignalConveyingFunction source | ✓ | ✓ (message reworded) |
| **invalid MeasuringLineFunction source** | ✓ | **removed** |

### 5.2 Removed Rule: *invalid MeasuringLineFunction source*

The rule dropped in 0.6.4 was:

| Property | Value |
|---|---|
| ApplyForEach | `?mlf` |
| Target | `?mlf` |
| Conditions | `?mlf meta:type Plant:Instrumentation.MeasuringLineFunction;`<br>`    Plant:Instrumentation.SignalConveyingFunction.Source ?src.`<br>`?src meta:type ?srcType.`<br>`@noValue(?src meta:type Plant:Instrumentation.ProcessSignalGeneratingFunction).` |
| MessageTemplate | "A MeasuringLineFunction must not have a {?srcType} as its Source. (It must start at a ProcessSignalGeneratingFunction.)" |

This rule enforced that every `MeasuringLineFunction` starts at a `ProcessSignalGeneratingFunction`. It was introduced in the requirements document at Rev 6.0 ("Update with MeasuringLineFunction rule definition") and has now been withdrawn from the profile.

**Note:** the requirement itself is still stated in the requirements document — *"DEXPI MeasuringLineFunction shall have an ProcessSignalGeneratingFunction as its Source"* is still present in Rev 6.1 under Instrumentation (Off-Line Instrumentation). Removing the rule means this is no longer machine-checked by a profile-aware validator; it becomes a documented requirement only. If that is not the intent, the rule should be restored. `MeasuringLineFunction` no longer appears anywhere in `Profile.xml` (4 references in 0.6.3, 0 in 0.6.4).

### 5.3 Reworded Rule: *invalid SignalConveyingFunction source*

Conditions, target and apply-for-each are unchanged:

```
?scf meta:type Plant:Instrumentation.SignalConveyingFunction;
    Plant:Instrumentation.SignalConveyingFunction.Source ?src.
?src meta:type Plant:Instrumentation.ProcessSignalGeneratingFunction.
```

Only the message text changed:

| | Message |
|---|---|
| v0.6.3 | "A SignalConveyingFunction must not have a ProcessSignalGeneratingFunction as its Source. (Only a MeasuringLineFunction may start at a ProcessSignalGeneratingFunction.)" |
| v0.6.4 | "A SignalConveyingFunction must not have a ProcessSignalGeneratingFunction as its Source." |

The parenthetical was dropped because it referred to the MeasuringLineFunction rule removed in §5.2. The check itself still fires identically — a SignalConveyingFunction sourced from a ProcessSignalGeneratingFunction is still invalid.


## 6. Requirements Document Changes

### 6.1 New Attribute Requirements

These additions align the requirements document with the new data properties in §3.3.

| Section / Table | Object | Attribute Added | Value Example | Comment as written |
|---|---|---|---|---|
| Equipment (Table 17) | ProcessEquipment | SpecialItemNumber | 34345 | Special item number if required. |
| PipingNetworkSegment (Table 23) | PipingNetworkSegment | PipeSlopeRatio | 1.50 | Slope ratio for the segment |
| Piping Components (Table 24) | PipingComponent | PipingToFromEndpoint | OVERBOARD | To/From Tag text for piping endpoint when there is no piping continuation. |
| Piping Components (Table 24) | PipingComponent | SpecialItemNumber | 3455 | Special Item Number |

One value definition was also changed in place:

| Table | Attribute | Rev 6.0 value column | Rev 6.1 value column |
|---|---|---|---|
| Table 23 | SegmentLineTypeRepresentation | `Primary/Secondary/Utility` | `Ref: ANNEX E: Piping Line Types` |

### 6.2 Instrumentation

- **SAS / Non-SAS function types (Figure 15, new Table 34).** Figure 15 has been rebuilt as a proper table of symbol / type / location / type-code combinations, replacing the embedded image used previously. The `NonSAS` ProcessInstrumentationFunctionType is added with two location variants:

| ProcessInstrumentationFunctionType | ProcessInstrumentationFunctionLocation |
|---|---|
| Discrete | Field |
| Discrete | Primary |
| Discrete | Inaccessable |
| Discrete | Auxiliary |
| SharedDisplaySharedControl | Field |
| SharedDisplaySharedControl | Primary |
| SharedDisplaySharedControl | Inaccessable |
| SharedDisplaySharedControl | Auxiliary |
| **NonSAS** | **Primary** |
| **NonSAS** | **Auxiliary** |

  A final row carries the TypeCode note: *"e.g. ESD/PSD/F&G/IOPS as per project requirements"*. Each row carries its symbol example as an image in the first column. The `NonSAS` rows correspond to the new symbols ND0269–ND0272 in the 0.6.4 profile (§4.1); note that `NonSAS` is defined for **Primary** and **Auxiliary** locations only — there is no Field or Inaccessable NonSAS variant.
- **Equipment-mounted instrumentation model rewritten.** The *Requirement Details* for equipment-mounted (non-invasive) measuring instruments no longer repeat the general instrumentation text and the in-line instrumentation cross-reference. They are replaced with:
  - "Main requirement details are as per Ref: Instrumentation."
  - "The 'Mounting' link between Instrumentation and the Equipment shall be via the Nozzle using the custom attribute 'IsVirtualMount' set to TRUE."
- **Signal conveying cross-references.** References to line-style values that previously pointed at external reference `[5]` now point at *ANNEX C: Signal conveying Line Types* within the document itself.
- **Signal conveying description reworded.** The sentence describing MeasuringLineFunction vs SignalConveyingFunction was rewritten to end with an explicit ANNEX C reference. (The new wording — "…while SignalConveyingFunction. The line style used is defined by…" — reads as a broken sentence and should be corrected editorially.)

### 6.5 Property Breaks and Logical Breaks

- The former **ANNEX E: Property Break Attribute Reference Details**, including its 7-row logical break table with *Driving Attribute* and *BreakValue1/BreakValue2 Source* columns, and its notes on hard-coded text for HeatTracingBreak and InsulationBreak.

**Added in the body (new sub-section "LogicalBreak Type driving attribute"):**

Each LogicalBreak type is now listed inline with its fully qualified driving attribute:

| Logical Break Type | Driving Attribute (fully qualified) |
|---|---|
| AreaBreak | `Plant.PlantStructure.PlantArea.PlantAreaIdentificationCode` |
| PipingClassBreak | `Plant.Piping.PipingNetworkSegment.PipingClassCode` |
| HeatTracingBreak | `Plant.Piping.PipingNetworkSegment.HeatTracingType` |
| ScopeBreak | `Plant.Piping.PipingNetworkSegment.ScopeIdentification` |
| LineIdBreak | `Plant.Piping.PipingNetworkSegment.LineId` |
| NominalDiameterBreak | `Plant.Piping.PipingNetworkSegment.NominalDiameterNumericalValueRepresentation` |
| InsulationBreak | `Plant.Piping.PipingNetworkSegment.InsulationType` |

With the note that values are typically displayed on the P&ID as part of the PropertyBreak symbol and transferred within the LogicalBreak element; where a project-specific text string is used instead (e.g. HT/NO HT, INS/NO INS), the LogicalBreak attributes shall contain that project-defined text.

Two attribute names changed between the old annex and the new list — `ScopeIdentificationRepresentation` → `ScopeIdentification` and `LineIdRepresentation` → `LineId`. These now match the attribute names actually added to `PipingNetworkSegmentExtension` in DiscProfile 0.6.4 (§3.3).

**Minor:** the `BreakIdentifier` transfer value in Table 41 changed from "Break identifier esp. TieIn" to "Break identifier", consistent with the removal of the TieInPoint requirement.

### 6.6 Annexes

**ANNEX C: Signal conveying Line Types** — the value table column order was changed from *Line / Signal | Name | DEXPI Type Representation* to *Line / Signal | DEXPI Type Representation | Name*, putting the machine-readable value adjacent to the graphic. The ten values themselves are unchanged, including `InstrumentTubingConveying` (case corrected from "Instrument tubing Line" to "Instrument tubing line"). A new note was added:

> **Note:** PneumaticSignal can also be displayed using `//` instead of the `^` symbol.

**ANNEX D: Valve Label Details** — the label format for both manual and on/off actuated/controlled valves gains the shutoff capability placeholder:

| | Rev 6.0 | Rev 6.1 |
|---|---|---|
| Manual valves | `<TrimType> <LockMechanism>` | `<TrimType> <LockMechanism> <ShutoffCapability>` |
| Actuated / controlled valves | `<TrimType> <LockMechanism>` | `<TrimType> <LockMechanism> <ShutoffCapability>` |

This matches the 38 symbol label templates updated in §4.2.1 exactly.

**ANNEX E: replaced.** The old *Property Break Attribute Reference Details* annex is gone (its content moved into the body, §5.5). A new **ANNEX E: Piping Line Types** takes its place, defining `SegmentLineTypeRepresentation` values:

| DEXPI Type Representation | Definition |
|---|---|
| Primary | Primary line: continuous extra thick |
| Secondary | Secondary line: continuous thick |
| Utility | Utility line: continuous medium |
| RemovableSpool | Removable spool |
| ProvisionalRemovableSpool | Provisional Removable Spool (Temporary / Future) |

This expands the previously informal "Primary/Secondary/Utility" list to five values and gives each a line-weight definition. The attribute's own *Description* cell in the preceding table was reworded from "Primary/Secondary/Utility" to "Line type ; e.g. Primary/Secondary.." so that the value table below is the single source of truth. `RemovableSpool` and `ProvisionalRemovableSpool` as line types sit alongside the `RemovableSpool` concrete class already present in the profile.

ANNEX E also now appears in the table of contents, which it did not in Rev 6.0.

## 7. Guidance for Profile Users

1. **Version identification.** 0.6.4 files carry `MetaData/version` and version-qualified model URIs. Tooling that previously keyed on the unversioned URIs (`http://www.to.define`, `http://www.to.define_fl0`, `http://www.to.define_fl10`, and the unversioned `Profile` import) must be updated, as these strings no longer match.
2. **Removed classes.** Any existing model data referencing `LevelMeasuringInstrumentNuclear` or `PipingInstrInterface` will fail validation against 0.6.4. Map `LevelMeasuringInstrumentNuclear` instances to `Plant.Instrumentation.ProcessInstrumentationFunction`.
3. **Valve labels.** All 38 valve symbols now expect a `ShutoffCapability` value. The attribute is optional, so an absent value is valid — but export tools that build the label string should be updated so the trailing placeholder does not render literally.
4. **Actuator labels.** Export tools must now populate `FailActionRepresentation` (a display string) rather than relying on `FailAction` (the enumeration) for actuator labels.
5. **New break-driving attributes.** `LineId` and `ScopeIdentification` on PipingNetworkSegment should be populated wherever LineIdBreak or ScopeBreak property breaks are used; without them those breaks have no source value.
6. **NonSAS instrument functions.** `NonSAS` is now a valid ProcessInstrumentationFunctionType, for the Primary and Auxiliary locations only, and is drawn with the new ND0269–ND0272 symbols. Export tools that validate the type/location combination list must be updated.
7. **MeasuringLineFunction source no longer validated.** The *invalid MeasuringLineFunction source* rule has been removed from `Profile.xml`. Validators using the 0.6.4 profile will no longer flag a MeasuringLineFunction that does not start at a ProcessSignalGeneratingFunction, even though the requirements document still states the rule. Confirm this removal is intentional before release.
8. **SegmentLineTypeRepresentation.** Five values are now defined (Primary, Secondary, Utility, RemovableSpool, ProvisionalRemovableSpool), listed in ANNEX E. Table 23 no longer inlines the value list and refers to ANNEX E instead.
