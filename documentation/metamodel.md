# DEXPI 2.0 information model

Generated from `refrences/Dexpi-2.0.xmi` by `npm run generate:metamodel` + `generate:docs`:
**484 classes** and **89 enumerations**. Model-driven validation (the `MDL-*` rules) checks every object against these tables.

## Core (7 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| Core/ConceptualModel *(abstract)* | 3 | — | ConceptualObject |
| Core/ConceptualObject *(abstract)* | 3 | — | — |
| Core/EngineeringModel | 7 | ExportDateTime, OriginatingSystemName, OriginatingSystemVendorName, OriginatingSystemVersion | — |
| Core/Note | 4 | — | ConceptualObject |
| Core/PersistentIdentifier | 2 | Context, Value | — |
| Core/QualifiedValue | 11 | DisplayText, Value | ConceptualObject |
| Core/Role | 3 | Name | — |

## Core/Diagram (29 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| AttributeRepresentation | 3 | AttributeName, Object, Type | TextTemplateFragment |
| Border | 0 | — | RepresentationTypeGroup |
| ConnectorLine | 4 | Stroke | GraphicalPrimitive |
| CustomSymbol | 0 | — | Symbol |
| Diagram | 6 | BackgroundColor, MaxX, MaxY, MinX, MinY, Name | RepresentationGroup |
| Ellipse | 6 | Center, FillStyle, HorizontalSemiAxis, Rotation, Stroke, VerticalSemiAxis | GraphicalPrimitive |
| EllipseArc | 7 | Center, EndAngle, HorizontalSemiAxis, Rotation, StartAngle, Stroke, VerticalSemiAxis | GraphicalPrimitive |
| GraphicalElement *(abstract)* | 0 | — | — |
| GraphicalPrimitive *(abstract)* | 0 | — | GraphicalElement |
| GraphicsGroup *(abstract)* | 0 | — | — |
| InsulationSymbol | 0 | — | Symbol |
| Label | 0 | — | RepresentationTypeGroup |
| LiteralText | 1 | Text | TextTemplateFragment |
| MetaData | 33 | — | ConceptualObject |
| NodePosition *(abstract)* | 1 | Position | — |
| PipeFlowArrow | 0 | — | Symbol |
| PipeSlopeSymbol | 0 | — | Symbol |
| Polygon | 3 | FillStyle, Points, Stroke | GraphicalPrimitive |
| PolyLine | 2 | Points, Stroke | GraphicalPrimitive |
| RepresentationGroup | 3 | Represents | GraphicsGroup |
| RepresentationTypeGroup *(abstract)* | 1 | — | GraphicsGroup |
| Shape | 3 | Name, SymbolRegistrationNumber | — |
| ShapeCatalogue | 2 | Name | — |
| ShapeUsage | 6 | IsMirrored, Position, Rotation, ScaleX, ScaleY, Shape | GraphicalElement |
| Static | 0 | — | RepresentationTypeGroup |
| Symbol | 0 | — | RepresentationTypeGroup |
| Text | 8 | Alignment, Color, Font, Position, Rotation, Size, Text | GraphicalPrimitive |
| TextTemplate | 1 | — | — |
| TextTemplateFragment *(abstract)* | 0 | — | — |

## Plant (1 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| Plant/PlantModel | 8 | — | ConceptualModel |

## Plant/Diagram (39 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| ActuatingElectricalSystemNumberLabel | 0 | — | Label |
| ActuatingSystemNumberLabel | 0 | — | Label |
| CustomLabel | 0 | — | Label |
| DeviceInformationLabel | 0 | — | Label |
| EquipmentBarLabel | 0 | — | Label |
| EquipmentTagNameLabel | 0 | — | Label |
| FailActionLabel | 0 | — | Label |
| FittingLabel | 0 | — | Label |
| InstrumentationNodePosition | 0 | — | NodePosition |
| InsulationBreakLabel | 0 | — | Label |
| InsulationLabel | 0 | — | Label |
| MeasuringSystemNumberLabel | 0 | — | Label |
| MPRelevanceLabel | 0 | — | Label |
| NoteIdentifierLabel | 0 | — | Label |
| NoteTextLabel | 0 | — | Label |
| NozzleStandardLabel | 0 | — | Label |
| OffPageConnectorDescriptionLabel | 0 | — | Label |
| OffPageConnectorNumberLabel | 0 | — | Label |
| PipingClassBreakLabel | 0 | — | Label |
| PipingNetworkSegmentLabel | 0 | — | Label |
| PipingNetworkSystemLabel | 0 | — | Label |
| PipingNodePosition | 1 | — | NodePosition |
| PlantMetaData | 16 | — | MetaData |
| ProcessInstrumentationFunctionLabel | 0 | — | Label |
| QualityRelevanceLabel | 0 | — | Label |
| ReducerLabel | 0 | — | Label |
| ReferencedPIDNumberLabel | 0 | — | Label |
| SafetyRelevanceLabel | 0 | — | Label |
| SafetyValveOrFittingLabel | 0 | — | Label |
| SignalConveyingFunctionLabel | 0 | — | Label |
| SignalHighHighHighLabel | 0 | — | Label |
| SignalHighHighLabel | 0 | — | Label |
| SignalHighLabel | 0 | — | Label |
| SignalLowLabel | 0 | — | Label |
| SignalLowLowLabel | 0 | — | Label |
| SignalLowLowLowLabel | 0 | — | Label |
| TypicalInformationLabel | 0 | — | Label |
| ValveLabel | 0 | — | Label |
| VendorNameLabel | 0 | — | Label |

## Plant/Instrumentation (32 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| ActuatingElectricalFunction | 3 | — | ConceptualObject, SignalConveyingFunctionTarget, TechnicalItem |
| ActuatingElectricalLocation *(abstract)* | 0 | — | — |
| ActuatingElectricalSystem | 3 | — | ConceptualObject, TechnicalItem |
| ActuatingFunction | 3 | — | ConceptualObject, SignalConveyingFunctionSource, SignalConveyingFunctionTarget, TechnicalItem |
| ActuatingSystem | 5 | — | ConceptualObject, TechnicalItem |
| ControlledActuator | 4 | — | ConceptualObject |
| ElectronicFrequencyConverter | 1 | — | ConceptualObject |
| FlowDetector | 0 | — | MeasuringSystem |
| FlowInSignalOffPageConnector | 0 | — | SignalConveyingFunctionSource, SignalOffPageConnector |
| FlowOutSignalOffPageConnector | 0 | — | SignalConveyingFunctionTarget, SignalOffPageConnector |
| InlineMeasuringElementReference | 1 | — | MeasuringElement |
| InstrumentationLoopFunction | 2 | — | ConceptualObject, TechnicalItem |
| MeasuringElement | 1 | — | ConceptualObject |
| MeasuringLineFunction | 0 | — | SignalConveyingFunction |
| MeasuringSystem | 5 | — | ConceptualObject, TechnicalItem |
| OfflineMeasuringElement | 14 | — | MeasuringElement |
| OperatedValveReference | 2 | — | ConceptualObject |
| Positioner | 2 | — | ConceptualObject |
| ProcessControlFunction | 0 | — | ProcessInstrumentationFunction |
| ProcessInstrumentationFunction | 19 | — | ConceptualObject, SignalConveyingFunctionSource, SignalConveyingFunctionTarget, TechnicalItem |
| ProcessSignalGeneratingFunction | 4 | — | ConceptualObject, SignalConveyingFunctionSource, TechnicalItem |
| SensingLocation *(abstract)* | 0 | — | — |
| SensorwellReference | 2 | — | ConceptualObject |
| SignalConveyingFunction | 6 | — | ConceptualObject |
| SignalConveyingFunctionSource *(abstract)* | 0 | — | — |
| SignalConveyingFunctionTarget *(abstract)* | 0 | — | — |
| SignalLineFunction | 0 | — | SignalConveyingFunction |
| SignalOffPageConnector *(abstract)* | 3 | — | ConceptualObject |
| SignalOffPageConnectorObjectReference | 1 | — | SignalOffPageConnectorReference |
| SignalOffPageConnectorReference *(abstract)* | 0 | — | ConceptualObject |
| SignalOffPageConnectorReferenceByNumber | 2 | — | SignalOffPageConnectorReference |
| Transmitter | 2 | — | ConceptualObject |

## Plant/Piping (74 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| AngleBallValve | 0 | — | OperatedValve |
| AngleGlobeValve | 0 | — | OperatedValve |
| AnglePlugValve | 0 | — | OperatedValve |
| AngleValve | 0 | — | OperatedValve |
| BallValve | 0 | — | OperatedValve |
| BlindFlange | 0 | — | PipeFitting |
| BreatherValve | 0 | — | SafetyValveOrFitting |
| ButterflyValve | 0 | — | OperatedValve |
| CheckValve | 5 | — | PipingComponent |
| ClampedFlangeCoupling | 0 | — | PipeFitting |
| Compensator | 0 | — | PipeFitting |
| ConicalStrainer | 0 | — | PipeFitting |
| DirectPipingConnection | 0 | — | PipingConnection |
| ElectromagneticFlowMeter | 0 | — | InlineMeasuringElement |
| FlameArrestor | 3 | — | SafetyValveOrFitting |
| Flange | 0 | — | PipeFitting |
| FlangedConnection | 0 | — | PipeFitting |
| FlowInPipeOffPageConnector | 0 | — | PipeOffPageConnector, PipingSourceItem |
| FlowMeasuringElement | 0 | — | InlineMeasuringElement |
| FlowNozzle | 0 | — | InlineMeasuringElement |
| FlowOutPipeOffPageConnector | 0 | — | PipeOffPageConnector, PipingTargetItem |
| Funnel | 0 | — | PipeFitting |
| GateValve | 0 | — | OperatedValve |
| GlobeCheckValve | 0 | — | CheckValve |
| GlobeValve | 0 | — | OperatedValve |
| Hose | 0 | — | PipeFitting |
| IlluminatedSightGlass | 0 | — | PipeFitting |
| InlineMeasuringElement | 4 | — | PipingComponent |
| InLineMixer | 0 | — | PipeFitting |
| LineBlind | 0 | — | PipeFitting |
| MassFlowMeasuringElement | 0 | — | InlineMeasuringElement |
| NeedleValve | 0 | — | OperatedValve |
| OperatedValve | 7 | — | PipingComponent |
| Penetration | 0 | — | PipeFitting |
| Pipe | 0 | — | ConceptualObject, PipingConnection |
| PipeCoupling | 0 | — | PipeFitting |
| PipeFitting | 5 | — | PipingComponent |
| PipeFlangeSpacer | 0 | — | PipeFitting |
| PipeFlangeSpade | 0 | — | PipeFitting |
| PipeOffPageConnector *(abstract)* | 3 | — | ConceptualObject, PipingNetworkSegmentItem, PipingNodeOwner |
| PipeOffPageConnectorObjectReference | 1 | — | PipeOffPageConnectorReference |
| PipeOffPageConnectorReference *(abstract)* | 0 | — | ConceptualObject |
| PipeOffPageConnectorReferenceByNumber | 2 | — | PipeOffPageConnectorReference |
| PipeReducer | 0 | — | PipeFitting |
| PipeTee | 0 | — | PipeFitting |
| PipingComponent *(abstract)* | 7 | — | ConceptualObject, SensingLocation, PipingNetworkSegmentItem, PipingNodeOwner, PipingSourceItem, PipingTargetItem |
| PipingConnection *(abstract)* | 4 | — | — |
| PipingNetworkSegment | 28 | — | ConceptualObject, ActuatingElectricalLocation, SensingLocation |
| PipingNetworkSegmentItem *(abstract)* | 0 | — | — |
| PipingNetworkSystem | 18 | — | ConceptualObject, TechnicalItem |
| PipingNode | 4 | — | ConceptualObject |
| PipingNodeOwner *(abstract)* | 1 | — | — |
| PipingSourceItem *(abstract)* | 0 | — | — |
| PipingTargetItem *(abstract)* | 0 | — | — |
| PlugValve | 0 | — | OperatedValve |
| PositiveDisplacementFlowMeter | 0 | — | InlineMeasuringElement |
| PropertyBreak | 4 | — | ConceptualObject, PipingNetworkSegmentItem, PipingNodeOwner, PipingSourceItem, PipingTargetItem |
| RestrictionOrifice | 0 | — | PipeFitting |
| RuptureDisc | 0 | — | SafetyValveOrFitting |
| SafetyValveOrFitting | 6 | — | PipingComponent |
| Sensorwell | 5 | — | PipeFitting |
| SightGlass | 0 | — | PipeFitting |
| Silencer | 0 | — | PipeFitting |
| SpringLoadedAngleGlobeSafetyValve | 0 | — | SafetyValveOrFitting |
| SpringLoadedGlobeSafetyValve | 0 | — | SafetyValveOrFitting |
| SteamTrap | 0 | — | PipeFitting |
| StraightwayValve | 0 | — | OperatedValve |
| Strainer | 0 | — | PipeFitting |
| SwingCheckValve | 0 | — | CheckValve |
| TurbineFlowMeter | 0 | — | InlineMeasuringElement |
| VariableAreaFlowMeter | 0 | — | InlineMeasuringElement |
| VentLine | 0 | — | PipeFitting, Vent |
| VenturiTube | 0 | — | InlineMeasuringElement |
| VolumeFlowMeasuringElement | 0 | — | InlineMeasuringElement |

## Plant/PlantStructure (17 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| Enterprise | 2 | — | IndustrialComplexParentStructure, PlantSectionParentStructure, PlantStructureItem, ProcessPlantParentStructure, TechnicalItemParentStructure |
| IndustrialComplex | 3 | — | PlantAreaLocatedStructure, PlantSectionParentStructure, PlantStructureItem, TechnicalItemParentStructure |
| IndustrialComplexParentStructure *(abstract)* | 0 | — | — |
| PlantArea | 2 | — | PlantStructureItem |
| PlantAreaLocatedStructure *(abstract)* | 1 | — | — |
| PlantSection | 3 | — | PlantAreaLocatedStructure, PlantStructureItem, TechnicalItemParentStructure |
| PlantSectionParentStructure *(abstract)* | 0 | — | — |
| PlantStructureItem *(abstract)* | 0 | — | ConceptualObject |
| PlantSystem | 2 | — | PlantStructureItem |
| PlantSystemLocatedStructure *(abstract)* | 1 | — | — |
| PlantTrain | 2 | — | PlantStructureItem |
| PlantTrainLocatedStructure *(abstract)* | 1 | — | — |
| ProcessPlant | 3 | — | PlantAreaLocatedStructure, PlantSectionParentStructure, PlantStructureItem, TechnicalItemParentStructure |
| ProcessPlantParentStructure *(abstract)* | 0 | — | — |
| Site | 3 | — | IndustrialComplexParentStructure, PlantSectionParentStructure, PlantStructureItem, ProcessPlantParentStructure, TechnicalItemParentStructure |
| TechnicalItem *(abstract)* | 1 | — | PlantAreaLocatedStructure, PlantSystemLocatedStructure, PlantTrainLocatedStructure |
| TechnicalItemParentStructure *(abstract)* | 0 | — | — |

## Plant/ProcessEquipment (142 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| AccessNozzle | 0 | — | Nozzle |
| Agglomerator | 6 | — | ProcessEquipment |
| Agitator | 3 | — | ProcessEquipment |
| AgitatorRotor | 5 | — | ConceptualObject |
| AirCoolingSystem | 4 | — | HeatExchanger |
| AirEjector | 2 | — | Compressor |
| AlternatingCurrentGenerator | 1 | — | ElectricGenerator |
| AlternatingCurrentMotor | 2 | — | Motor |
| AlternatingCurrentMotorAsComponent | 2 | — | MotorAsComponent |
| AxialBlower | 1 | — | Blower |
| AxialCompressor | 3 | — | Compressor |
| AxialFan | 1 | — | Fan |
| BatchWeigher | 2 | — | Weigher |
| Blower | 4 | — | ProcessEquipment |
| Boiler | 0 | — | Heater |
| BriquettingRoller | 3 | — | ConceptualObject |
| Burner | 1 | — | ProcessEquipment |
| CentrifugalBlower | 1 | — | Blower |
| CentrifugalCompressor | 3 | — | Compressor |
| CentrifugalPump | 3 | — | Pump |
| Centrifuge | 3 | — | ProcessEquipment |
| Chamber | 15 | — | ConceptualObject |
| ChamberOwner *(abstract)* | 1 | — | — |
| Chimney | 0 | — | WasteGasEmitter |
| ColumnInternalsArrangement *(abstract)* | 0 | — | ConceptualObject |
| ColumnPackingsArrangement | 4 | — | ColumnInternalsArrangement |
| ColumnSection *(abstract)* | 3 | — | ConceptualObject |
| ColumnTraysArrangement | 3 | — | ColumnInternalsArrangement |
| CombustionEngine | 1 | — | Motor |
| CombustionEngineAsComponent | 1 | — | MotorAsComponent |
| Compressor | 2 | — | ProcessEquipment |
| ContinuousWeigher | 1 | — | Weigher |
| ConvectionDryer | 1 | — | Dryer |
| Conveyor | 4 | — | StationaryTransportSystem |
| CoolingTower | 2 | — | ProcessEquipment |
| CoolingTowerRotor | 3 | — | ConceptualObject |
| Crusher | 1 | — | Mill |
| CrusherElement | 3 | — | ConceptualObject |
| DirectCurrentGenerator | 0 | — | ElectricGenerator |
| DirectCurrentMotor | 1 | — | Motor |
| DirectCurrentMotorAsComponent | 1 | — | MotorAsComponent |
| Displacer | 4 | — | ConceptualObject |
| DryCoolingTower | 3 | — | CoolingTower |
| Dryer | 4 | — | ProcessEquipment |
| DryingChamber | 4 | — | ConceptualObject |
| EjectorPump | 1 | — | Pump |
| ElectricalSeparator | 1 | — | Separator |
| ElectricGenerator | 4 | — | ProcessEquipment |
| ElectricHeater | 4 | — | Heater |
| EquipmentVent | 0 | — | Vent |
| Extruder | 3 | — | ProcessEquipment |
| Fan | 4 | — | ProcessEquipment |
| Feeder | 4 | — | ProcessEquipment |
| Filter | 0 | — | ProcessEquipment |
| FilteringCentrifuge | 2 | — | Centrifuge |
| FilteringCentrifugeDrum | 3 | — | ConceptualObject |
| FilterUnit | 9 | — | ConceptualObject |
| Flare | 0 | — | WasteGasEmitter |
| ForkliftTruck | 1 | — | MobileTransportSystem |
| Furnace | 0 | — | Heater |
| GasFilter | 5 | — | Filter |
| GasTurbine | 1 | — | Turbine |
| GearBox | 5 | — | ConceptualObject |
| GravitationalSeparator | 2 | — | Separator |
| Grinder | 1 | — | Mill |
| GrindingElement | 3 | — | ConceptualObject |
| HeatedSurfaceDryer | 1 | — | Dryer |
| Heater | 5 | — | ProcessEquipment |
| HeatExchanger | 4 | — | ProcessEquipment |
| HeatExchangerRotor | 2 | — | ConceptualObject |
| Impeller | 4 | — | ConceptualObject |
| InstrumentNozzle | 0 | — | Nozzle |
| Kneader | 3 | — | Mixer |
| Lift | 3 | — | StationaryTransportSystem |
| LiquidFilter | 5 | — | Filter |
| LoadingUnloadingSystem | 3 | — | StationaryTransportSystem |
| MechanicalSeparator | 1 | — | Separator |
| Mill | 6 | — | ProcessEquipment |
| Mixer | 1 | — | ProcessEquipment |
| MixingElementAssembly | 3 | — | ConceptualObject |
| MobileTransportSystem | 2 | — | ProcessEquipment |
| Motor | 2 | — | ProcessEquipment |
| MotorAsComponent | 3 | — | ConceptualObject, TransmissionDriver |
| Mount | 2 | — | ConceptualObject, SensingLocation |
| Nozzle | 6 | — | ConceptualObject, ActuatingElectricalLocation, SensingLocation, PipingNodeOwner, PipingSourceItem, PipingTargetItem |
| NozzleOwner *(abstract)* | 1 | — | — |
| PackagingSystem | 4 | — | ProcessEquipment |
| PelletizerDisc | 2 | — | ConceptualObject |
| PlateHeatExchanger | 3 | — | HeatExchanger |
| PressureVessel | 1 | — | Vessel |
| ProcessColumn | 2 | — | ProcessEquipment |
| ProcessEquipment *(abstract)* | 8 | — | ChamberOwner, NozzleOwner, TaggedPlantItem, TransmissionDriver |
| ProcessNozzle | 0 | — | Nozzle |
| Pump | 3 | — | ProcessEquipment |
| RadialFan | 1 | — | Fan |
| RailWaggon | 0 | — | MobileTransportSystem |
| ReciprocatingCompressor | 3 | — | Compressor |
| ReciprocatingExtruder | 1 | — | Extruder |
| ReciprocatingPressureAgglomerator | 3 | — | Agglomerator |
| ReciprocatingPump | 3 | — | Pump |
| RevolvingSieve | 2 | — | Sieve |
| RotaryCompressor | 3 | — | Compressor |
| RotaryMixer | 3 | — | Mixer |
| RotaryPump | 3 | — | Pump |
| RotatingExtruder | 1 | — | Extruder |
| RotatingGrowthAgglomerator | 1 | — | Agglomerator |
| RotatingPressureAgglomerator | 3 | — | Agglomerator |
| Screw | 3 | — | ConceptualObject |
| ScrubbingSeparator | 0 | — | Separator |
| SedimentalCentrifuge | 2 | — | Centrifuge |
| SedimentalCentrifugeDrum | 3 | — | ConceptualObject |
| Separator | 3 | — | ProcessEquipment |
| Ship | 0 | — | MobileTransportSystem |
| Sieve | 2 | — | ProcessEquipment |
| SieveElement | 6 | — | ConceptualObject |
| Silo | 0 | — | Vessel |
| SpiralHeatExchanger | 0 | — | HeatExchanger |
| SprayCooler | 1 | — | CoolingTower |
| SprayNozzle | 3 | — | ConceptualObject |
| StaticMixer | 1 | — | Mixer |
| StationarySieve | 0 | — | Sieve |
| StationaryTransportSystem | 1 | — | ProcessEquipment |
| SteamGenerator | 0 | — | Heater |
| SteamTurbine | 2 | — | Turbine |
| SubTaggedColumnSection | 1 | — | ColumnSection |
| TaggedColumnSection | 0 | — | ColumnSection, TaggedPlantItem |
| TaggedPlantItem *(abstract)* | 4 | — | ConceptualObject, TechnicalItem |
| Tank | 1 | — | Vessel |
| ThinFilmEvaporator | 4 | — | HeatExchanger |
| TransmissionDriver *(abstract)* | 0 | — | — |
| TransmissionSystem | 3 | — | ConceptualObject, TransmissionDriver |
| TransportableContainer | 0 | — | MobileTransportSystem |
| Truck | 0 | — | MobileTransportSystem |
| TubeBundle | 8 | — | ConceptualObject |
| TubularHeatExchanger | 2 | — | HeatExchanger |
| Turbine | 2 | — | ProcessEquipment |
| Vent *(abstract)* | 0 | — | ConceptualObject |
| Vessel | 3 | — | ProcessEquipment |
| VibratingSieve | 1 | — | Sieve |
| WasteGasEmitter | 1 | — | ProcessEquipment |
| Weigher | 2 | — | ProcessEquipment |
| WetCoolingTower | 4 | — | CoolingTower |

## Process (1 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| Process/ProcessModel | 9 | — | ConceptualModel |

## Process/Process (142 classes)

| Class | Own properties | Required | Supertypes |
| --- | --- | --- | --- |
| Absorbing | 0 | — | SeparatingByPhysicalProcess |
| Adsorbing | 0 | — | SeparatingByPhysicalProcess |
| Agglomerating | 2 | — | IncreasingParticleSize |
| Agitating | 2 | — | ProcessStepDetail |
| BlowingDown | 0 | — | SteeringFlow |
| Boiling | 1 | — | SupplyingThermalEnergy |
| CalculatingProcessVariable *(abstract)* | 0 | — | InstrumentationActivity |
| CalculatingRatio | 3 | — | CalculatingProcessVariable |
| CalculatingSplitRange | 4 | — | CalculatingProcessVariable |
| Coalescing | 0 | — | IncreasingParticleSize |
| Composition | 5 | — | ConceptualObject |
| Compressing | 6 | Method | GeneratingFlow |
| ContactingInPacking | 2 | — | ProcessStepDetail |
| ContactingOnTray | 1 | — | ProcessStepDetail |
| ControllingProcessVariable | 3 | — | InstrumentationActivity |
| ConveyingSignal | 1 | InformationValue | InstrumentationActivity |
| Cooling | 0 | — | RemovingThermalEnergy |
| Crushing | 0 | — | ReducingParticleSize |
| Crystallizing | 1 | — | IncreasingParticleSize |
| CustomMaterialComponent | 1 | — | MaterialComponent |
| Cutting | 0 | — | ReducingParticleSize |
| Distilling | 10 | — | SeparatingByThermalProcess |
| Draining | 0 | — | SteeringFlow |
| DrivingByEngine | 2 | — | SupplyingMechanicalEnergy |
| DrivingByMotor | 1 | — | SupplyingMechanicalEnergy |
| DrivingByTurbine | 3 | Method | SupplyingMechanicalEnergy |
| Drying | 3 | — | SeparatingByThermalProcess |
| ElectricalEnergyFlow | 4 | — | EnergyFlow |
| ElectricalEnergyPort | 0 | — | EnergyPort |
| Emitting | 2 | — | ProcessStep |
| EnergyFlow | 1 | — | ProcessConnection |
| EnergyPort | 0 | — | Port |
| Evaporating | 2 | — | SeparatingByThermalProcess |
| ExchangingThermalEnergy | 9 | Method | ProcessStep |
| Extruding | 0 | — | FormingSolidMaterial |
| FeedingMaterial | 1 | — | SteeringFlow |
| Filtering | 3 | — | SeparatingMechanically |
| Flaring | 3 | — | ProcessStep |
| Flocculating | 0 | — | IncreasingParticleSize |
| FormingSolidMaterial | 5 | — | ProcessStep |
| GeneratingACPower | 1 | — | SupplyingElectricalEnergy |
| GeneratingDCPower | 0 | — | SupplyingElectricalEnergy |
| GeneratingFlow | 2 | — | ProcessStep |
| GeneratingInFuelCell | 1 | — | SupplyingElectricalEnergy |
| GeneratingSteam | 0 | — | SupplyingThermalEnergy |
| Grinding | 0 | — | ReducingParticleSize |
| HeatingElectrical | 4 | — | SupplyingThermalEnergy |
| HeatingInFurnace | 2 | — | SupplyingThermalEnergy |
| Humidifying | 2 | — | Mixing |
| IncreasingParticleSize | 6 | — | ProcessStep |
| InformationFlow | 1 | InformationValue | ProcessConnection |
| InformationPort | 0 | — | Port |
| InformationVariant | 5 | BooleanValue, DoubleValue, IntegerValue, VariantType, VectorSize | ConceptualObject |
| InstrumentationActivity *(abstract)* | 3 | Description, Identifier, Label | ConceptualObject |
| InstrumentationSystemActivity | 4 | Description, Identifier, InstrumentationActivities, Label | ConceptualObject |
| Kneading | 3 | — | Mixing |
| LimitingFlow | 1 | — | SteeringFlow |
| ListOfMaterialComponents | 1 | Component | ConceptualObject |
| MaterialComponent *(abstract)* | 3 | — | ConceptualObject |
| MaterialPort | 1 | — | Port |
| MaterialState | 5 | Description, Identifier, Label | ConceptualObject |
| MaterialStateType | 9 | Composition, Description, Identifier, Label | ConceptualObject |
| MaterialTemplate | 7 | Description, Identifier, Label, ListOfComponents, NumberOfMaterialComponents, NumberOfPhases | ConceptualObject |
| MeasuringProcessVariable | 7 | — | InstrumentationActivity |
| MechanicalEnergyFlow | 2 | — | EnergyFlow |
| MechanicalEnergyPort | 0 | — | EnergyPort |
| Milling | 0 | — | ReducingParticleSize |
| Mixing | 0 | — | ProcessStep |
| MixingSimple | 0 | — | Mixing |
| Packaging | 0 | — | ProcessStep |
| Pelletizing | 0 | — | FormingSolidMaterial |
| Port *(abstract)* | 6 | ConnectorReference, Identifier, NominalDirection | ConceptualObject |
| PreventingBackflow | 2 | — | SteeringFlow |
| ProcessConnection *(abstract)* | 5 | Identifier, Label, Source, Target | ConceptualObject |
| ProcessStep *(abstract)* | 11 | Identifier | ConceptualObject |
| ProcessStepDetail *(abstract)* | 5 | Description, Identifier, Label | ConceptualObject |
| Pumping | 3 | — | GeneratingFlow |
| PureMaterialComponent | 2 | — | MaterialComponent |
| ReactingChemicals | 2 | Method | ProcessStep |
| ReducingParticleSize | 4 | — | ProcessStep |
| RegulatingFlow | 3 | — | SteeringFlow |
| RelievingOverpressure | 0 | — | SteeringFlow |
| RelievingVacuum | 0 | — | SteeringFlow |
| RelievingVacuumAndOverpressure | 0 | — | SteeringFlow |
| RemovingThermalEnergy | 7 | Method | ProcessStep |
| RotaryMixing | 2 | — | Mixing |
| Separating | 3 | — | ProcessStep |
| SeparatingByCentrifugalForce | 4 | — | SeparatingByPhaseSeparation |
| SeparatingByContact | 0 | — | SeparatingByPhysicalProcess |
| SeparatingByCyclonicMotion | 1 | — | SeparatingByPhaseSeparation |
| SeparatingByElectromagneticForce | 2 | — | Separating |
| SeparatingByElectrostaticForce | 2 | — | SeparatingByElectromagneticForce |
| SeparatingByFlash | 0 | — | Separating |
| SeparatingByGravity | 2 | — | SeparatingByPhaseSeparation |
| SeparatingByIonExchange | 0 | — | SeparatingByPhysicalProcess |
| SeparatingByMagneticForce | 3 | — | SeparatingByElectromagneticForce |
| SeparatingByPhaseSeparation | 0 | — | Separating |
| SeparatingByPhysicalProcess | 0 | — | Separating |
| SeparatingBySurfaceTension | 7 | — | SeparatingByPhysicalProcess |
| SeparatingByThermalProcess | 1 | — | Separating |
| SeparatingMechanically | 0 | — | Separating |
| ShuttingOffFlow | 3 | — | SteeringFlow |
| Sieving | 3 | — | SeparatingMechanically |
| Sink | 1 | — | ProcessStep |
| Skimming | 1 | — | SeparatingMechanically |
| Source | 1 | — | ProcessStep |
| Splitting *(abstract)* | 0 | — | ProcessStep |
| SplittingEnergy | 1 | — | Splitting |
| SplittingMaterial | 1 | — | Splitting |
| StabilizingDistilling | 0 | — | Distilling |
| StaticMixing | 0 | — | Mixing |
| SteeringFlow *(abstract)* | 2 | — | ProcessStep |
| StoringElectricalEnergy | 3 | — | StoringEnergy |
| StoringEnergy *(abstract)* | 3 | — | ProcessStep |
| StoringFluids | 1 | — | StoringMaterial |
| StoringInBattery | 0 | — | StoringElectricalEnergy |
| StoringInPressureVessel | 0 | — | StoringFluids |
| StoringInSilo | 1 | — | StoringSolids |
| StoringInTank | 0 | — | StoringFluids |
| StoringMaterial *(abstract)* | 2 | — | ProcessStep |
| StoringSolids | 0 | — | StoringMaterial |
| StoringThermalEnergy | 0 | — | StoringEnergy |
| Stream | 6 | — | ProcessConnection |
| StrippingDistilling | 0 | — | Distilling |
| SupplyingElectricalEnergy | 3 | — | ProcessStep |
| SupplyingFluids | 2 | — | ProcessStep |
| SupplyingMechanicalEnergy | 3 | — | ProcessStep |
| SupplyingSolids | 2 | — | ProcessStep |
| SupplyingThermalEnergy | 8 | — | ProcessStep |
| SupplyingThermalEnergyWithBurner | 2 | — | ProcessStepDetail |
| ThermalEnergyFlow | 1 | — | EnergyFlow |
| ThermalEnergyPort | 0 | — | EnergyPort |
| TransformingProcessVariable | 4 | — | CalculatingProcessVariable |
| TransportingElectricalEnergy | 5 | — | ProcessStep |
| TransportingFluids | 4 | — | ProcessStep |
| TransportingFluidsInChannel | 2 | — | TransportingFluids |
| TransportingFluidsInHose | 1 | — | TransportingFluids |
| TransportingFluidsInPipe | 1 | — | TransportingFluids |
| TransportingSolids | 1 | — | ProcessStep |
| TransportingSolidsContinuously | 2 | — | TransportingSolids |
| TransportingSolidsDiscontinuously | 1 | — | TransportingSolids |
| VacuumDistilling | 0 | — | Distilling |

## Enumerations

| Enumeration | Literals |
| --- | --- |
| QuantityProvenance | Calculated, Estimated, Observed, Set, Specified |
| QuantityRange | Actual, Average, LowerLimit, Nominal, Normal, UpperLimit |
| Scope | Alarm, Allowable, Design, Expected, Incidental, Operating, Protection, Rated, Test, Warning |
| AttributeRepresentationType | Units, Value, ValueAndUnits |
| ConfidentialityClassification | ConfidentialInformation, NonConfidentialInformation |
| DashStyle | Dash, DashShortDash, Dot, LongDash, LongDashShortDash, LongDashShortDashShortDash, ShortDash, Solid |
| FillStyle | Hatch, Solid, Transparent |
| TextAlignment | CenterBottom, CenterCenter, CenterTop, LeftBottom, LeftCenter, LeftTop, RightBottom, RightCenter, RightTop |
| AreaUnit | CentimetreSquared, FootSquared, InchSquared, MetreSquared, MillimetreSquared, YardSquared |
| DensityUnit | KilogramPerLitre, KilogramPerMetreCubed, PoundMassPerFootCubed, PoundMassPerUsGallon |
| DynamicViscosityUnit | Centipoise, MillipascalSecond, PascalSecond, Poise |
| ElectricalFrequencyUnit | Hertz, KiloHertz, MegaHertz |
| ElectricCurrentUnit | Ampere, Kiloampere, Milliampere |
| EnergyDensityUnit | JoulePerCubicMetre, KilojoulePerCubicMetre |
| EnergyUnit | Joule, Kilojoule, KilowattHour, Megajoule, MegawattHour |
| ForceUnit | KiloNewton, Newton |
| HeatCapacityUnit | BtuITPerDegreeFahrenheit, BtuThPerDegreeFahrenheit, WattPerKelvin |
| HeatTransferCoefficientUnit | KilowattPerMetreSquaredKelvin, WattPerMetreSquaredKelvin |
| HeatTransferResistanceUnit | FootSquaredHourDegreeFahrenheitPerBtuTh, MetreSquaredKelvinPerWatt |
| KinematicViscosityUnit | CentimetreSquaredPerSecond, Centistoke, MetreSquaredPerSecond, Stoke |
| LengthUnit | Centimetre, Foot, Inch, Kilometre, Metre, Micrometre, Millimetre, Nanometre |
| MagneticFieldIntensityUnit | AmperePerMetre, KiloamperePerMetre, Oersted |
| MagneticFluxDensityUnit | Gauss, Tesla |
| MassConcentrationUnit | KilogramPerLitre, KilogramPerMetreCubed, PoundMassPerFootCubed, PoundMassPerUsGallon |
| MassFlowRateUnit | KilogramPerHour, KilogramPerMinute, KilogramPerSecond, PoundMassPerHour, PoundMassPerMinute, PoundMassPerSecond |
| MassSpecificEnergyUnit | KilojoulePerKilogram, MegajoulePerKilogram |
| MassSpecificHeatCapacityUnit | BtuITPerPoundDegreeFahrenheit, KilojoulePerKilogramKelvin |
| MassUnit | Gram, Kilogram, PoundMass, Tonne |
| MoleConcentrationUnit | MillimolePerLitre, MolePerLitre |
| MoleFlowRateUnit | KilomolePerSecond, PoundMolePerSecond |
| MoleSpecificEnergyUnit | JoulePerMole, KilocaloriePerMole, KilojoulePerKilomole, KilojoulePerMole |
| MomentOfForceUnit | NewtonMetre, PoundForceFoot |
| NumberPerTimeIntervalUnit | ReciprocalMinute, ReciprocalSecond |
| ParticleSizeUnit | Inch, Micrometre, Millimetre |
| PercentageUnit | Percent |
| pHUnit | pH |
| PowerUnit | Kilowatt, Megawatt, Watt |
| PressureAbsoluteUnit | Bar, Kilopascal, Megapascal, Millibar, Pascal, PoundForcePerInchSquared |
| PressureGaugeUnit | Bar, Kilopascal, Megapascal, Millibar, Pascal, PoundForcePerInchSquared |
| RotationalFrequencyUnit | ReciprocalMinute, ReciprocalSecond |
| SurfaceTensionUnit | DynePerCentimetre, NewtonPerMetre, PoundForcePerInch |
| TemperatureUnit | DegreeCelsius, DegreeFahrenheit, Kelvin |
| ThermalConductivityUnit | BtuITPerHourFootDegreeFahrenheit, WattPerMetreKelvin |
| TimeIntervalUnit | Day, Hour, Millisecond, Minute, Month, Second, Year |
| VelocityUnit | FootPerSecond, KilometrePerHour, MetrePerSecond, MilePerHour, NauticalMilePerHour |
| VoltageUnit | KiloVolt, MegaVolt, Volt |
| VolumeFlowRateUnit | FootCubedPerHour, FootCubedPerMinute, LitrePerSecond, MetreCubedPerDay, MetreCubedPerHour, MetreCubedPerMinute, MetreCubedPerSecond |
| VolumeUnit | CentimetreCubed, DecimetreCubed, FootCubed, Litre, MetreCubed, UsFluidOunce, UsGallon |
| ChamberFunctionClassification | Cooling, Heating, Processing, Tempering |
| CompositionBreakClassification | CompositionBreak, NoCompositionBreak |
| DetonationProofArtefactClassification | DetonationProofArtefact, NonDetonationProofArtefact |
| ExplosionProofArtefactClassification | ExplosionProofArtefact, NonExplosionProofArtefact |
| FailActionClassification | FailClose, FailOpen, FailRetainPosition |
| FireResistantArtefactClassification | FireResistantArtefact, NonFireResistantArtefact |
| GmpRelevanceClassification | GmpRelevantFunction, NonGmpRelevantFunction |
| GuaranteedSupplyFunctionClassification | GuaranteedSupplyFunction, NonGuaranteedSupplyFunction |
| HeatTracingTypeClassification | ElectricalHeatTracingSystem, HeatTracingSystem, NoHeatTracingSystem, SteamHeatTracingSystem, TubularHeatTracingSystem |
| InsulationBreakClassification | InsulationBreak, NoInsulationBreak |
| JacketedPipeClassification | JacketedPipe, UnjacketedPipe |
| LocationClassification | CentralLocation, ControlPanel, Field |
| NominalDiameterBreakClassification | NoNominalDiameterBreak, NominalDiameterBreak |
| NominalDiameterStandardClassification | Din2448ObjectDn100, Din2448ObjectDn125, Din2448ObjectDn15, Din2448ObjectDn150, Din2448ObjectDn20, Din2448ObjectDn200, Din2448ObjectDn25, Din2448ObjectDn32, Din2448ObjectDn40, Din2448ObjectDn50, Din2448ObjectDn65, Din2448ObjectDn80, Iso6708ObjectDn100, Iso6708ObjectDn1000, Iso6708ObjectDn1200, Iso6708ObjectDn125, Iso6708ObjectDn1400, Iso6708ObjectDn15, Iso6708ObjectDn150, Iso6708ObjectDn1600, Iso6708ObjectDn20, Iso6708ObjectDn200, Iso6708ObjectDn25, Iso6708ObjectDn250, Iso6708ObjectDn300, Iso6708ObjectDn32, Iso6708ObjectDn350, Iso6708ObjectDn40, Iso6708ObjectDn400, Iso6708ObjectDn450, Iso6708ObjectDn50, Iso6708ObjectDn500, Iso6708ObjectDn600, Iso6708ObjectDn65, Iso6708ObjectDn700, Iso6708ObjectDn80, Iso6708ObjectDn800, Iso6708ObjectDn900, Nps10Artefact, Nps12Artefact, Nps14Artefact, Nps16Artefact, Nps18Artefact, Nps1Artefact, Nps1_1_PER_2Artefact, Nps1_1_PER_4Artefact, Nps1_PER_2Artefact, Nps1_PER_4Artefact, Nps20Artefact, Nps24Artefact, Nps2Artefact, Nps2_1_PER_2Artefact, Nps30Artefact, Nps36Artefact, Nps3Artefact, Nps3_1_PER_2Artefact, Nps3_PER_4Artefact, Nps42Artefact, Nps48Artefact, Nps4Artefact, Nps54Artefact, Nps5Artefact, Nps60Artefact, Nps6Artefact, Nps8Artefact |
| NominalPressureStandardClassification | Class10000PsiArtefact, Class1000KpaArtefact, Class125LbsArtefact, Class15000PsiArtefact, Class1500LbsArtefact, Class150LbsArtefact, Class16BarArtefact, Class20000PsiArtefact, Class2000PsiArtefact, Class2500LbsArtefact, Class250PsiArtefact, Class3000PsiArtefact, Class300LbsArtefact, Class300PsiArtefact, Class315BarArtefact, Class345BarArtefact, Class350BarArtefact, Class4000PsiArtefact, Class400LbsArtefact, Class4500LbsArtefact, Class4500PsiArtefact, Class5000PsiArtefact, Class50BarArtefact, Class517BarArtefact, Class6000PsiArtefact, Class600LbsArtefact, Class690BarArtefact, Class800LbsArtefact, Class800PsiArtefact, Class850KpaArtefact, Class9000LbsArtefact, Class900LbsArtefact, En1333Pn100Artefact, En1333Pn10Artefact, En1333Pn160Artefact, En1333Pn16Artefact, En1333Pn250Artefact, En1333Pn25Artefact, En1333Pn2_COMMA_5Artefact, En1333Pn320Artefact, En1333Pn400Artefact, En1333Pn40Artefact, En1333Pn63Artefact, En1333Pn6Artefact |
| NumberOfPortsClassification | FourPortValve, ThreePortValve, TwoPortValve |
| OnHoldClassification | NotOnHold, OnHold |
| OperationClassification | ContinuousOperation, IntermittentOperation |
| PipingClassArtefactClassification | NonPipingClassArtefact, PipingClassArtefact |
| PipingClassBreakClassification | NoPipingClassBreak, PipingClassBreak |
| PipingNetworkSegmentFlowClassification | DualFlowPipingNetworkSegment, SingleFlowPipingNetworkSegment |
| PipingNetworkSegmentSlopeClassification | SlopedPipingNetworkSegment, UnslopedPipingNetworkSegment |
| PortStatusClassification | StatusHighHighHighPort, StatusHighHighPort, StatusHighPort, StatusLowLowLowPort, StatusLowLowPort, StatusLowPort |
| PrimarySecondaryPipingNetworkSegmentClassification | PrimaryPipingNetworkSegment, SecondaryPipingNetworkSegment |
| QualityRelevanceClassification | NonQualityRelevantFunction, QualityRelevantFunction |
| SignalConveyingTypeClassification | CapillarySignalConveying, ConductedRadiationSignalConveying, ElectricalSignalConveying, HydraulicSignalConveying, PneumaticSignalConveying |
| SiphonClassification | NoSiphon, Siphon |
| CompositionBasis | Mass, Mole |
| CompositionDisplay | AbsoluteValue, Fraction, Percent |
| CompressionMethod | AxialMotion, Blower, CentrifugalMotion, CustomMethod, Ejector, Fan, ReciprocatingMotion, RotaryMotion, Unspecified |
| EngineDriveMethod | Diesel, GasTurbine, OttoCycle, Unspecified |
| HeatExchangeMethod | Generic, Plate, Spiral, Tubular |
| InformationVariantType | Boolean, Double, Integer |
| MeasuredQuantity | AudioVisual, Density, ElectricCurrent, ElectricPotential, ElectromagneticField, Energy, Flow, Humidity, Level, MultipleQuantities, NumberOfEvents, Power, Pressure, PressureDifference, Quality, Radiation, SpatialDimension, Time, Velocity, VibrationOrTorque, WeightMassForce |
| MotorDriveMethod | AlternatingCurrent, DirectCurrent, StepperMotor, Unspecified |
| PortDirection | Inlet, Outlet |
| ProcessStepHierarchyLevel | ControlFunction, ElementaryFunction, Process, ProcessSection, ProcessTrain, SafetyFunction, SupportFunction, UnitOperation |
| PumpingMethod | CentrifugalMotion, CustomMethod, Eductor, PositiveDisplacement, RotaryMotion, Unspecified |
| ReactionProcessType | FluidizedBed, PackedBed, Tank, Tubular, Unspecified |
| TrayRole | Bottom, Feed, Monitored, Top |
| TurbineDriveMethod | Expander, Unspecified, WaterTurbine, WindTurbine |
