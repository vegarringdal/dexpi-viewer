# DiscProfile Model Comparison Report

### Class Modelling and Symbol Library: Version 0.6.4 → Version 0.6.6

**Prepared:** 20 October 2026, updated 21 October 2026 (§7 requirements document)  
**Prepared for:** Users of the DiscProfile DEXPI extension model

## 1. Purpose and Scope

This report documents all differences between the version 0.6.4 and version 0.6.6 releases of the DiscProfile DEXPI extension model — the information model that defines equipment classes, attributes, and graphical symbols used across the DiscProfile profile.

Files compared:

*  DiscProfile.xml (v0.6.4 → v0.6.6)
*  Profile.xml (v0.6.4 → v0.6.6)
*  DISC DEXPI Pilot Transfer Requirements (rev 6.1 → rev 6.2), see §7

There is no separate 0.6.5 release file; the changes below are the cumulative changes from 0.6.4 to 0.6.6.

`Profile.xml` — the metamodel that defines symbols, symbol usage and the validation rules — has no substantive change apart from its version URI; see §5. The changes made to the requirements document for 0.6.6 are listed in §7.

The DiscProfile.xml review covers the class model (new, removed and modified classes and attributes), the type-code packages, the usage constraint (profile scope) and the symbol library (graphical objects, label templates and their linkage to classes). Purely cosmetic differences in the XML — element ordering, indentation and floating-point coordinate rounding — are excluded.

The comparison was produced by structurally parsing both model files and diffing their class definitions, data properties, enumerations, type codes, constraint objects and symbol catalogue entries.

## 2. Summary of Changes

| Model Element | v0.6.4 | v0.6.6 | Net Change |
|---|---|---|---|
| Concrete Classes | 173 | 193 | +20 (20 added, 0 removed) |
| Abstract Classes | 4 | 4 | No change |
| Class Extensions | 23 | 29 | +6 (6 added, 2 modified) |
| Data Properties on extensions | 106 | 140 | +34 |
| Enumerations | 3 | 3 | No change |
| Type-code packages | 5 | 5 | No change (1 modified: +2 codes, 1 renamed) |
| Symbols (graphical) | 292 | 343 | +51 |
| Symbol variants | 328 | 388 | +60 |
| Label templates | 328 | 458 | +130 |
| Symbols modified | — | 5 | — |
| Allowed classes (UsageConstraint) | 273 | 294 | +21 / −0 |
| Validation rules (`Profile.xml`) | 5 | 5 | No change |
| Allowed properties (UsageConstraint) | 289 | 332 | +43 / −0 |
| Requirements document | rev 6.1 | rev 6.2 | Equipment boxes, alarm labels, label rotation (§7) |

Nothing was removed: no classes, attributes, type codes, allowed classes, allowed properties or symbols. 0.6.6 is purely additive apart from the five symbol modifications in §4.2 and the IOPS → IOPPS rename in §3.4.

*Counts are taken directly from the two files. Data properties include all `DataProperty`/`ReferenceProperty`/`CompositionProperty` elements on class extensions. The 0.6.3 → 0.6.4 report gave 172 concrete classes and 110 extension data properties for 0.6.4; counted directly in the 0.6.4 file, the figures are 173 and 106.*

### 2.1 Version Stamping

| Item | v0.6.4 | v0.6.6 |
|---|---|---|
| `Model/@uri` (DiscProfile) | `http://www.to.define/DiscProfile/0.6.4` | `http://www.to.define/DiscProfile/0.6.6` |
| `Profile` import source | `http://www.dexpi.org/specification/Temp/Profile/0.6.4` | `http://www.dexpi.org/specification/Temp/Profile/0.6.6` |
| `MetaData/version` (DiscProfile) | `0.6.4` | `0.6.6` |
| `Model/@uri` (Profile.xml) | `http://www.dexpi.org/specification/Temp/Profile/0.6.4` | `http://www.dexpi.org/specification/Temp/Profile/0.6.6` |
| `MetaData/version` (Profile.xml) | absent | absent |
| `Core` / `MetaData` / `Plant` imports | DEXPI 2.0.0 | DEXPI 2.0.0 (unchanged) |

The version jumps from 0.6.4 straight to 0.6.6. Tooling that matches on the exact model URI or `Profile` import URI must be updated. Profile.xml carries its version only in the model URI; unlike DiscProfile.xml it has no `MetaData/version` element.

## 3. Class Model Changes

### 3.1 New Concrete Classes

20 concrete classes were added. Each one is the class behind a new symbol (§4.1) and is added to the allowed classes (§3.5).

| Class Name | Superclass | RDL Label | RDL URI | Description |
|---|---|---|---|---|
| AngleChokeValve | `Plant/Piping.OperatedValve` | ANGLE CHOKE VALVE | `http://noaka.org/rdl/AngleChokeValve` | Angle Choke Valve |
| DelugeNozzle | `Plant/Piping.PipingComponent` | DELUGE NOZZLE | `http://data.posccaesar.org/rdl/RDS458009` | Deluge Nozzle |
| DirectionalWaterSprayNozzle | `Plant/Piping.PipingComponent` | DIRECTIONAL WATER SPRAY NOZZLE | `http://data.posccaesar.org/rdl/RDS5855484` | Directional Water Spray Nozzle |
| DoubleIsolationAndBleedValveTubing | `Plant/Piping.OperatedValve` | DOUBLE ISOLATION AND BLEED VALVE TUBING | `http://noaka.org/rdl/DoubleIsolationAndBleedValveTubing` | Double Isolation And Bleed Valve (Tubing) |
| EndOutArrow | `Plant/Piping.PipingComponent` | END OUT ARROW | `http://noaka.org/rdl/EndOutArrow` | End Out Arrow |
| FlushingRingWithBleedPlugs | `Plant/Piping.PipingComponent` | FLUSHING RING WITH BLEED PLUGS | `http://noaka.org/rdl/FlushingRingWithBleedPlugs` | Flushing Ring With Bleed Plugs |
| GateValveDoubleExpanding | `Plant/Piping.OperatedValve` | GATE VALVE DOUBLE EXPANDING | `http://noaka.org/rdl/GateValveDoubleExpanding` | Gate Valve Double Expanding |
| GateValveWithPlug | `Plant/Piping.OperatedValve` | GATE VALVE WITH PLUG | `http://noaka.org/rdl/GateValveWithPlug` | Gate Valve With Plug |
| InergenNozzle | `Plant/Piping.PipingComponent` | INERGEN NOZZLE | `http://noaka.org/rdl/InergenNozzle` | Inergen Nozzle |
| InternalPipe | `/InformationModel.ProcessVesselComponent` | INTERNAL PIPE | `http://noaka.org/rdl/InternalPipe` | Internal Pipe |
| KnifeGateValve | `Plant/Piping.OperatedValve` | KNIFE GATE VALVE | `http://data.posccaesar.org/rdl/RDS645029` | Knife Gate Valve |
| NeedleValveWithPlug | `Plant/Piping.OperatedValve` | NEEDLE VALVE WITH PLUG | `http://noaka.org/rdl/NeedleValveWithPlug` | Needle Valve With Plug |
| QuickClosingValve | `Plant/Piping.OperatedValve` | QUICK CLOSING VALVE | `http://noaka.org/rdl/QuickClosingValve` | Quick Closing Valve |
| SelfClosingValve | `Plant/Piping.OperatedValve` | SELF CLOSING VALVE | `http://noaka.org/rdl/SelfClosingValve` | Self Closing Valve |
| SlabGateValve | `Plant/Piping.OperatedValve` | SLAB GATE VALVE | `http://data.posccaesar.org/rdl/RDS487214` | Slab Gate Valve |
| SprinklerNozzle | `Plant/Piping.PipingComponent` | SPRINKLER NOZZLE | `http://data.posccaesar.org/rdl/RDS303029` | Sprinkler Nozzle |
| StopCheckValve | `Plant/Piping.CheckValve` | STOP CHECK VALVE | `http://data.posccaesar.org/rdl/RDS644804` | Stop Check Valve |
| StraightThroughChokeValve | `Plant/Piping.OperatedValve` | STRAIGHT THROUGH CHOKE VALVE | `http://noaka.org/rdl/StraightThroughChokeValve` | Straight Through Choke Valve |
| WaterMistNozzle | `Plant/Piping.PipingComponent` | WATER MIST NOZZLE | `http://noaka.org/rdl/WaterMistNozzle` | Water Mist Nozzle |
| YGlobeValve | `Plant/Piping.OperatedValve` | Y-GLOBE VALVE | `http://data.posccaesar.org/rdl/RDS7461140` | Y-Globe Valve |

Groupings:

- **Valves** (`Plant/Piping.OperatedValve`): AngleChokeValve, DoubleIsolationAndBleedValveTubing, GateValveDoubleExpanding, GateValveWithPlug, KnifeGateValve, NeedleValveWithPlug, QuickClosingValve, SelfClosingValve, SlabGateValve, StraightThroughChokeValve, YGlobeValve.
- **Check valve** (`Plant/Piping.CheckValve`): StopCheckValve. It is the only new valve class not derived from OperatedValve.
- **Fire-fighting nozzles** (`Plant/Piping.PipingComponent`): InergenNozzle, SprinklerNozzle, DelugeNozzle, DirectionalWaterSprayNozzle, WaterMistNozzle.
- **Other piping components** (`Plant/Piping.PipingComponent`): EndOutArrow, FlushingRingWithBleedPlugs.
- **Vessel internals** (`/InformationModel.ProcessVesselComponent`): InternalPipe.

7 of the 20 new classes reference a POSC Caesar RDS class (`data.posccaesar.org`). The other 13 use a `noaka.org/rdl` URI.

### 3.2 New Class Extensions

6 new class extensions were added on standard DEXPI equipment classes. They carry the attributes needed by the new equipment-box labels.

| Class Extension | Extends | Attributes |
|---|---|---|
| ChamberExtension | `Plant/ProcessEquipment.Chamber` | FlowRateAtUpperLimitFlow, LengthTanTan, LowerLimitOperatingPressure, LowerLimitOperatingTemperature, NormalOperatingPressure, NormalOperatingTemperature, UpperLimitOperatingPressure, UpperLimitOperatingTemperature |
| CompressorExtension | `Plant/ProcessEquipment.Compressor` | InletFlowRate, NormalInletPressure, NormalInletTemperature, NormalOutletPressure, NormalOutletTemperature, ShaftPower |
| FilterExtension | `Plant/ProcessEquipment.Filter` | ParticleDiameter, TotalFilterArea, UpperLimitPressureDrop |
| HeatExchangerExtension | `Plant/ProcessEquipment.HeatExchanger` | DesignCaseHeatFlowRate, InsulationMaterial, InsulationThickness, InsulationType |
| HeaterExtension | `Plant/ProcessEquipment.Heater` | DesignCaseHeatFlowRate |
| PumpExtension | `Plant/ProcessEquipment.Pump` | InletFlowRate, InletFluidDensity, NormalInletPressure, NormalOutletPressure, ShaftPower |

### 3.3 New Attributes (Data Properties)

34 new data properties were added: 27 on the six new extensions and 7 on two existing ones (ProcessEquipmentExtension, VesselExtension). All are optional (`lower="0" upper="1"`) unions with `Undefined`.

| Class Extension | Attribute | Data Type | Description | RDL URI |
|---|---|---|---|---|
| ChamberExtension | FlowRateAtUpperLimitFlow | Undefined \| PhysicalQuantity[VolumeFlowRateUnit] | A volume flow rate at upper limit flow. | `http://data.posccaesar.org/rdl/RDS8276324` |
| ChamberExtension | LengthTanTan | Undefined \| PhysicalQuantity[LengthUnit] | A straight linear distance which is the total length of the cylindrical section/part of a cylindrical vessel, ie. including the cylindrical sections of the vessel heads. | `http://data.posccaesar.org/rdl/RDS357254` |
| ChamberExtension | LowerLimitOperatingPressure | Undefined \| PhysicalQuantity[PressureGaugeUnit] | Lower Limit Operating Pressure | `http://data.posccaesar.org/rdl/RDS1469272681` |
| ChamberExtension | LowerLimitOperatingTemperature | Undefined \| PhysicalQuantity[TemperatureUnit] | A temperature that is the lowest temperature at which a functional or physical object is expected to operate. | `http://data.posccaesar.org/rdl/RDS360584` |
| ChamberExtension | NormalOperatingPressure | Undefined \| PhysicalQuantity[PressureGaugeUnit] | A pressure at which a functional or physical object is expected to operate normally. | `http://data.posccaesar.org/rdl/RDS369629` |
| ChamberExtension | NormalOperatingTemperature | Undefined \| PhysicalQuantity[TemperatureUnit] | A temperature at which a functional or physical object is expected to operate normally. | `http://data.posccaesar.org/rdl/RDS369674` |
| ChamberExtension | UpperLimitOperatingPressure | Undefined \| PhysicalQuantity[PressureGaugeUnit] | Upper Limit Operating Pressure | `http://data.posccaesar.org/rdl/RDS1469251881` |
| ChamberExtension | UpperLimitOperatingTemperature | Undefined \| PhysicalQuantity[TemperatureUnit] | A temperature that is the highest temperature at which a functional or physical object is expected to operate. | `http://data.posccaesar.org/rdl/RDS360539` |
| CompressorExtension | InletFlowRate | Undefined \| PhysicalQuantity[VolumeFlowRateUnit] | Design case suction flow | `http://data.posccaesar.org/rdl/RDS7354764` |
| CompressorExtension | NormalInletPressure | Undefined \| PhysicalQuantity[PressureGaugeUnit] | Suction Pressure | `http://data.posccaesar.org/rdl/RDS7343782` |
| CompressorExtension | NormalInletTemperature | Undefined \| PhysicalQuantity[TemperatureUnit] | Suction Temperature | `http://data.posccaesar.org/rdl/RDS14261975` |
| CompressorExtension | NormalOutletPressure | Undefined \| PhysicalQuantity[PressureGaugeUnit] | Discharge Pressure | `http://data.posccaesar.org/rdl/RDS14261705` |
| CompressorExtension | NormalOutletTemperature | Undefined \| PhysicalQuantity[TemperatureUnit] | Discharge Temperature | `http://data.posccaesar.org/rdl/RDS14262065` |
| CompressorExtension | ShaftPower | Undefined \| PhysicalQuantity[PowerUnit] | A power that is the power of a machine shaft. | `http://data.posccaesar.org/rdl/RDS361259` |
| FilterExtension | ParticleDiameter | Undefined \| PhysicalQuantity[LengthUnit] | A diameter of a sphere with the same qualities as the particle in a given situation. | `http://data.posccaesar.org/rdl/RDS403019` |
| FilterExtension | TotalFilterArea | Undefined \| PhysicalQuantity[AreaUnit] | Total filter area | `http://noaka.org/rdl/TotalFilterArea` |
| FilterExtension | UpperLimitPressureDrop | Undefined \| PhysicalQuantity[PressureGaugeUnit] | A pressure drop that is the highest allowable permanent pressure loss. | `http://data.posccaesar.org/rdl/RDS7452620` |
| HeatExchangerExtension | DesignCaseHeatFlowRate | Undefined \| PhysicalQuantity[PowerUnit] | Represents the maximum heat transfer rate the exchanger is specified to handle under its most demanding operational scenario. | `http://noaka.org/rdl/DesignCaseHeatFlowRate` |
| HeatExchangerExtension | InsulationMaterial | Undefined \| String | An isolation material intended to insulate an item from its environment | `http://data.posccaesar.org/rdl/RDS11856535` |
| HeatExchangerExtension | InsulationThickness | Undefined \| PhysicalQuantity[LengthUnit] | Insulation thickness. | `http://data.posccaesar.org/rdl/RDS4238040` |
| HeatExchangerExtension | InsulationType | Undefined \| String | The identification code for the insulation type. | `http://sandbox.dexpi.org/rdl/InsulationTypeAssignmentClass` |
| HeaterExtension | DesignCaseHeatFlowRate | Undefined \| PhysicalQuantity[PowerUnit] | Represents the maximum heat transfer rate the exchanger is specified to handle under its most demanding operational scenario. | `http://noaka.org/rdl/DesignCaseHeatFlowRate` |
| ProcessEquipmentExtension | MaterialOfConstructionCode | Undefined \| String | General Material of construction | `http://data.posccaesar.org/rdl/RDS1460719741` |
| ProcessEquipmentExtension | PurchaseOrderIdentificationCode | Undefined \| String | Purchase Order code | `http://data.posccaesar.org/rdl/RDS13599522` |
| ProcessEquipmentExtension | VendorCompanyName | Undefined \| String | Vendor name | `http://sandbox.dexpi.org/rdl/VendorCompanyNameAssignmentClass` |
| PumpExtension | InletFlowRate | Undefined \| PhysicalQuantity[VolumeFlowRateUnit] | Design case suction flow | `http://data.posccaesar.org/rdl/RDS7354764` |
| PumpExtension | InletFluidDensity | Undefined \| PhysicalQuantity[DensityUnit] | Fluid density at suction conditions | `http://noaka.org/rdl/InletFluidDensity` |
| PumpExtension | NormalInletPressure | Undefined \| PhysicalQuantity[PressureGaugeUnit] | Suction Pressure | `http://data.posccaesar.org/rdl/RDS7343782` |
| PumpExtension | NormalOutletPressure | Undefined \| PhysicalQuantity[PressureGaugeUnit] | Discharge Pressure | `http://data.posccaesar.org/rdl/RDS14261705` |
| PumpExtension | ShaftPower | Undefined \| PhysicalQuantity[PowerUnit] | A power that is the power of a machine shaft. | `http://data.posccaesar.org/rdl/RDS361259` |
| VesselExtension | InsulationMaterial | Undefined \| String | An isolation material intended to insulate an item from its environment | `http://data.posccaesar.org/rdl/RDS11856535` |
| VesselExtension | InsulationThickness | Undefined \| PhysicalQuantity[LengthUnit] | Insulation thickness. | `http://data.posccaesar.org/rdl/RDS4238040` |
| VesselExtension | InsulationType | Undefined \| String | The identification code for the insulation type. | `http://sandbox.dexpi.org/rdl/InsulationTypeAssignmentClass` |
| VesselExtension | TotalStorageCapacity | Undefined \| PhysicalQuantity[VolumeUnit] | Net storage capacity | `http://data.posccaesar.org/rdl/RDS17034315` |

Notes:

- `DesignCaseHeatFlowRate` is defined twice with identical definitions, on HeaterExtension and on HeatExchangerExtension. `InsulationType`, `InsulationThickness` and `InsulationMaterial` are likewise defined on both VesselExtension and HeatExchangerExtension, and `InletFlowRate`, `NormalInletPressure`, `NormalOutletPressure` and `ShaftPower` on both PumpExtension and CompressorExtension.
- ChamberExtension adds `LowerLimitOperatingPressure/Temperature` and `UpperLimitOperatingPressure/Temperature` for AKSO's version of the equipment box. The DISC profile labels use `NormalOperatingPressure` / `NormalOperatingTemperature` instead.
- Most new attributes are physical quantities bound to a unit type. Only `InsulationType`, `InsulationMaterial`, `MaterialOfConstructionCode`, `PurchaseOrderIdentificationCode` and `VendorCompanyName` are display strings.
- Standard DEXPI `Plant.ProcessEquipment.Chamber` attributes (InsideDiameter, Length, Width, Height, Lower/UpperLimitDesignPressure/Temperature, ChamberFunction) are not redefined. They are only added to the allowed properties (§3.5).

No data properties were removed or modified.

### 3.4 Enumerations and Type-Code Packages

All three enumerations are unchanged. Four of the five type-code packages are unchanged. `ProcessInstrumentationFunctionTypeCodes` changed:

| Change | Type Code Object | Abbreviation |
|---|---|---|
| Added | High | `H` |
| Added | Low | `L` |
| Changed | InputOutputOperationsPerSecond | `IOPS` → `IOPPS` |

`High` and `Low` are referenced as `AllowedTypeCodes` by the new symbol ND0299 *Generic Logic Function* (Select High / Select Low). The IOPPS change affects only the abbreviation; the object name `InputOutputOperationsPerSecond` is unchanged, so references to it stay valid.

**Note:** the `AllowedTypeCodes` of ND0249A *Shut Down – Arrow Down* and ND0249C are still only `EmergencyShutdown` and `ProcessShutdown` in both versions. Symbols.xlsm lists ESD, PSD, F&G and IOPPS for these symbols, so IOPPS (and F&G) cannot yet be used on them.

### 3.5 Profile Scope (UsageConstraint)

**Allowed classes**: 21 added, none removed (273 → 294).

| Change | Entry |
|---|---|
| Added | `DiscProfile.InformationModel.AngleChokeValve` |
| Added | `DiscProfile.InformationModel.DelugeNozzle` |
| Added | `DiscProfile.InformationModel.DirectionalWaterSprayNozzle` |
| Added | `DiscProfile.InformationModel.DoubleIsolationAndBleedValveTubing` |
| Added | `DiscProfile.InformationModel.EndOutArrow` |
| Added | `DiscProfile.InformationModel.FlushingRingWithBleedPlugs` |
| Added | `DiscProfile.InformationModel.GateValveDoubleExpanding` |
| Added | `DiscProfile.InformationModel.GateValveWithPlug` |
| Added | `DiscProfile.InformationModel.InergenNozzle` |
| Added | `DiscProfile.InformationModel.InternalPipe` |
| Added | `DiscProfile.InformationModel.KnifeGateValve` |
| Added | `DiscProfile.InformationModel.NeedleValveWithPlug` |
| Added | `DiscProfile.InformationModel.QuickClosingValve` |
| Added | `DiscProfile.InformationModel.SelfClosingValve` |
| Added | `DiscProfile.InformationModel.SlabGateValve` |
| Added | `DiscProfile.InformationModel.SprinklerNozzle` |
| Added | `DiscProfile.InformationModel.StopCheckValve` |
| Added | `DiscProfile.InformationModel.StraightThroughChokeValve` |
| Added | `DiscProfile.InformationModel.WaterMistNozzle` |
| Added | `DiscProfile.InformationModel.YGlobeValve` |
| Added | `Plant.ProcessEquipment.Chamber` |

`Plant.ProcessEquipment.Chamber` is the only standard DEXPI class added. It is needed so that chamber-level design and operating data can be carried for the equipment boxes. The other 20 are the new concrete classes from §3.1.

**Allowed properties**: 43 added, none removed (289 → 332). These are the 34 new data properties in §3.3, plus the nine standard DEXPI Chamber attributes below:

- `Plant.ProcessEquipment.Chamber.ChamberFunction`
- `Plant.ProcessEquipment.Chamber.Height`
- `Plant.ProcessEquipment.Chamber.InsideDiameter`
- `Plant.ProcessEquipment.Chamber.Length`
- `Plant.ProcessEquipment.Chamber.LowerLimitDesignPressure`
- `Plant.ProcessEquipment.Chamber.LowerLimitDesignTemperature`
- `Plant.ProcessEquipment.Chamber.UpperLimitDesignPressure`
- `Plant.ProcessEquipment.Chamber.UpperLimitDesignTemperature`
- `Plant.ProcessEquipment.Chamber.Width`

## 4. Symbol Library Changes

Total symbols: 292 → 343. No symbols were removed. 51 were added and 5 were modified. Label template objects rose from 328 to 458.

### 4.1 New Symbols

#### 4.1.1 Piping components and in-line items

| Symbol | Description | Linked Class (`MetaData/usage`) | Variants | Nodes | Bounding Box | Rot/Mir/ResX/ResY |
|---|---|---|---|---|---|---|
| ND0276 | End Out Arrow | `DiscProfile.InformationModel.EndOutArrow` | ND0276_0 | 1 | (-5, -1.5) – (0, 1.5) | Y/Y/Y/Y |
| ND0277 | Flange | `Plant.Piping.Flange` | ND0277_0 | 2 | (0, -2) – (0, 2) | Y/Y/Y/Y |
| ND0278 | Clamp-on | `DiscProfile.InformationModel.ClampOn` | ND0278_0 | 4 | (-3, -1) – (3, 1) | Y/Y/Y/Y |
| ND0279 | Flexible Hose | `Plant.Piping.Hose` | ND0279_0 | 2 | (0, -2) – (30, 2) | Y/Y/Y/Y |
| ND0297 | Flushing Ring With Bleed Plugs | `DiscProfile.InformationModel.FlushingRingWithBleedPlugs` | ND0297_0 | 2 | (-1, -3) – (1, 3) | Y/Y/Y/Y |

#### 4.1.2 Valves

| Symbol | Description | Linked Class (`MetaData/usage`) | Variants | Nodes | Bounding Box | Rot/Mir/ResX/ResY |
|---|---|---|---|---|---|---|
| ND0280A | Slab Gate Valve (Manual Valve) | `DiscProfile.InformationModel.SlabGateValve` | ND0280A_0, ND0280A_1 | 2 | (-4, -2.5) – (4, 2.5) | Y/Y/N/N |
| ND0280B | Slab Gate Valve (Actuated Valve) | `DiscProfile.InformationModel.SlabGateValve` | ND0280B_0, ND0280B_1 | 2 | (-4, -2.5) – (4, 2.5) | Y/Y/N/N |
| ND0281A | Knife Gate Valve (Manual Valve) | `DiscProfile.InformationModel.KnifeGateValve` | ND0281A_0, ND0281A_1 | 2 | (-4, -2.5) – (4, 2.5) | Y/Y/N/N |
| ND0281B | Knife Gate Valve (Actuated Valve) | `DiscProfile.InformationModel.KnifeGateValve` | ND0281B_0, ND0281B_1 | 2 | (-4, -2.5) – (4, 2.5) | Y/Y/N/N |
| ND0282A | Y-Globe Valve (Manual Valve) | `DiscProfile.InformationModel.YGlobeValve` | ND0282A_0, ND0282A_1 | 2 | (-4, -3.5) – (4, 2.5) | Y/Y/N/N |
| ND0282B | Y-Globe Valve (Actuated Valve) | `DiscProfile.InformationModel.YGlobeValve` | ND0282B_0, ND0282B_1 | 2 | (-4, -3.5) – (4, 2.5) | Y/Y/N/N |
| ND0283A | Gate Valve Double Expanding (Manual Valve) | `DiscProfile.InformationModel.GateValveDoubleExpanding` | ND0283A_0, ND0283A_1 | 2 | (-4, -2.5) – (4, 2.5) | Y/Y/N/N |
| ND0283B | Gate Valve Double Expanding (Actuated Valve) | `DiscProfile.InformationModel.GateValveDoubleExpanding` | ND0283B_0, ND0283B_1 | 2 | (-4, -2.5) – (4, 2.5) | Y/Y/N/N |
| ND0284A | Angle Choke Valve | `DiscProfile.InformationModel.AngleChokeValve` | ND0284A_0 | 2 | (-2, -4) – (4, 4) | Y/Y/N/N |
| ND0285A | Quick Closing Valve | `DiscProfile.InformationModel.QuickClosingValve` | ND0285A_0 | 2 | (-4, -4) – (4, 2) | Y/Y/N/N |
| ND0286A | Self Closing Valve | `DiscProfile.InformationModel.SelfClosingValve` | ND0286A_0 | 2 | (-4, -3) – (4, 2) | Y/Y/N/N |
| ND0287A | Straight Through Choke Valve | `DiscProfile.InformationModel.StraightThroughChokeValve` | ND0287A_0 | 2 | (-4, -2) – (4, 2) | Y/Y/N/N |
| ND0288A | Stop Check Valve | `DiscProfile.InformationModel.StopCheckValve` | ND0288A_0 | 2 | (-4, -2) – (4, 2) | Y/Y/N/N |
| ND0289A | Gate Valve With Plug | `DiscProfile.InformationModel.GateValveWithPlug` | ND0289A_0 | 1 | (-4, -2) – (5.25, 2) | Y/Y/N/N |
| ND0290A | Needle Valve With Plug | `DiscProfile.InformationModel.NeedleValveWithPlug` | ND0290A_0 | 1 | (-4, -2) – (5.25, 4) | Y/Y/N/N |
| ND0291A | Double Isolation And Bleed Valve (Tubing) | `DiscProfile.InformationModel.DoubleIsolationAndBleedValveTubing` | ND0291A_0, ND0291A_1 | 2 | (-8, -4) – (8, 14) | Y/Y/N/N |

Valve symbol notes:

- All new valves have rotation and mirroring allowed and resizing not allowed, the same as the existing valve symbols.
- The **A** variants (manual) use the full valve label `<ObjectDisplayName>` + `<NominalDiameterRepresentation><ValveDataSheet>` / `<TrimType> <LockMechanism> <ShutoffCapability>`. The **B** variants (actuated) and the choke/quick-closing/self-closing valves leave out `<ObjectDisplayName>`, because the tag is shown on the IM005B instrument label.
- ND0280A/B, ND0281A/B, ND0282A/B, ND0283A/B and ND0291A each have a second variant (`_1`) with the condition `OperatedValveExtension.ValvePosition = ValvePosition.NormallyClose`.
- ND0289A and ND0290A (valves with plug) have only one piping node.

#### 4.1.3 Fire-fighting nozzles

| Symbol | Description | Linked Class (`MetaData/usage`) | Variants | Nodes | Bounding Box | Rot/Mir/ResX/ResY |
|---|---|---|---|---|---|---|
| ND0292 | Inergen Nozzle | `DiscProfile.InformationModel.InergenNozzle` | ND0292_0 | 1 | (-2, 0) – (2, 3) | Y/Y/Y/Y |
| ND0293 | Sprinkler Spray Nozzle | `DiscProfile.InformationModel.SprinklerNozzle` | ND0293_0 | 1 | (-2, 0) – (2, 7) | Y/Y/Y/Y |
| ND0294 | Deluge Spray Nozzle | `DiscProfile.InformationModel.DelugeNozzle` | ND0294_0 | 1 | (-2, 0) – (2, 7) | Y/Y/Y/Y |
| ND0295 | Directional Water Spray Nozzle | `DiscProfile.InformationModel.DirectionalWaterSprayNozzle` | ND0295_0 | 1 | (-2, 0) – (2, 9) | Y/Y/Y/Y |
| ND0296 | Water Mist Spray Nozzle | `DiscProfile.InformationModel.WaterMistNozzle` | ND0296_0 | 2 | (-2, 0) – (2, 8) | Y/Y/Y/Y |

#### 4.1.4 Vessel internals and instrumentation

| Symbol | Description | Linked Class (`MetaData/usage`) | Variants | Nodes | Bounding Box | Rot/Mir/ResX/ResY |
|---|---|---|---|---|---|---|
| ND0298 | Level Profiler | `DiscProfile.InformationModel.LevelProfiler` | ND0298_0 | 0 | (0, 0) – (2, 48) | Y/Y/Y/Y |
| ND0299 | Generic Logic Function | `Plant.Instrumentation.ProcessInstrumentationFunction` | ND0299_0 | 4 | (-2, -2) – (2, 2) | Y/Y/Y/Y |
| ND0311 | Internal Pipe | `DiscProfile.InformationModel.InternalPipe` | ND0311_0 | 0 | (0, 0) – (0, 20) | Y/Y/Y/Y |

- **ND0299** has a single label `<TypeCode>` and `AllowedTypeCodes` = Low, High (§3.4).
- **ND0298** *Level Profiler* uses the existing `LevelProfiler` class (already in 0.6.4) and has no connection nodes.
- **ND0311** *Internal Pipe* is a zero-width vertical line (20 mm long) with no nodes.

#### 4.1.5 Equipment boxes (ND0300A/B – ND0310A/B)

Eleven equipment-box pairs were added, all linked to `Core.Diagram.Label`. The **A** variant is the full 65 mm-wide box frame with no labels. The **B** variant is the 45 mm-wide data column carrying the label templates. All have rotation, mirroring and resizing allowed, and no connection nodes.

| Symbol | Description | Size (W × H) | Label templates (B variant) |
|---|---|---|---|
| ND0300A / ND0300B | Equipment box 1: skid, top tag | A: 65 × 50<br>B: 45 × 50 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<Length> x <Width> x <Height>`<br>**D** `<FlowRateAtUpperLimitFlow>`<br>**E** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**F** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**G** `<MaterialOfConstructionCode>`<br>**H** `<VendorCompanyName>`<br>**I** `<PurchaseOrderIdentificationCode>` |
| ND0301A / ND0301B | Equipment box 2: Separator | A: 65 × 50<br>B: 45 × 50 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<InsideDiameter> x <LengthTanTan>`<br>**D** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**E** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**F** `<InsulationType>/<InsulationThickness>/<InsulationMaterial>`<br>**G** `<MaterialOfConstructionCode>`<br>**H** `<VendorCompanyName>`<br>**I** `<PurchaseOrderIdentificationCode>` |
| ND0302A / ND0302B | Equipment box 3: Centrifugal Pump | A: 65 × 50<br>B: 45 × 50 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<InletFluidDensity>`<br>**D** `<InletFlowRate>`<br>**E** `<NormalInletPressure>/<NormalOutletPressure>`<br>**F** `<ShaftPower>`<br>**G** `<MaterialOfConstructionCode>`<br>**H** `<VendorCompanyName>`<br>**I** `<PurchaseOrderIdentificationCode>` |
| ND0303A / ND0303B | Equipment box 4: Tank | A: 65 × 55<br>B: 45 × 55 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<Length> x <Width> x <Height> or <InsideDiameter> x <Width>`<br>**D** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**E** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**F** `<TotalStorageCapacity>`<br>**G** `<InsulationType>/<InsulationThickness>/<InsulationMaterial>`<br>**H** `<MaterialOfConstructionCode>`<br>**I** `<VendorCompanyName>`<br>**J** `<PurchaseOrderIdentificationCode>` |
| ND0304A / ND0304B | Equipment box 5: Filter | A: 65 × 70<br>B: 45 × 70 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<ParticleDiameter>`<br>**D** `<Length> x <Width> x <Height>`<br>**E** `<FlowRateAtUpperLimitFlow>`<br>**F** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**G** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**H** `<UpperLimitPressureDrop>`<br>**I** `<TotalFilterArea>`<br>**J** `<MaterialOfConstructionCode>`<br>**K** `<VendorCompanyName>`<br>**L** `<PurchaseOrderIdentificationCode>` |
| ND0305A / ND0305B | Equipment box 6: Centrifugal Compressor | A: 65 × 50<br>B: 45 × 50 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<InletFlowRate>`<br>**D** `<NormalInletPressure>/<NormalOutletPressure>`<br>**E** `<NormalInletTemperature>/<NormalOutletTemperature>`<br>**F** `<ShaftPower>`<br>**G** `<MaterialOfConstructionCode>`<br>**H** `<VendorCompanyName>`<br>**I** `<PurchaseOrderIdentificationCode>` |
| ND0306A / ND0306B | Equipment box 7: Pig Launcher/Receiver | A: 65 × 60<br>B: 45 × 60 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<InsideDiameter> / <InsideDiameter> x <LengthTanTan>`<br>**D** `<FlowRateAtUpperLimitFlow>`<br>**E** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**F** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**G** `<MaterialOfConstructionCode>`<br>**H** `<VendorCompanyName>`<br>**I** `<PurchaseOrderIdentificationCode>` |
| ND0307A / ND0307B | Equipment box 8: Process Heater | A: 65 × 40<br>B: 45 × 40 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<Length>x<Height>x<Width>`<br>**D** `<DesignCaseHeatFlowRate>`<br>**E** `<MaterialOfConstructionCode>`<br>**F** `<VendorCompanyName>`<br>**G** `<PurchaseOrderIdentificationCode>` |
| ND0308A / ND0308B | Equipment box 9: Pump Caisson | A: 65 × 45<br>B: 45 × 45 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<InsideDiameter> x <LengthTanTan>`<br>**D** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**E** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**F** `<MaterialOfConstructionCode>`<br>**G** `<VendorCompanyName>`<br>**H** `<PurchaseOrderIdentificationCode>` |
| ND0309A / ND0309B | Equipment box 10: Heat Exchanger | A: 65 × 65<br>B: 45 × 65 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<InsulationType>/<InsulationThickness>/<InsulationMaterial>`<br>**D** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**E** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**F** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**G** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**H** `<DesignCaseHeatFlowRate>`<br>**I** `<Length> x <Width> x <Height>`<br>**J** `<MaterialOfConstructionCode>`<br>**K** `<VendorCompanyName>`<br>**L** `<PurchaseOrderIdentificationCode>` |
| ND0310A / ND0310B | Equipment box 11: vent, flare tip | A: 65 × 50<br>B: 45 × 50 | **A** `<ObjectDisplayName>`<br>**B** `<EquipmentDescription>`<br>**C** `<Length> x <Width> x <Height>`<br>**D** `<FlowRateAtUpperLimitFlow>`<br>**E** `<LowerLimitDesignPressure> & <UpperLimitDesignPressure> / <NormalOperatingPressure>`<br>**F** `<LowerLimitDesignTemperature> & <UpperLimitDesignTemperature> / <NormalOperatingTemperature>`<br>**G** `<MaterialOfConstructionCode>`<br>**H** `<VendorCompanyName>`<br>**I** `<PurchaseOrderIdentificationCode>` |

Every attribute placeholder used in these labels resolves to an entry in the UsageConstraint allowed properties (§3.5).

### 4.2 Modified Symbols

#### 4.2.1 Alarm label templates — H and L alarm values no longer shown (4 symbols)

For the H and L alarms the label now shows only the alarm letter, not the alarm value. HH and LL are unchanged.

| Label | v0.6.4 | v0.6.6 |
|---|---|---|
| E | `'H=' & SignalConveyingFunction:<AlarmValue>` | `'H'` |
| G | `'L=' & SignalConveyingFunction:<AlarmValue>` | `'L'` |

| Symbol | Description |
|---|---|
| ND0006 | Function available on VDU |
| ND0269 | SAS Function |
| ND0270 | SAS Function Inaccessable |
| ND0271 | SAS Function VDU Local |

#### 4.2.2 Label template repositioned (1 symbol)

| Symbol | Description | Change |
|---|---|---|
| ND0186 | Valve Choke | Label A alignment `CenterTop` → `LeftTop`, position (0.492, 4.993) → (3.121, 2.996). Label text unchanged. |

The requested change for ND0186 was to remove the label details and use the IM005B instrument label instead. However, label A (`<NominalDiameterRepresentation><ValveDataSheet>` / `<TrimType> <LockMechanism> <ShutoffCapability>`) is still present in 0.6.6. Only its placement changed. Confirm whether the label should have been removed.

No other symbol had changes to geometry, nodes, transformation flags, class linkage, variants or conditions.

### 4.3 Removed Symbols

None.

## 5. Validation Rule Changes (`Profile.xml`)

`Profile.xml` is the DEXPI Profile metamodel that DiscProfile imports. Between 0.6.4 and 0.6.6 the only change is the version in the model URI (§2.1). The `Core` and `MetaData` imports (DEXPI 2.0.0) are the same.

- **Class definitions:** all 18 class and enumeration definitions are identical. These are AggregatedStroke, Constraint, LabelTemplate, LineRounding, LineStroke, NodePosition, NodePositionType, PropertyConstraint, PropertyValueCondition, Rule, SimpleStroke, Stroke, Symbol, SymbolCatalogue, SymbolStroke, SymbolUsage, SymbolVariant and UsageConstraint. No classes, data properties, reference properties or enumeration literals were added, removed or modified.
- **Rules:** the same five rules, with identical ApplyForEach, Conditions, MessageTemplate and Target. Only the order of the rule objects in the file changed, which has no effect on validation.

| Rule Name | v0.6.4 | v0.6.6 |
|---|---|---|
| invalid rotation | ✓ | ✓ (unchanged) |
| invalid mirroring | ✓ | ✓ (unchanged) |
| invalid scaling in x-direction | ✓ | ✓ (unchanged) |
| invalid scaling in y-direction | ✓ | ✓ (unchanged) |
| wrong symbol usage | ✓ | ✓ (unchanged) |

**Note:** the 0.6.3 → 0.6.4 report lists six rules for 0.6.4, including a reworded *invalid SignalConveyingFunction source* rule. That rule is not in the 0.6.4 Profile.xml supplied here, and it is not in 0.6.6 either. If the rule is still wanted, it needs to be added back. Until then, a SignalConveyingFunction whose Source is a ProcessSignalGeneratingFunction is not machine-checked.

## 6. Guidance for Profile Users

1. **Version identification.** 0.6.6 files carry `MetaData/version` = `0.6.6` and the version-qualified URIs `http://www.to.define/DiscProfile/0.6.6` and `…/Temp/Profile/0.6.6`. There is no 0.6.5 file. Tooling keyed on the 0.6.4 URIs must be updated.
2. **Validation rules.** `Profile.xml` 0.6.6 applies the same five rules as 0.6.4 (rotation, mirroring, x/y scaling, symbol usage). No new checks were introduced, and there is still no rule for SignalConveyingFunction or MeasuringLineFunction sources.
3. **Backward compatibility.** Nothing was removed or renamed in the class model, so data valid against 0.6.4 stays valid against 0.6.6. The only exception is a `ProcessInstrumentationFunction` type code written as the literal string `IOPS`: it must now be `IOPPS`.
4. **New valve and nozzle classes.** Exporters that previously mapped these items to generic `CustomOperatedValve` / `CustomPipingComponent` should now use the dedicated classes in §3.1 and the matching symbols.
5. **Equipment boxes.** To fill the new equipment-box labels, exporters must populate the new extension attributes (§3.3) and the standard DEXPI Chamber attributes on the equipment's `Chamber` objects. All are optional, so unfilled placeholders should not render literally.
6. **Alarm labels.** H and L alarms now render as the letter only (`H`, `L`). The alarm value is still carried in the SignalConveyingFunction and is still shown for HH and LL.
7. **Generic Logic Function.** ND0299 accepts only the type codes `H` (Select High) and `L` (Select Low).
8. **Open points found in this comparison:**
    - ND0249A / ND0249C `AllowedTypeCodes` do not include IOPPS or F&G, although Symbols.xlsm lists them (§3.4).
    - ND0186 label A was repositioned, not removed, although the requested change was to remove it (§4.2.2).
    - The class label of `DoubleIsolationAndBleedValveTubing` is "DOUBLE ISOLATION AND BLEED VALVE TUBING", while Symbols.xlsm has "… (TUBING)".
    - The *invalid SignalConveyingFunction source* rule, which the 0.6.3 → 0.6.4 report lists for 0.6.4, is not in either Profile.xml (§5).
    - The `SprinklerNozzle` RDL URI uses `http://`, while Symbols.xlsm has `https://`.
9. **Requirements document.** Rev 6.2 of *DISC DEXPI Pilot Transfer Requirements* includes the equipment box transfer, alarm label and profile-label rotation requirements for 0.6.6 (§7).

## 7. Requirements Document Changes

This section covers the changes made to the requirements document *DISC DEXPI Pilot Transfer Requirements* to reflect DiscProfile 0.6.6 and the equipment box and label work.

| | Before | After |
|---|---|---|
| Revision | 6.1 | 6.2 (21.10.2026) |
| Pages | 87 | 99 |
| Change record 6.2 | — | "Add details for Equipment boxes, SpecialItem usage, Equipment Internals, Alarm labels (H/L) and Valve labels. Profile label text alignment after mirroring/rotation." |

### 7.1 Profile version and references

Relates to §2.1.

| Location | Rev 6.1 | Rev 6.2 |
|---|---|---|
| Reference [5] DISC DEXPI Profile | version `1.0` | version `0.6.6` |
| Reference [7] | — | **New:** AkerBP Symbol Legend, FUI-AKSO-P-XB-000xx sheets |
| Import table, `Profile` source | `http://www.dexpi.org/specification/Temp/Profile` | `http://www.dexpi.org/specification/Temp/Profile/0.6.6` |
| Import table, `DiscProfile` source | "Source to be defined can be set as: http://www.to.define" | `http://www.to.define/DiscProfile/0.6.6` |
| Change record, rev 5.8 date | 21.04.2025 | 21.04.2026 (corrected) |

### 7.2 Equipment boxes

Relates to §3.2, §3.3, §3.5 and §4.1.5. Rev 6.1 excluded equipment boxes from the transfer. Rev 6.2 requires them.

- **Constraints/Assumptions:** item 11, "Equipment box/table shall not be transferred.", is removed.
- **Equipment section:** a new requirement says that equipment shown with an equipment box shall include the equipment box attributes (ANNEX F). Design and operating conditions and dimensions are transferred on the `Plant/ProcessEquipment.Chamber` objects in the equipment's Chambers composition.
- **Equipment Box section, rewritten.** Rev 6.1 said "Equipment box shall not be transferred" and listed only TagName and EquipmentDescription. Rev 6.2 has:
    - **Definition:** an equipment box is a pair of profile symbols per equipment type. The 'A' symbol is the frame with the static captions and units, with no values. The 'B' symbol sits directly to the right of 'A', and its LabelTemplates define the value in each row. Figure 23 is a DEXPI model example.
    - **Transfer as symbol references only:** no graphical primitives for the box frame or captions (Constraints/Assumptions 6).
    - **'A' symbol:** a `Core/Diagram.Static` with a `Profile/SymbolUsage`, in a RepresentationGroup with no Represents reference. It is not placed in the equipment's RepresentationGroup.
    - **'B' symbol:** a `Core/Diagram.Label` in the equipment's RepresentationGroup (Represents = the equipment), holding the 'B' SymbolUsage and one `Core/Diagram.Text` per LabelTemplate row that has a value.
    - **Values:** transferred as conceptual-model attributes on the object given in ANNEX F ("Declared on").
    - **Chambers:** equipment with one process side has one Chamber (ChamberFunction optional). A heat exchanger has two Chambers identified by ChamberFunction: hot side = **Cooling**, cold side = **Heating**. The first occurrence of the repeated pressure/temperature LabelTemplates (rows D and E, HOT SIDE) reads the Cooling Chamber; the second (rows F and G, COLD SIDE) reads the Heating Chamber. Heat exchanger dimensions are transferred on the Cooling Chamber.
    - **Units:** numeric values are transferred as PhysicalQuantity (value and unit) in the units shown in the 'A' symbol, e.g. Bar (gauge, barg), DegreeCelsius, Kilowatt, Millimetre. Full vacuum, shown as `FV`, is transferred as `-1.01325` Bar.
    - **Operating limits:** `LowerLimitOperatingPressure`, `UpperLimitOperatingPressure`, `LowerLimitOperatingTemperature` and `UpperLimitOperatingTemperature` are transferred when available but are not displayed (the default 'B' LabelTemplates show `NormalOperatingPressure` / `NormalOperatingTemperature`).
    - **Attribute tables:** RDS URI, example value and "Declared on" for each attribute. The **Equipment object** table has MaterialOfConstructionCode, VendorCompanyName, PurchaseOrderIdentificationCode, DesignCaseHeatFlowRate, InsulationType, InsulationThickness, InsulationMaterial, TotalStorageCapacity, InletFluidDensity, InletFlowRate, NormalInletPressure, NormalOutletPressure, NormalInletTemperature, NormalOutletTemperature, ShaftPower, ParticleDiameter, TotalFilterArea and UpperLimitPressureDrop. The **Chamber object** table has ChamberFunction, InsideDiameter, LengthTanTan, Length, Height, Width, Lower/UpperLimitDesignPressure, NormalOperatingPressure, Lower/UpperLimitOperatingPressure, Lower/UpperLimitDesignTemperature, NormalOperatingTemperature, Lower/UpperLimitOperatingTemperature and FlowRateAtUpperLimitFlow.
- **New ANNEX F, Equipment box Attribute usage.** A matrix (Figure 42) of 36 attributes against the 11 equipment types ND0300–ND0310, with the equipment box caption (e.g. `DES. PRESSURE (MAX)`) and the declaring class (ProcessEquipment, Chamber, Heater + HeatExchanger, Vessel, Vessel + HeatExchanger, Pump, Pump + Compressor, Compressor, Filter). `✓ C + H` marks the heat exchanger attributes transferred on both the Cooling and the Heating Chamber.

### 7.3 Instrumentation and alarm labels

Relates to §3.4 and §4.2.1.

- **Shutdown type code example:** "ESD/PSD/F&G/IOPS" → "ESD/PSD/F&G/**IOPPS**" (the abbreviation change in `ProcessInstrumentationFunctionTypeCodes`).
- **Off-line instrumentation alarm levels:** the SignalConveyingFunction attribute table now has `AlarmValue` next to `PortStatus` (`http://sandbox.dexpi.org/rdl/AlarmValue`, example `12 barg`). The comment says the value may be of **any Quantity unit, and the unit must be specified**.
- **New requirement:** in the instrument alarm labels H and L are shown with the letter only (`H`, `L`). The alarm value is shown for HH and LL only. AlarmValue shall still be transferred for all alarm levels.
- **ANNEX C:** the `AlarmValue` row is removed from the SignalConveyingFunction table (it is now with the alarm levels above). The table keeps only `SignalConveyingFunctionTypeRepresentation`, introduced as "the following attribute to provide information about the linestyle representation".

### 7.4 Valves

- **PV019A** (Valve Ball, closed variant): condition `ValvePosition = 'NC'` → `ValvePosition = 'NormallyClose'`, the enumeration literal used by the 0.6.6 variant conditions (§4.1.2).
- **ANNEX D, barrier information:** "The following DIB valves will be added to the DISC DEXPI symbol legend soon." is replaced by "Next release of the DISC Profile will require the barrier information to be shown for the valve according to the AkerBP legend" (Ref [7]).

### 7.5 Profile label text under rotation and mirroring

This change has no counterpart in the profile files. It is a new requirement on how tools display profile labels.

- **ANNEX B intro** reworded ("The tables in this section show …"); Figure 37 (Symbol Rotation Attribute Example) now follows the *Rotation and Mirroring Details* list.
- **New subsection *Profile Label Text under Rotation and Mirroring*:**
    - A symbol's LabelTemplate is defined for the symbol at rotation 0, not mirrored.
    - Labels stored in the DEXPI file with their own position, rotation and alignment (e.g. a moved label) are shown exactly as stored.
    - Figure 38 shows an example.
- **Implementation (rule B):** DEXPIViewer 2.2, AKSODEXPIViewer 2.5 and `Update-DexpiLabels.ps1` place profile labels as follows:
    - text reads left to right at 0°/180° and bottom to top at 90°/270°;
    - Top ↔ Bottom swap at 90° and 180°;
    - Left ↔ Right swap when the symbol is mirrored;
    - Center never changes.

    See `LabelAlignment_RuleB/ProfileLabel_TextAlignment_RuleB.md` and the Visio file in the same folder.

### 7.6 Numbering

- **TOC:** updated for the new sections. ANNEX B–E move from pages 82–87 to 89–95, and ANNEX F is on page 96.
- **Figures:** Figure 38 is new. The SignalConveyingFunctionTypeRepresentation values figure becomes Figure 39, Valve Barrier variants Figure 40, SegmentLineTypeRepresentation values Figure 41, and the new ANNEX F matrix is Figure 42.

### 7.7 Points found in the rev 6.2 document

- **Broken ANNEX C cross-reference.** The bookmark on the *ANNEX C: Signal conveying Line Types* heading (`_Ref238807483`) now starts at the Figure 38 caption. Cross-references to ANNEX C therefore display "Figure 38: Profile label text under rotation and mirroring – example ANNEX C: Signal conveying Line Types", e.g. in the Instrumentation section's signal conveying lines requirement. The bookmark must be reset to the heading only and the fields updated. In the same requirement the "Ref:" paragraph has lost its bullet.
- The profile open points in §6 (ND0249A/C type codes, ND0186 label, invalid SignalConveyingFunction source rule) are not recorded in rev 6.2.
