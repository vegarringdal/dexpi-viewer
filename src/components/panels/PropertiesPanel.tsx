import { PanelBody } from "@tredespace/ui/dockable";
import type { JSX } from "react";
import { selectionState } from "../../state/selection/selection.state.ts";
import { getEffectiveIssues } from "../../state/validation/validation.actions.ts";
import { validationConfigState } from "../../state/validation/validation.state.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { IssueRow } from "./IssuesParts.tsx";
import { ChipList, DataTable, EmptyNote, ObjectChip, Section } from "./PropertiesSections.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function CenteredNote({ text }: Readonly<{ text: string }>): JSX.Element {
  return (
    <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
      {text}
    </PanelBody>
  );
}

/**
 * Identity rows for the spec's PersistentIdentifiers (Context + Value).
 * Always at least one row, so it is visible that the file carries none.
 */
function persistentIdRows(
  persistentIds: readonly { name: string; value: string }[],
): readonly { name: string; value: string }[] {
  if (persistentIds.length === 0) {
    return [{ name: "Persistent ID", value: "—" }];
  }

  return persistentIds.map((pid) => ({
    name: pid.name === "Identifier" ? "Persistent ID" : `Persistent ID (${pid.name})`,
    value: pid.value,
  }));
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function PropertiesPanel(): JSX.Element {
  const { file, docRevision } = viewerState.use();
  const { selectedId } = selectionState.use();
  validationConfigState.use();
  void docRevision;

  if (!file) {
    return <CenteredNote text="Open a DEXPI file to get started." />;
  }

  if (!selectedId) {
    return <CenteredNote text="Select an object in the drawing or the tree." />;
  }

  const doc = getLoadedDocument();
  const node = doc?.plant.byId.get(selectedId);
  if (!doc || !node) {
    const type = doc?.objectTypes.get(selectedId) ?? "unknown";
    return <CenteredNote text={`${selectedId} (${type}) has no conceptual data.`} />;
  }

  const incoming = doc.plant.referencedBy.get(selectedId) ?? [];
  const issues = getEffectiveIssues().filter((issue) => issue.objectId === selectedId);

  const identityRows: readonly { name: string; value: string }[] = [
    { name: "ID", value: node.id },
    { name: "Type", value: node.type },
    ...persistentIdRows(node.persistentIds),
    { name: "XPath", value: node.xpath },
  ];

  return (
    <PanelBody className="h-full overflow-auto p-3">
      <h3 className="font-semibold text-slate-200 text-xs">{node.label}</h3>

      <Section title="Identity">
        <dl className="grid grid-cols-[minmax(90px,45%)_1fr] gap-x-3 gap-y-1 text-xs">
          {identityRows.map((row) => (
            <div key={row.name} className="contents">
              <dt className="truncate text-slate-400" title={row.name}>
                {row.name}
              </dt>
              <dd className="select-all break-all font-mono text-slate-200">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Data">
        <DataTable attributes={node.attributes} undefinedAttributes={node.undefinedAttributes} />
      </Section>

      <Section title="References">
        {node.references.length === 0 && <EmptyNote text="No references." />}
        <ChipList>
          {node.references.flatMap((reference) =>
            reference.targets.map((target) => (
              <ObjectChip
                key={`${reference.property}-${target}`}
                objectId={target}
                note={reference.property}
              />
            )),
          )}
        </ChipList>
      </Section>

      <Section title="Referenced by">
        {incoming.length === 0 && <EmptyNote text="Not referenced by any object." />}
        <ChipList>
          {incoming.map((ref) => (
            <ObjectChip key={`${ref.fromId}-${ref.property}`} objectId={ref.fromId} note={ref.property} />
          ))}
        </ChipList>
      </Section>

      <Section title="Parent component">
        {node.parentId ? <ObjectChip objectId={node.parentId} /> : <EmptyNote text="Top-level object." />}
      </Section>

      <Section title={`Sub-components (${node.children.length})`}>
        {node.children.length === 0 && <EmptyNote text="None." />}
        <ChipList>
          {node.children.map((child) => (
            <ObjectChip key={child.id} objectId={child.id} />
          ))}
        </ChipList>
      </Section>

      <Section title={`Issues (${issues.length})`}>
        {issues.length === 0 && <EmptyNote text="No validation findings for this object." />}
        {issues.map((issue, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: same rule can hit one object more than once; the index disambiguates.
          <IssueRow key={`${issue.ruleId}-${index}`} issue={issue} showRuleId hideObjectLink />
        ))}
      </Section>
    </PanelBody>
  );
}
