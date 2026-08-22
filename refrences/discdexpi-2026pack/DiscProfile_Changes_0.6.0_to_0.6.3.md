# DiscProfile Model Comparison Report

### Class Modelling and Symbol Library: Version 0.6.0 → Version 0.6.3

**Prepared:** 22 July 2026
**Prepared for:** Users of the DiscProfile DEXPI extension model

## 1. Purpose and Scope

This report documents all differences between DiscProfile_0.6.0.xml and DiscProfile_0.6.3.xml, the DEXPI-based information model that defines equipment classes, attributes, and graphical symbols used across the DiscProfile profile. It covers changes to the class model (new, removed, reclassified, and modified classes and attributes) and changes to the symbol library (graphical objects and their linkage to classes). Purely cosmetic or whitespace differences in the underlying XML are excluded.

The comparison was produced by structurally parsing both model files and diffing their class definitions, enumerations, and symbol catalogue entries.

## 2. Summary of Changes

| Model Element | v0.6.0 | v0.6.3 | Net Change |
|---|---|---|---|
| Concrete Classes | 167 | 173 | +6 (7 added, 1 renamed/removed) |
| Abstract Classes | 4 | 4 | No change |
| Class Extensions | 23 | 23 | No change (1 added, 1 removed) |
| Data Properties (attributes) | 93 | 101 | +8 |
| Enumerations | 4 | 3 | -1 (HeatTraceRequired removed) |
| Symbols (graphical) | 273 | 284 | +11 |

In addition to the structural changes above, descriptive text (the MetaData/description field) was rewritten for 109 existing classes, replacing short legacy labels (e.g. "Tank Atmospheric Storage") with full formal definitions (e.g. "A storage tank that operates under atmospheric conditions."). These are documentation-quality improvements only and do not change class structure, attributes, or symbol linkage. The full list is provided in Appendix A.

## 3. Class Model Changes

### 3.1 New Classes

Seven new concrete classes and one new class extension were introduced in v0.6.3:

| Class Name | Type | Superclass / Base Type | Description |
|---|---|---|---|
| ClampOnUltrasonicFlowMeter | ConcreteClass | Plant/Piping.InlineMeasuringElement | Ultrasonic Flowmeter (Clamp-On type) |
| DiaphragmSealFlushingRing | ConcreteClass | Plant/Piping.PipingComponent | Diaphragm Seal Flushing Ring |
| InjectionQuill | ConcreteClass | Plant/Piping.PipingComponent | Injection Quill |
| InternalCone | ConcreteClass | /InformationModel.ProcessVesselComponent | Internal Cone |
| LevelProfiler | ConcreteClass | /InformationModel.ProcessVesselComponent | Level Profiler (see reclassification note below) |
| OilInWaterAnalyser | ConcreteClass | Plant/Piping.InlineMeasuringElement | Analysing instrument for oil content in water |
| RemovableSpool | ConcreteClass | Plant/Piping.PipingComponent | Removable Spool |
| SymbolVariantExtension | ClassExtension | Profile/SymbolVariant | Adds a PCA symbol URL reference to symbol variants |

SymbolVariantExtension adds a single new attribute, PcaSymbolUrl (optional URI), allowing a symbol variant to carry a reference URL to its source symbol definition.

### 3.2 Reclassified and Renamed Classes

Three existing classes changed superclass, and one was effectively renamed and re-based:

| Class | Aspect | v0.6.0 | v0.6.3 |
|---|---|---|---|
| LevelSensor → LevelProfiler | Class name | LevelSensor | LevelProfiler |
| | Superclass | Plant/Piping.InlineMeasuringElement | /InformationModel.ProcessVesselComponent |
| | RDL reference | data.posccaesar.org/rdl/RDS880784 | noaka.org/rdl/LevelProfiler |
| | Linked symbol | ND0022 | ND0022 (retained, relinked) |
| DripPan | Superclass | /InformationModel.ProcessVesselComponent | Plant/ProcessEquipment.ProcessEquipment |
| LevelBridle | Superclass | Plant/Piping.InlineMeasuringElement | Plant/ProcessEquipment.ProcessEquipment |

- **LevelSensor → LevelProfiler:** the class previously named LevelSensor (classified under Piping.InlineMeasuringElement) has been replaced by LevelProfiler, reclassified as a ProcessVesselComponent. The description text was identical in both ("Level Profiler") in v0.6.0 already, indicating the class name lagged the intended meaning. Symbol ND0022 has been relinked from LevelSensor to LevelProfiler with no change to its graphics.
- **DripPan:** reclassified from a ProcessVesselComponent (an internal component mounted inside a vessel) to a standalone ProcessEquipment item.
- **LevelBridle:** reclassified from Piping.InlineMeasuringElement to ProcessEquipment; its description was also updated.

Impact: any downstream tooling, filters, or reports that key off the old class names or superclass paths (LevelSensor, or the prior superclass of DripPan/LevelBridle) should be updated to reference the new class names/paths.

### 3.3 Removed / Consolidated Classes

**ProcessColumnExtension – removed:** this extension added a ProcessVesselComponents composition property to Plant/ProcessEquipment.ProcessColumn. The identical property is already defined on VesselExtension (base type Plant/ProcessEquipment.Vessel), which ProcessColumn inherits from. The removal in v0.6.3 eliminates a redundant duplicate definition; no modelling capability is lost — process columns still support vessel-internal components via the inherited VesselExtension.

### 3.4 Attribute (Data Property) Changes – Heat Tracing

The single enumerated flag HeatTraceRequired (values: Yes / SafetyCritical / No) has been removed and replaced across six class extensions with a more expressive set of properties: HeatTracingType (a classified reference), HeatTracingTypeRepresentation (free-text fallback), and IsHeatTracingSafetyCritical (boolean). Not every affected class received all three — the distribution is:

| Class Extension | HeatTracingType | HeatTracingTypeRepresentation | IsHeatTracingSafetyCritical | HeatTraceRequired (removed) |
|---|---|---|---|---|
| NozzleExtension | Added | Added | Added | – |
| PipeExtension | Added | Added | Added | Removed |
| ProcessInstrumentationFunctionExtension | Added | Added | Added | Removed |
| PipingComponentExtension | – | – | Added | Removed |
| PipingNetworkSegmentExtension | – | – | Added | Removed |
| PipingNetworkSystemExtension | – | – | Added | Removed |

Impact: any data, templates, or reports referencing the HeatTraceRequired property or enumeration will need to be migrated to the new properties. Where only IsHeatTracingSafetyCritical was added (PipingComponentExtension, PipingNetworkSegmentExtension, PipingNetworkSystemExtension), the previous three-valued flag has become a simple boolean; the detailed tracing type is captured at the Pipe, Nozzle, or ProcessInstrumentationFunction level instead.

### 3.5 Enumeration Changes

The HeatTraceRequired enumeration (literals: Yes, SafetyCritical, No) has been removed as part of the heat tracing property changes described in Section 3.4. No other enumerations were added, removed, or modified.

## 4. Symbol Library Changes

The symbol catalogue grew from 273 to 284 graphical symbol definitions. No symbols were removed.

### 4.1 New Symbols

Eleven new symbols were added, each with a single graphical variant, linked to the classes below:

| Symbol ID | Linked Class | Description | Variants |
|---|---|---|---|
| ND0256 | DiscProfile.InformationModel.OilInWaterAnalyser | Oil In Water Analyser | 1 |
| ND0259 | DiscProfile.InformationModel.ClampOnUltrasonicFlowMeter | Ultrasonic Flowmeter Clamp-On | 1 |
| ND0260 | DiscProfile.InformationModel.PilotOperatedReliefValve | PSV Valve Pilot | 1 |
| ND0261A | Plant.Piping.FlowInPipeOffPageConnector | Off Page Connector, Dual Flow (inbound) | 1 |
| ND0261B | Plant.Piping.FlowOutPipeOffPageConnector | Off Page Connector, Dual Flow (outbound) | 1 |
| ND0262 | DiscProfile.InformationModel.RemovableSpool | Removable Spool | 1 |
| ND0263 | DiscProfile.InformationModel.OpenDrainSystem | Tundish (no arrow) | 1 |
| ND0264 | DiscProfile.InformationModel.DiaphragmSealFlushingRing | Flushing Ring | 1 |
| ND0265 | DiscProfile.InformationModel.InternalCone | Internal Cone | 1 |
| ND0266 | DiscProfile.InformationModel.InjectionQuill | Injection Quill | 1 |
| ND0267 | Plant.Instrumentation.ProcessInstrumentationFunction | Radioactive Source | 1 |

### 4.2 Relinked Symbols

ND0022 remains graphically unchanged but is now linked to LevelProfiler instead of the retired LevelSensor class (see Section 3.2).

### 4.3 Removed Symbols

None. All 273 symbols present in v0.6.0 remain in v0.6.3, unchanged in geometry, variant count, and node structure, aside from the ND0022 relink noted above.

## 5. Guidance for Profile Users

- Update any references to the LevelSensor class to LevelProfiler; check drawings or exports using the old RDL URI (data.posccaesar.org/rdl/RDS880784).
- Review use of DripPan and LevelBridle where logic depends on their previous superclass (ProcessVesselComponent / InlineMeasuringElement respectively).
- Migrate any use of the HeatTraceRequired property/enumeration to the new HeatTracingType, HeatTracingTypeRepresentation, and IsHeatTracingSafetyCritical properties, noting which are available per class (Section 3.4).
- No action is required for ProcessColumnExtension's removal — the equivalent capability remains available via the inherited VesselExtension.
- The eleven new symbols and seven new classes can be adopted where relevant equipment types (oil-in-water analysers, clamp-on ultrasonic flow meters, injection quills, etc.) appear in new work.
- Description text changes (Appendix A) are informational only and require no action.

## Appendix A: Description-Only Updates (109 classes)

The following classes had only their MetaData/description field updated between v0.6.0 and v0.6.3, with no change to superclass, attributes, or symbol linkage.

| Class Name | Description (v0.6.0) | Description (v0.6.3) |
|---|---|---|
| Activator | Activator | A device which when activated initiates the activation of some other device. |
| AirReleaseTrap | Air Release Trap | A trap that is accumulating unwanted air in a closed system and release it. |
| AtmosphericStorageTank | Tank Atmospheric Storage | A storage tank that operates under atmospheric conditions. |
| AveragingPitotTubeFlowMeter | Flow T. Averaging Pitot | A pitot tube flow meter that uses an pitot tube with multiple openings. |
| AxialValve | Axial Valve (Manual Valve) | Axial Valve |
| BagFilter | Bag Filter | A filter with non-rigid containers with an opening at one side, usually equipped with a mechanism for easy cleaning by beating. |
| BlockAndBleedValve | Valve Block Bleed | A valve that has one seat which provides a seal, and a bleeder line and valve that are tapped into the block valve's bonnet. |
| BlowOutPreventer | Blow Out Preventer | An artefact that is a stack or an assembly of heavy-duty valves intended to be attached to the top of the casing to controll the well pressure. |
| Caisson | Caisson | A protector that is used to protect tubes/pipes etc. inside the caisson against evironmental exposure. |
| ChimneyTray | Chimney Tray | A draw off tray that contains chimneys to allow vapour to pass without contact with the liquid phase |
| ChokeValve | Valve Choke | A valve that can be used to obstruct the fluid passing inside, and has the ability to reduce the pressure from the inlet port to the outlet port. |
| ClampConnector | Greylock | A mechanical connector which is used to make up a joint in a pipeline, flowline or hub using a pipe clamp. |
| ConeRoofSilo | Tank Cone Roof Silo | Storage tank with a cone roof. |
| CoriolisMassFlowMeter | Coriolis Flowmeter | A mass flow meter that uses the Coriolis principle to measure a mass flow rate through the meter. |
| CustomEquipmentPackage | Custom Equipment Package | A 'functional object' that is any related group of objects that is viewed or organized as a unit. |
| DiaphragmPump | Pump Diaphragm | A reciprocating pump intended to pump a liquid with a small capacity. This is done by means of thin flexible diaphragms to seal pumped fluid from leakage to atmosphere. |
| DiaphragmValve | Valve Diaphragm (Manual Valve) | A membrane valve that is a membrane valve where the closure member is a resilient diaphragm being forced against a port. |
| Diffuser | Diffuser | An artefact that is a diverging channel-shaped chamber in which part of the kinetic energy of the fluid is converted into pressure energy. Typically provided with stationary vanes and located at the outlet of the impeller of a centrifugal pump or compressor. |
| DirectHeatingHeater | Direct Heating Heater | Normally defined to be heating of a medium by direct fire. |
| Ditch | Ditch | A trench for running pipeline, electric cable or for drainage. |
| DiverterValve | Diverter Gate | A valve that is a valve with multiple ports intended to divert flow in several directions and prevent intermixing. |
| DomeRoofTank | Tank Dome Roof | A tank that has a roof with a dome shape |
| DoubleBlockAndBleedValve | Modular Valve Double Isolation and Bleed | A block and bleed valve that is incorporating two seats, each of which provides a seal, and a means of venting the space between the seats. The seats may isolate with the pressure differential acting in the same or in opposite directions depending on the design. |
| DoubleIsolationBallValve1 | Double Isolation Ball Valve (DIB-1)<br>2 double piston effect. (Manual Valve) | Double Isolation Ball Valve (DIB-1)<br>2 double piston effect. |
| DoubleIsolationBallValve2 | Double Isolation Ball Valve (DIB-2)<br>1 double piston and 1 self relieving seat. (Manual valve) | Double Isolation Ball Valve (DIB-2)<br>1 double piston and 1 self relieving seat. |
| DoublePipeHeatExchanger | Exch. Double Pipe | A tubular heat exchanger that consists of two co-axial pipes of different sizes, where one fluid passes though the inner pipe and the other fluid passes through the space between the inner and the outer pipes. |
| DrainBox | Drain Box | An atmospheric fluid container used as a receiver of drained liquid. |
| DrainagePump | Drainage Pump | A pump that is used or intended to be used to drain a space. |
| Driver | Drives Type by XX | A physical object that provides rotational or reciprocating energy to driven equipment. |
| DuplexStrainer | Strainer Duplex | A strainer that is a coarse filter used to catch and hold debris being pumped through a pipeline in a products line, a refinery, or processing plant. The strainer is flanged and is bolted into the pipeline. |
| Eductor | Eductor | A form of suction pump; a device using a high pressure jet of water to create partial vacuum at an intake opening to draw liquid from a sump. |
| Ejector | Ejector | A vacuum pump intended to use the kinetic energy of a high velocity steam or air jet to transport a fluid. |
| ExpansionJoint | Expansion Joint | Flexible joint between two pipes to receive expansion from the pipes. |
| FinExchanger | Exch. Fin | Unit for transferring heat from one medium to another. |
| FlexibleHoseFlanged | Flexible Hose | Flexible Hose Flanged |
| FloatValve | Valve Floate (Manual Valve) | A self acting control valve that usually is operated by a float mechanism to regulate or maintain a liquid level in a tank. |
| FlowIndicator | Flow T. Flow Glass | A measure indicator that is intended to give a visual indication of mass or volume per time unit of a fluid passing through an open or closed conduit. |
| FlowMeter | Flow T. Element | A detecting instrument intended to measure and indicate flow rate and/or produce a signal which represents the measured flow rate. |
| FlowNozzleMeter | Flow T. Flow Nozzle | A differential pressure flow meter that utilizes a flow nozzle with a smooth guided entry and a sharp exit place in the pipe to change the flow field and create a pressure drop that is used to calculate the flow velocity. |
| FlowStraighteningVane | Flow Straight Vane | A blade in a stream behaving like fluid which is supposed to stabilise and keep the flow laminar. |
| ForcedDraughtAirCooler | Air Cooled Forced | An air cooler that uses mechanical energy to increase or create the air flow. |
| FourWayValve | Valve Four Way (Manual Valve) | A multi way valve that is made with four separate paths of flow. |
| GasBottle | Tank Gas Bottle | A pressure vessel intended to contain gas and to be used for domestic purposes. Typically with the shape of a narrow necked metal hollow vessel that can be locked with a plug or a valve. |
| GeneralEquipmentBlock | General Equipment Block | General Block |
| GumboTrap | Gumbo Trap | A trap for taking care of the heavy, sticky mud formed downhole by certain shales when they become wet from the drilling fluid. |
| Gutter | Gutter | A trough that is located along the eaves to catch and carry liquid |
| HandPump | Pump Hand | A pump that is operated by hand. |
| Hopper | Tank Hopper | A vessel with a conical shape for filling or dosing purposes |
| HoseConnector | Hose Connection | A connector intended for hose connection. |
| HydroCyclone | Hydrocyclon | A cyclone separator intended to separate a fluid by hydraulic forces |
| InducedDraughtAirCooler | Air Cooled Induced | An air cooler that uses mechanical energy to force an air flow through the cooler. |
| InletVane | Vane Type Distributer | A vane that is located at an inlet and is intended to direct fluid flow. |
| Insulation | Insulation | A device which is a non-conductor or low-conductor capable of separate conducting bodies to prevent transfer of electricity, heat, or sound. |
| InternalHeatingCoil | Internal Heating Coil | A heating coil located inside another unit. |
| InternalSprayNozzle | Internal Spray Nozzle | A spray nozzle intended to mix atomized liquid into gas inside a vessel. |
| LiftPump | Pump Lift | A pump which can be used to move a liquid from one level to a higher level. |
| LiquidRingPump | Pump Liquid Ring | A pump that is consisting of a casing and an eccentric impeller intended for pumping liquids often mixed with vapour. |
| MechanicalJoint | Mechanical Joint | A 'joint' that is joining components in a 'piping network' or a 'piping network segment'. |
| OpenDrainSystem | Open or Tundish Drain | A drain system which is exposed to atmospheric pressure and includes services for draining/disposal of not flammable or toxic liquids. System of pipes which carry liquids which may be disposed without any cleaning/rinsing. |
| OpenPit | Tank Open Pit | An open hole in the ground etc. storing substance under atmospheric conditions. |
| OrificePlate | Flow T. Orifice Plate | An 'artefact' that is a thin plate with a specified hole in the middle. It is usually placed in a pipe to measure the rate of fluid flow. |
| PilotOperatedReliefValve | Field Operated PSV | A pressure relief valve that uses a pilot valve to indirectly activate the main valve. |
| PinchValve | Valve Pinch (Manual Valve) | A membrane valve that is comprising a flexible tube, either exposed or enclosed in a body. The tube is pinched to close by mechanical means. |
| PipeCap | Welded Cap | An 'artefact' that is intended to provide closure of a pipe end by having it fitting on or over (but not inside) the end. |
| PipeUnion | Union Coupling | An 'artefact' that is an assembly of three items comprising of two threaded ends and a center piece that draws the two ends together when rotated. |
| Plug | Valve Plug | An 'artefact' that fits tigthly into a hole and blocks it. |
| ProportioningPump | Pump Proportioning | A pump that is intended to transport accurate liquid quantities according to the positive displacement pump principle. |
| Reboiler | Reboiler | A boiler that is intended to partially vaporise liquid. |
| ReducingFlange | Reducing Flange | A pipe flange where the nominal bore size of the non-flanged end is smaller than the nominal bore size of the flanged end. |
| RotaryValve | Rotary Valve | A valve that is a valve where the closure member has a rotating action. The axis of rotation is usually normal to the flow. |
| Screen | Screen | A physical object intended to shelter, protect or hide. |
| ScrewCompressor | Compressor Screw | A rotary compressor in which compression is carried out by the intermeshing of two helical or differently formed screws, which transport the gas from inlet to outlet. |
| ScrewConveyor | Conveyor Screw | A conveyor in which loose material such as grain, meal etc, is continuously propelled along a narrow trough by a revolving worm or helix mounted within it. |
| ScrewPump | Pump Screw | A rotary pump that contains one or more meshing screws within a casing to form liquid cavities that are transported axially from suction to discharge. |
| SelfActuatedPressureControlValve | Self Acting Reduction Valve | A self acting control valve that is maintaining a predefined upstream or downstream fluid flow operated by the process pressure. |
| ShaleShaker | Shale Shaker | A mechanical separator that contains a vibrating screen for sifting out rock cuttings from drilling mud. |
| ShellAndFixedTubeHeatExchanger | Exch. Shell and Fixed Tube | A shell and tube heat exchanger that has both tube sheets fixed to the shell. |
| ShellAndTubeHeatExchanger | Exch. Shell and Tube | A tubular heat exchanger in which a tube bundle is surrounded by a shell. |
| SlideGateValve | Slide Gate | A gate valve that opens and closes a passageway by sliding over a port. |
| SlidingVanePump | Pump Sliding Vane | A vane pump that contains sliding vanes in radial slots in an eccentric rotor that moves outward due to a centrifugal force to form a seal with the casing; pumped fluid may contain gases or vapors; capacity may be changed by change in eccentricity or speed. |
| SpectacleBlind | Spectacle Blind NO | An 'artefact' that consists of two discs with equal thickness and outer diameter connected with a flat bar. One of the discs has a hole, while the other disc is without hole. |
| SubmersiblePump | Pump Submerged Motor | A pump that is capable of operating when submerged in the liquid it is intended to pump. |
| SumpPump | Pump Sump | Sump Pump |
| SwivelJoint | Swivel Joint | An artefact joining two parts so that one or both can pivot freely (as on a bolt or pin) |
| TStrainer | Strainer T Type | A strainer with a T-shape. |
| Thermowell | Thermowell | An 'artefact' that is a pressure-tight receptacle adapted to receive a temperature sensing element, provided with external threads or other means for pressure-tight attachment to a vessel or pipe |
| ThreadedPipeCap | Screwed Cap | A pipe cap that has a threaded pipe end. |
| ThreeWayValve | Valve Three Way (Manual Valve) | A multi way valve that is made with three separate paths of flow. |
| ToteTank | Tank Tote | A tank which is supposed to be transported. |
| TowerPacking | Tower Packing | A physical object intended to provide a large contact surface to improve mass transfer between two phases |
| TowerTray | Tower Tray | A physical object intended to regulate counter current flow of phases and improve the contact between the phases. |
| Trap | Trap | A physical object for collection and discharge of unwanted condensate from an air-, gas- or steam-flow in pipes, jackets or reservoirs. |
| TriplexPowerPump | Pump Triplex | A pump with three plungers or pistons working in three cylinders. |
| UltrasonicFlowMeter | Flow T. Sonic | A velocity flow meter that measures the velocity of a flow by measuring the time difference between an ultrasonic pulse sent in the flow direction and an ultrasound pulse sent opposite the flow direction. |
| VacuumReliefValve | Valve Vacuum Release | A relief valve that is used for pressure compensation purposes by admitting (letting in) a pressure to prevent that vacuum is forming when filling or emptying a system. |
| VanePack | Vane Pack | A physical object that consists of a pack of thin zigzag shaped plates |
| VariableAreaFlowIndicator | Flow T. Flow Indicator | A flow gauge based on the variable area principle |
| VentTip | Vent | A ventilation device where excess gas from a process can escape from the process and into the atmosphere. |
| VenturiTubeFlowMeter | Flow T. Venturi | A differential pressure flow meter that uses a venturi tube as the restriction body. |
| VesselBoot | Vessel Boot | A "sink" or "pot" screwed or welded at the bottom of a vessel for various purposes. |
| VortexBreaker | Vortex Breaker | A physical object intended to prevent the occurrence of a vortex in a fluid |
| VortexFlowMeter | Flow T. Vortex | A flow meter that measures the velocity of a fluid in a pipe by detecting the frequency of vortices being shed from a specially shaped obstructing element in the fluid stream. |
| WashingSystem | Washing System | A system intended to wash and clean whats necesarry. |
| WasteHeatRecoveryUnit | Exch. Waste Heat Rec. Unit | A heat exchanger intended for transferring heat from exhaust gas to a heated medium. |
| WedgeGateValve | Wedge Gate Valve (Manual Valve) | A gate valve that has a wedge closure member. |
| WeldedJoint | Welded Joint | A joint that has been done by welding |
| Well | Well | A device that is arranged to obtain, produce, store or inject a material into the earth. |
| WiremeshDemister | Wiremesh Demister | A demister that is made from a wire mesh |
| YStrainer | Strainer Y Type | A strainer that is Y-shaped |