import type { JSX } from "react";
import type { PlantModel } from "../../../lib/dexpi/plantModel.ts";
import { ChipList, DataTable, EmptyNote, PlantNodeChip, Section } from "../PropertiesSections.tsx";

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
}>;

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

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * The embedded bottom section of the ConceptualModel Tree / Diagram Tree
 * panels: the selected row's raw Data table plus its Inverse References
 * grouped by `ReferencingType.property`, each group collapsible when it
 * has more than one target.
 */
export function ObjectDataView({ plant, nodeId, onSelect }: ObjectDataViewProps): JSX.Element {
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

  return (
    <div className="h-full overflow-auto p-3">
      <h3 className="font-semibold text-slate-200 text-xs">{node.label}</h3>

      <Section title="Data">
        <DataTable attributes={node.attributes} undefinedAttributes={node.undefinedAttributes} />
      </Section>

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
