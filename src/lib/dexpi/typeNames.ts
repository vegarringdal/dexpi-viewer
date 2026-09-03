// -----------------------------------------------------------------------------
// Class-name predicates
//
// DEXPI object types are namespaced strings ("Plant/Piping.PropertyBreak",
// "DiscProfile/InformationModel.…"). These read the local class name, shared
// by the modules whose rendering rules key off a class FAMILY rather than one
// exact type.
// -----------------------------------------------------------------------------

/** Local class name, stripped of any `Plant/…`/`DiscProfile/…` namespace prefix. */
export function localTypeName(type: string): string {
  return type.split(/[./]/).pop() ?? type;
}

/**
 * A piping/signal property break — a marker on a run, not hardware of its
 * own. Same convention `validation.ts`'s `hasPropertyBreak` uses to spot one.
 */
export function isPropertyBreakType(type: string): boolean {
  return type.endsWith("PropertyBreak");
}

/** A diagram-boundary marker (pipe or signal), not hardware. */
export function isOffPageConnectorType(type: string): boolean {
  return localTypeName(type).endsWith("OffPageConnector");
}
