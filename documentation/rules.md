# Validation rule reference

Generated from the app's rule tables by `npm run generate:docs` — 23 rules.
Default severities can be overridden per rule (including *Ignore*) in the Validation panel's severity configuration; overrides persist across sessions.

## Schema

| Rule | Title | Default severity | What it means |
| --- | --- | --- | --- |
| `SCH-001` | Duplicate object ids | error | Two objects share one id. Ids must be unique — duplicates break references and selection. |
| `SCH-002` | Dangling references | error | A References target id does not exist in the document (namespace-qualified published-model targets are exempt). |
| `SCH-003` | Invalid object id syntax | error | An object id violates the DEXPI XML Schema identifier pattern [A-Za-z_][A-Za-z_0-9]*. |
| `SCH-004` | Invalid reference syntax | error | A References token is neither "#id" nor a qualified name reference ("Model/Name.Name"). |

## Graphics

| Rule | Title | Default severity | What it means |
| --- | --- | --- | --- |
| `GFX-001` | Unknown catalogue shapes | error/warning | A ShapeUsage/SymbolUsage does not resolve to a catalogue Shape or a loaded DISC-profile symbol. Aggregated per symbol; well-known shapes like /Border warn only. |
| `GFX-002` | Undrawable connector lines | warning | A ConnectorLine has fewer than two resolvable points and cannot be drawn. |
| `GFX-003` | Missing diagram extent | warning | The Diagram declares no usable Min/Max extent; bounds were computed from geometry. |

## Connectivity

| Rule | Title | Default severity | What it means |
| --- | --- | --- | --- |
| `CON-001` | Unconnected flow items | warning | A flow item (Pipe/Stream) is missing its source or target connection. Off-page ends are legitimate — confirm intent. |
| `CON-002` | Orphaned piping nodes | warning | A PipingNode is not referenced by any SourceNode/TargetNode connection. |
| `CON-003` | Unconnected nozzles | info | A nozzle has no piping connected to it or its nodes — possibly an intentional spare. |
| `CON-004` | Nominal diameter mismatch | warning | The two nodes a connection joins declare different nominal diameters (like representations compared only; segment endpoints skipped — a PipeReducer inside legitimately changes DN). |
| `CON-005` | Piping class change without property break | info | The piping class changes between two connected segments without a PropertyBreak marking the transition. |

## Model

| Rule | Title | Default severity | What it means |
| --- | --- | --- | --- |
| `MDL-000` | Model version not available | warning | The document declares a DEXPI model version this build has no tables for; validation fell back to the newest available. |
| `MDL-001` | Unknown class | warning | An object's class is not in the DEXPI information model (base-model namespaces only — extension classes are exempt). |
| `MDL-002` | Unknown attribute | warning | A Data property is not defined for the object's class (typo detection; namespaced extension attributes are exempt). |
| `MDL-003` | Missing required property | error | A property with lower bound 1 is missing (an <Undefined/> value counts as missing). |
| `MDL-004` | Invalid enumeration value | error | An enumeration-typed property carries a literal the model does not define, or references the wrong enumeration. |
| `MDL-005` | Unknown reference property | warning | A References property is not defined for the object's class. |
| `MDL-006` | Cardinality violation | error | A property carries more reference targets or components than its upper bound allows. |
| `MDL-007` | Reference target class mismatch | error | A reference target's class is incompatible with the declared target class (profile extension ancestry is honoured; unknown extensions are skipped, never guessed). |
| `MDL-008` | Unknown component property | warning | A Components property is not defined for the object's class. |
| `MDL-009` | Abstract class instantiated | error | An abstract model class is instantiated — the spec requires a concrete subclass. |

## Meta data

| Rule | Title | Default severity | What it means |
| --- | --- | --- | --- |
| `META-002` | Invalid template attribute references | error | An AttributeRepresentation names an attribute that does not resolve on (or near) its object — the template fragment renders blank. |

The `MDL-*` family is model-driven: every base-model object is checked against the DEXPI information model the document declares via its `data.dexpi.org` Import URIs (see [metamodel.md](metamodel.md)).
