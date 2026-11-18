# DiscProfile Model Comparison Report

### Class Modelling and Symbol Library: Version 0.6.6 → Version 0.6.7

**Prepared:** 13 November 2026  
**Prepared for:** Users of the DiscProfile DEXPI extension model

## 1. Purpose and Scope

This report documents all differences between the version 0.6.6 and version 0.6.7 releases of the DiscProfile DEXPI extension model — the information model that defines equipment classes, attributes, and graphical symbols used across the DiscProfile profile.

Files compared:

*  DiscProfile.xml (v0.6.6 → v0.6.7)
*  Profile.xml (v0.6.6 → v0.6.7)

`Profile.xml` — the metamodel that defines symbols, symbol usage and the validation rules — has no substantive change apart from its version URI (§2.1).

The DiscProfile.xml review covers the class model (new, removed and modified classes and attributes), the type-code packages, the usage constraint (profile scope) and the symbol library (graphical objects, label templates and their linkage to classes). Purely cosmetic differences in the XML — element ordering, indentation, line endings (CRLF in 0.6.6, LF in 0.6.7) and floating-point coordinate rounding — are excluded. The seven symbols whose only change is coordinate rounding are listed in §4.2.5 for completeness.

The comparison was produced by structurally parsing both model files and diffing their class definitions, data properties, enumerations, type codes, constraint objects and symbol catalogue entries.

## 2. Summary of Changes

| Model Element | v0.6.6 | v0.6.7 | Net Change |
|---|---|---|---|
| Concrete Classes | 193 | 192 | −1 (0 added, 1 removed, 1 modified) |
| Abstract Classes | 4 | 4 | No change (1 modified) |
| Class Extensions | 29 | 30 | +1 (1 added, 7 modified) |
| Data Properties on extensions | 140 | 141 | +1 (7 added, 6 removed) |
| Enumerations | 3 | 3 | No change |
| Type-code packages | 5 | 5 | No change (32 codes) |
| Symbols (graphical) | 343 | 354 | +11 |
| Symbol variants | 388 | 401 | +13 |
| Label templates | 458 | 476 | +18 |
| Symbols modified | — | 23 | + 7 with coordinate rounding only |
| Allowed classes (UsageConstraint) | 294 | 293 | +0 / −1 |
| Allowed properties (UsageConstraint) | 332 | 328 | +7 / −11 |
| Validation rules (`Profile.xml`) | 5 | 5 | No change |

Unlike 0.6.6, this release is **not purely additive**. One class (`TieInPoint`) and eleven allowed properties were removed, the three property-break symbols were relinked from `Plant.Piping.PropertyBreak` to `Core.Diagram.Label`, and `Sequence` was consolidated at PipingComponent level.

*Counts are taken directly from the two files. Data properties include all `DataProperty`/`ReferenceProperty`/`CompositionProperty` elements on class extensions. The 0.6.6 counts agree with the 0.6.4 → 0.6.6 report.*

### 2.1 Version Stamping

| Item | v0.6.6 | v0.6.7 |
|---|---|---|
| `Model/@uri` (DiscProfile) | `http://www.to.define/DiscProfile/0.6.6` | `http://www.to.define/DiscProfile/0.6.7` |
| `Profile` import source | `http://www.dexpi.org/specification/Temp/Profile/0.6.6` | `http://www.dexpi.org/specification/Temp/Profile/0.6.7` |
| `MetaData/version` (DiscProfile) | `0.6.6` | `0.6.7` |
| `Model/@uri` (Profile.xml) | `http://www.dexpi.org/specification/Temp/Profile/0.6.6` | `http://www.dexpi.org/specification/Temp/Profile/0.6.7` |
| `MetaData/version` (Profile.xml) | absent | absent |
| `Core` / `MetaData` / `Plant` imports | DEXPI 2.0.0 | DEXPI 2.0.0 (unchanged) |

Tooling that matches on the exact model URI or `Profile` import URI must be updated.

## 3. Class Model Changes

### 3.1 Removed Concrete Class

| Class Name | Superclass | RDL Label | RDL URI | Attributes |
|---|---|---|---|---|
| TieInPoint | `/InformationModel.LogicalBreak` | TIE IN POINT | `http://noaka.org/rdl/TieInPoint` | CommissioningPackage, TieInPointIdentifier |

`TieInPoint` was a LogicalBreak used under a PropertyBreak. Its information now sits directly on the nozzle or pipe fitting as `TieInPointIdentifier` and `CommissioningPackageIdentifier` (§3.3). No concrete classes were added.

### 3.2 Modified Classes

| Class | Change |
|---|---|
| MechanicalJoint (concrete) | `JointConnectionSize` removed. The class now has no own attributes. The connection size uses `NominalDiameterRepresentation` from the parent Nozzle. |
| LogicalBreak (abstract) | `BreakValue1` and `BreakValue2` removed. The LogicalBreak subclasses (AreaBreak, HeatTracingBreak, InsulationBreak, LineIdBreak, NominalDiameterBreak, PipingClassBreak, ScopeBreak) now carry no attributes. The break values shown must come from the PipingNetworkSegments on either side of the break, and are owned by those segments' representation groups. |

### 3.3 Class Extensions and Attributes

**New class extension**

| Class Extension | Extends | Attributes |
|---|---|---|
| PipeFittingExtension | `Plant/Piping.PipeFitting` | CommissioningPackageIdentifier, TieInPointIdentifier |

**New attributes (7)**. All are optional (`lower="0" upper="1"`).

| Class Extension | Attribute | Data Type | Description | RDL URI |
|---|---|---|---|---|
| NozzleExtension | CommissioningPackageIdentifier | Undefined \| String | Commissioning Package identifier | `http://noaka.org/rdl/CommissioningPackageIdentifierAssignmentClass` |
| NozzleExtension | NominalDiameterRepresentation | Undefined \| String | Nominal diameter for the nozzle | `http://sandbox.dexpi.org/rdl/NominalDiameterRepresentationAssignmentClass` |
| NozzleExtension | TieInPointIdentifier | Undefined \| String | Tie In Point identifier | `http://noaka.org/rdl/TieInPointIdentifierAssignmentClass` |
| PipeFittingExtension | CommissioningPackageIdentifier | Undefined \| String | Commissioning Package identifier | `http://noaka.org/rdl/CommissioningPackageIdentifierAssignmentClass` |
| PipeFittingExtension | TieInPointIdentifier | Undefined \| String | Tie In Point identifier | `http://noaka.org/rdl/TieInPointIdentifierAssignmentClass` |
| PipingNetworkSegmentExtension | PlantArea | Reference → `Plant/PlantStructure.PlantArea` (0..1) | — | — |
| ProcessInstrumentationFunctionExtension | Sequence | Undefined \| String | Sequence number which is part of the tag number. | `http://noaka.org/rdl/SequenceAssignmentClass` |

**Removed attributes (6 on extensions)**

| Class Extension | Attribute | Note |
|---|---|---|
| InlineMeasuringElementExtension | Sequence | Inherited from `PipingComponentExtension.Sequence` |
| OperatedValveExtension | Sequence | Inherited from `PipingComponentExtension.Sequence` |
| SafetyValveOrFittingExtension | Sequence | Inherited from `PipingComponentExtension.Sequence` |
| PropertyBreakExtension | BreakIdentifier | Property-break values removed |
| PropertyBreakExtension | BreakValue1 | Property-break values removed |
| PropertyBreakExtension | BreakValue2 | Property-break values removed |

Notes:

- `PropertyBreakExtension` now has only the `LogicalBreaks` composition.
- `Sequence` is now defined on PipingComponentExtension, ProcessEquipmentExtension, NozzleExtension and ProcessInstrumentationFunctionExtension. OperatedValve, SafetyValveOrFitting and InlineMeasuringElement are PipingComponents, so they still have `Sequence` through inheritance.
- `PlantArea` is the only new reference property. It has no description or RDL URI.
- The commissioning-package attribute of the removed `TieInPoint` was called `CommissioningPackage` (`…/CommissioningPackageAssignmentClass`). The new attribute is `CommissioningPackageIdentifier` (`…/CommissioningPackageIdentifierAssignmentClass`).

No existing attribute changed its data type, multiplicity, description or RDL URI.

### 3.4 Enumerations and Type-Code Packages

All three enumerations (BlindPosition, PlugState, ValvePosition) and all five type-code packages (32 codes) are unchanged.

### 3.5 Profile Scope (UsageConstraint)

**Allowed classes**: 0 added, 1 removed (294 → 293).

| Change | Entry |
|---|---|
| Removed | `DiscProfile.InformationModel.TieInPoint` |

**Allowed properties**: 7 added, 11 removed (332 → 328).

| Change | Entry |
|---|---|
| Added | `DiscProfile.InformationModel.NozzleExtension.CommissioningPackageIdentifier` |
| Added | `DiscProfile.InformationModel.NozzleExtension.NominalDiameterRepresentation` |
| Added | `DiscProfile.InformationModel.NozzleExtension.TieInPointIdentifier` |
| Added | `DiscProfile.InformationModel.PipeFittingExtension.CommissioningPackageIdentifier` |
| Added | `DiscProfile.InformationModel.PipeFittingExtension.TieInPointIdentifier` |
| Added | `DiscProfile.InformationModel.PipingNetworkSegmentExtension.PlantArea` |
| Added | `DiscProfile.InformationModel.ProcessInstrumentationFunctionExtension.Sequence` |
| Removed | `DiscProfile.InformationModel.InlineMeasuringElementExtension.Sequence` |
| Removed | `DiscProfile.InformationModel.OperatedValveExtension.Sequence` |
| Removed | `DiscProfile.InformationModel.SafetyValveOrFittingExtension.Sequence` |
| Removed | `DiscProfile.InformationModel.PropertyBreakExtension.BreakIdentifier` |
| Removed | `DiscProfile.InformationModel.PropertyBreakExtension.BreakValue1` |
| Removed | `DiscProfile.InformationModel.PropertyBreakExtension.BreakValue2` |
| Removed | `DiscProfile.InformationModel.LogicalBreak.BreakValue1` |
| Removed | `DiscProfile.InformationModel.LogicalBreak.BreakValue2` |
| Removed | `DiscProfile.InformationModel.MechanicalJoint.JointConnectionSize` |
| Removed | `DiscProfile.InformationModel.TieInPoint.CommissioningPackage` |
| Removed | `DiscProfile.InformationModel.TieInPoint.TieInPointIdentifier` |

`Plant.Piping.PropertyBreak` is still an allowed class, but after the relinking in §4.2.2 no symbol has it as its usage class.

## 4. Symbol Library Changes

Total symbols: 343 → 354. No symbols were removed. 11 were added and 23 were modified (plus 7 with coordinate rounding only). Label template objects rose from 458 to 476.

### 4.1 New Symbols

#### 4.1.1 Valves

| Symbol | Description | Linked Class (`MetaData/usage`) | Variants | Nodes | Bounding Box | Rot/Mir/ResX/ResY |
|---|---|---|---|---|---|---|
| ND0313A | Valve Butterfly With Flow Arrow (Manual Valve) | `Plant.Piping.ButterflyValve` | ND0313A_0, ND0313A_1 | 2 | (-4, -2) – (4, 3.5) | Y/Y/N/N |
| ND0313B | Valve Butterfly With Flow Arrow (Actuated Valve) | `Plant.Piping.ButterflyValve` | ND0313B_0, ND0313B_1 | 2 | (-4, -2) – (4, 3.5) | Y/Y/N/N |

- They share the `ButterflyValve` class with ND0192A/B.
- The `_1` variant has the condition `OperatedValveExtension.ValvePosition = ValvePosition.NormallyOpen`. This differs from the other valve pairs, whose `_1` variant is `NormallyClose`.
- ND0313A uses the full valve label `<ObjectDisplayName>` + `<NominalDiameterRepresentation><ValveDataSheet>` / `<TrimType> <LockMechanism> <ShutoffCapability>`. ND0313B leaves out `<ObjectDisplayName>`, as for the other actuated valves.

#### 4.1.2 Labels

All have `Core.Diagram.Label` as their usage class, one variant, and rotation, mirroring and resizing allowed.

| Symbol | Description | Size / Nodes | Label templates |
|---|---|---|---|
| ND0312 | Special Item Plant Code | (0, −12) – (12, 0), 1 Label node, 3 primitives | **A** `<SpecialItemNumber>` (LeftBottom)<br>**B** `<ProcessPlantIdentificationCode>-` (RightCenter) |
| ND0314 | PipingToFromEndpoint | 0 × 0, no nodes | **A** `<PipingToFromEndpoint>` |
| ND0315 | NominalDiameterRepresentation | 0 × 0, no nodes | **A** `<NominalDiameterRepresentation>` |
| ND0316 | PlantAreaIdentificationCode | 0 × 0, no nodes | **A** `<PlantAreaIdentificationCode>` |
| ND0317 | HeatTracingTypeRepresentation | 0 × 0, no nodes | **A** `<HeatTracingTypeRepresentation>` |
| ND0318 | InsulationType | 0 × 0, no nodes | **A** `<InsulationType>` |
| ND0319 | LineId | 0 × 0, no nodes | **A** `<LineId>` |
| ND0320 | PipingClassCode | 0 × 0, no nodes | **A** `<PipingClassCode>` |
| ND0321 | ScopeIdentification | 0 × 0, no nodes | **A** `<ScopeIdentification>` |

ND0314–ND0321 are text-only labels with no graphics. All have a single CenterCenter label.

### 4.2 Modified Symbols

#### 4.2.1 Alarm labels added to Non-SAS functions (2 symbols)

ND0003 *Non SAS Function in CCR* and ND0272 *Non Sas Function Local* received the same four alarm labels that the SAS functions ND0006 and ND0269–ND0271 got in 0.6.6:

| Label | Alignment | Text |
|---|---|---|
| E | LeftBottom | `'H'` |
| F | LeftBottom | `'HH=' & SignalConveyingFunction:<AlarmValue>` |
| G | LeftTop | `'L'` |
| H | LeftTop | `'LL=' & SignalConveyingFunction:<AlarmValue>` |

#### 4.2.2 Property-break symbols relinked to Label (3 symbols)

| Symbol | Description | Change | 0.6.7 symbol |
|---|---|---|---|
| ND0007 | Property Break | Usage `Plant.Piping.PropertyBreak` → `Core.Diagram.Label`. Labels A `<BreakValue1>` and B `<BreakValue2>` removed. Label node removed. Graphic redrawn: the single arrowed line at y = −10 is replaced by two half-lines at y = −6 with arrowheads at the centre. Bounding box unchanged. | <img src="ND0007_Detail.svg" alt="ND0007 symbol, 0.6.7" width="220"> |
| ND0242 | Area Break | Usage `Plant.Piping.PropertyBreak` → `Core.Diagram.Label`. Labels A `<BreakValue1>` and B `<BreakValue2>` removed. |  |
| ND0043 | Tie In Point Property Break | Usage `Plant.Piping.PropertyBreak` → `Core.Diagram.Label`. Labels unchanged. |  |

#### 4.2.3 Label alignment and position (12 symbols)

The label alignment of ND0012A, ND0182B, ND0028, ND0031, ND0237, ND0225A, ND0225B, ND0244A, ND0244B, ND0245A, ND0245B and ND0029 has been adjusted for the viewers. The label text is unchanged.

#### 4.2.4 Graphics and other changes (6 symbols)

| Symbol | Description | Change |
|---|---|---|
| ND0029 / ND0029A | Double Isolation Ball Valve (DIB-2), manual / actuated | Two static text primitives added to each variant: `DPE` and `SR` (size 1.0) |
| ND0030 / ND0030A | Double Isolation Ball Valve (DIB-1), manual / actuated | Two static text primitives `DPE` added to each variant (size 1.0) |
| ND0227 | Strainer T Temporary | Static text `TS` enlarged from size 1.5 to 2.75 and repositioned |
| ND0273 | Segment Minimum Length | Turned into a text-only label: bounding box (-5, -1) – (5, 3) → 0 × 0, both piping nodes and all graphics (2 polygons, 3 polylines) removed. Label A `'Min: ' & <LowerLimitEndToEndLength>` (CenterTop) → `'MIN. ' & <LowerLimitEndToEndLength>` (CenterCenter, at origin) |
| ND0307B | Equipment box 8: Process Heater | Label C `<Length>x<Height>x<Width>` → `<Length>x<Width>x<Height>`, the same order as the other equipment boxes |

#### 4.2.5 Coordinate rounding only (7 symbols, not counted as modified)

ND0119, ND0181A, ND0181B, ND0186, ND0187, ND0247 and ND0291A differ only by coordinate rounding (maximum difference 0.001 mm). Bounding boxes, nodes and labels are unchanged.

No other symbol had changes to geometry, nodes, transformation flags, class linkage, variants, conditions or type codes.

### 4.3 Removed Symbols

None.
