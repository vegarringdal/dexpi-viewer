import type { JSX } from "react";
import type { DiscProfile } from "../../../lib/dexpi/discProfile.ts";
import type { PlantModel, PlantReference } from "../../../lib/dexpi/plantModel.ts";
import {
  profileSymbolDetailRows,
  resolveSymbolReferenceName,
} from "../../../lib/dexpi/profileSymbolSummary.ts";
import { getLoadedDocument } from "../../../state/viewer/viewer.actions.ts";
import {
  ChipList,
  DataTable,
  EmptyNote,
  IdentitySection,
  ObjectChip,
  PlantNodeChip,
  Section,
} from "../PropertiesSections.tsx";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type InverseGroup = Readonly<{
  key: string;
  typeName: string;
  property: string;
  targets: readonly string[];
}>;

type ObjectDataViewProps = Readonly<{
  plant: PlantModel;
  nodeId: string | null;
  onSelect: (id: string) => void;
  /** Resolves an outgoing reference target that isn't a plant object (e.g.
   *  a SymbolUsage's Symbol reference into the profile's catalogue). */
  profile?: DiscProfile | null;
}>;

// -----------------------------------------------------------------------------
// Profile-target resolution
// -----------------------------------------------------------------------------

type ResolvedProfileTarget = Readonly<{
  kind: "instance" | "symbol";
  label: string;
  detail: string;
  /** The full published data — every instance attribute, or every variant's
   *  shape/condition/primitive/label — shown expanded on demand. */
  rows: readonly Readonly<{ name: string; value: string }>[];
}>;

function resolveProfileTarget(
  target: string,
  profile: DiscProfile | null | undefined,
): ResolvedProfileTarget | null {
  if (!profile) {
    return null;
  }

  const bare = target.split("/").pop() ?? target;
  const instance = profile.instances.get(target) ?? profile.instances.get(bare);
  if (instance) {
    const abbreviation = instance.get("Abbreviation");
    return {
      kind: "instance",
      label: bare.split(".").pop() ?? bare,
      detail: abbreviation ? `profile instance — Abbreviation "${abbreviation}"` : "profile instance",
      rows: [...instance.entries()].map(([name, value]) => ({ name, value })),
    };
  }

  const symbol = profile.symbols.get(target) ?? profile.symbols.get(bare);
  if (symbol) {
    const variantCount = symbol.variants.length;
    return {
      kind: "symbol",
      label: symbol.name,
      detail: `profile symbol — ${String(variantCount)} variant${variantCount === 1 ? "" : "s"}`,
      rows: profileSymbolDetailRows(symbol),
    };
  }

  return null;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Groups `plant.referencedBy.get(nodeId)` by the referencing object's bare
 *  type name + property, e.g. "AttributeRepresentation.Object". */
function groupInverseReferences(plant: PlantModel, nodeId: string): readonly InverseGroup[] {
  const byKey = new Map<string, { typeName: string; property: string; targets: string[] }>();
  const order: string[] = [];
  for (const ref of plant.referencedBy.get(nodeId) ?? []) {
    const typeName = plant.byId.get(ref.fromId)?.typeName.split(".").pop() ?? "?";
    const key = `${typeName}.${ref.property}`;
    if (!byKey.has(key)) {
      byKey.set(key, { typeName, property: ref.property, targets: [] });
      order.push(key);
    }
    byKey.get(key)?.targets.push(ref.fromId);
  }

  return order.map((key) => {
    const group = byKey.get(key);
    // biome-ignore lint/style/noNonNullAssertion: key came from byKey's own keys.
    return { key, ...group! };
  });
}

// -----------------------------------------------------------------------------
// Rows
// -----------------------------------------------------------------------------

function InverseReferenceGroup({
  plant,
  group,
  onSelect,
}: Readonly<{ plant: PlantModel; group: InverseGroup; onSelect: (id: string) => void }>): JSX.Element {
  const label = `${group.typeName}.${group.property}`;

  if (group.targets.length === 1) {
    const target = group.targets[0];
    if (target === undefined) {
      return <EmptyNote text={label} />;
    }

    return <PlantNodeChip plant={plant} id={target} note={label} onSelect={onSelect} />;
  }

  return (
    <details className="rounded bg-slate-800/40">
      <summary className="cursor-pointer select-none px-1.5 py-0.5 text-slate-300 text-xs">
        {label} <span className="text-slate-500">[{group.targets.length}]</span>
      </summary>
      <div className="flex flex-col gap-0.5 py-1 pl-3">
        {group.targets.map((target) => (
          <PlantNodeChip key={target} plant={plant} id={target} onSelect={onSelect} />
        ))}
      </div>
    </details>
  );
}

function ProfileTargetChip({
  target,
  resolved,
}: Readonly<{ target: string; resolved: ResolvedProfileTarget }>): JSX.Element {
  const header = (
    <div className="flex w-full items-baseline gap-2 rounded bg-slate-800/60 px-1.5 py-0.5 text-left">
      <span className="min-w-0 flex-1 truncate text-slate-200 text-xs">{resolved.label}</span>
      <span className="shrink-0 text-[10px] text-slate-500">{resolved.detail}</span>
    </div>
  );

  if (resolved.rows.length === 0) {
    return (
      <div title={target} className="w-full">
        {header}
      </div>
    );
  }

  return (
    <details title={target} className="rounded">
      <summary className="cursor-pointer select-none list-none">{header}</summary>
      <div className="pt-1 pl-3">
        <DataTable attributes={resolved.rows} undefinedAttributes={[]} />
      </div>
    </details>
  );
}

/** One outgoing `References` target: an object of the panel's own model
 *  (clickable chip, panel-local selection), a ConceptualModel object
 *  (clickable chip through the GLOBAL selection — the Diagram Tree's model
 *  holds only Diagram-branch objects, so every `Represents`/`Object`
 *  target resolves here, not above), a profile catalogue entry (instance
 *  or symbol, resolved read-only), or — when none of them has it — an
 *  inline unresolved note. */
function ReferenceTarget({
  plant,
  target,
  profile,
  onSelect,
}: Readonly<{
  plant: PlantModel;
  target: string;
  profile: DiscProfile | null | undefined;
  onSelect: (id: string) => void;
}>): JSX.Element {
  if (plant.byId.has(target)) {
    return <PlantNodeChip plant={plant} id={target} onSelect={onSelect} />;
  }

  if (getLoadedDocument()?.plant.byId.has(target)) {
    return <ObjectChip objectId={target} />;
  }

  const resolved = resolveProfileTarget(target, profile);
  if (resolved) {
    return <ProfileTargetChip target={target} resolved={resolved} />;
  }

  return (
    <div className="flex w-full items-baseline gap-2 rounded bg-red-950/40 px-1.5 py-0.5 text-left">
      <span className="min-w-0 flex-1 truncate text-red-300 text-xs">{target}</span>
      <span className="shrink-0 text-[10px] text-red-400/80">unresolved</span>
    </div>
  );
}

function ReferenceGroup({
  plant,
  reference,
  profile,
  onSelect,
}: Readonly<{
  plant: PlantModel;
  reference: PlantReference;
  profile: DiscProfile | null | undefined;
  onSelect: (id: string) => void;
}>): JSX.Element {
  if (reference.targets.length === 1) {
    const target = reference.targets[0];
    if (target === undefined) {
      return <EmptyNote text={reference.property} />;
    }

    return (
      <div className="flex items-center gap-1.5">
        <span className="w-24 shrink-0 truncate text-[10px] text-slate-500">{reference.property}</span>
        <div className="min-w-0 flex-1">
          <ReferenceTarget plant={plant} target={target} profile={profile} onSelect={onSelect} />
        </div>
      </div>
    );
  }

  return (
    <details className="rounded bg-slate-800/40">
      <summary className="cursor-pointer select-none px-1.5 py-0.5 text-slate-300 text-xs">
        {reference.property} <span className="text-slate-500">[{reference.targets.length}]</span>
      </summary>
      <div className="flex flex-col gap-0.5 py-1 pl-3">
        {reference.targets.map((target) => (
          <ReferenceTarget key={target} plant={plant} target={target} profile={profile} onSelect={onSelect} />
        ))}
      </div>
    </details>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * The embedded bottom section of the ConceptualModel Tree / Diagram Tree
 * panels: the selected row's raw Data table, its outgoing References
 * (resolved against the document, falling back to the loaded profile's
 * catalogue), and its Inverse References grouped by
 * `ReferencingType.property`, each group collapsible when it has more than
 * one target.
 */
export function ObjectDataView({ plant, nodeId, onSelect, profile }: ObjectDataViewProps): JSX.Element {
  if (!nodeId) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-slate-500 text-xs">
        Select a row above.
      </div>
    );
  }

  const node = plant.byId.get(nodeId);
  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-3 text-center text-slate-500 text-xs">
        {nodeId} has no data.
      </div>
    );
  }

  const groups = groupInverseReferences(plant, nodeId);
  const symbolName = resolveSymbolReferenceName(node, profile);

  return (
    <div className="h-full overflow-auto p-3">
      <h3 className="font-semibold text-slate-200 text-xs">{node.label}</h3>
      {symbolName && (
        <div className="text-slate-400 text-xs">
          Symbol: <span className="font-semibold text-slate-200">{symbolName}</span>
        </div>
      )}

      <IdentitySection node={node} />

      <Section title="Data">
        <DataTable attributes={node.attributes} undefinedAttributes={node.undefinedAttributes} />
      </Section>

      {node.references.length > 0 && (
        <Section title="References">
          <ChipList>
            {node.references.map((reference) => (
              <ReferenceGroup
                key={reference.property}
                plant={plant}
                reference={reference}
                profile={profile}
                onSelect={onSelect}
              />
            ))}
          </ChipList>
        </Section>
      )}

      <Section title="Inverse References">
        {groups.length === 0 && <EmptyNote text="Not referenced by any object." />}
        <ChipList>
          {groups.map((group) => (
            <InverseReferenceGroup key={group.key} plant={plant} group={group} onSelect={onSelect} />
          ))}
        </ChipList>
      </Section>
    </div>
  );
}
