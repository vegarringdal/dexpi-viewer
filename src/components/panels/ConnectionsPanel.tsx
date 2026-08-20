import { IconRepeat } from "@tabler/icons-react";
import { PanelBody } from "@tredespace/ui/dockable";
import { Button } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { findLoopMembers, isPassThroughType } from "../../lib/dexpi/connectivity.ts";
import { selectionState } from "../../state/selection/selection.state.ts";
import { toggleTrace } from "../../state/trace/trace.actions.ts";
import { traceState } from "../../state/trace/trace.state.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { ChipList, EmptyNote, ObjectChip, Section, TraceDot } from "./PropertiesSections.tsx";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function CenteredNote({ text }: Readonly<{ text: string }>): JSX.Element {
  return (
    <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
      {text}
    </PanelBody>
  );
}

/**
 * Direct flow neighbourhood of the selected object, straight from the
 * connectivity graph: what feeds it, what it feeds, and the connection
 * points (ports/nodes/nozzles) linking it to its owner and vice versa.
 */
export function ConnectionsPanel(): JSX.Element {
  const { file, docRevision } = viewerState.use();
  const { selectedId } = selectionState.use();
  const { mode } = traceState.use();
  void docRevision;

  if (!file) {
    return <CenteredNote text="Open a DEXPI file to get started." />;
  }

  if (!selectedId) {
    return <CenteredNote text="Select an object in the drawing or the tree." />;
  }

  const doc = getLoadedDocument();
  if (!doc) {
    return <CenteredNote text="No document loaded." />;
  }

  // Equipment connects via its ports/nozzles, so their flow edges count as
  // the object's own (excluding the object and the points themselves).
  const linked = [...(doc.connectivity.bridges.get(selectedId) ?? [])];
  const own = new Set([selectedId, ...linked]);
  const gather = (edges: ReadonlyMap<string, ReadonlySet<string>>): string[] => {
    const out = new Set<string>();
    for (const id of own) {
      for (const neighbor of edges.get(id) ?? []) {
        if (!own.has(neighbor)) {
          out.add(neighbor);
        }
      }
    }
    return [...out];
  };
  const upstream = gather(doc.connectivity.backward);
  const downstream = gather(doc.connectivity.forward);
  const label = doc.plant.byId.get(selectedId)?.label ?? selectedId;
  const loopCount = [...findLoopMembers(doc.connectivity, selectedId)].filter(
    (id) => !isPassThroughType(doc.objectTypes.get(id) ?? ""),
  ).length;

  return (
    <PanelBody className="h-full overflow-auto p-3">
      <h3 className="font-semibold text-slate-200 text-xs">{label}</h3>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Trace in drawing:</span>
        <Button
          active={mode === "upstream"}
          onClick={() => toggleTrace("upstream")}
          tooltip={"Highlight the full upstream run in amber\nClick again to clear"}
        >
          <TraceDot kind="upstream" /> Upstream
        </Button>
        <Button
          active={mode === "downstream"}
          onClick={() => toggleTrace("downstream")}
          tooltip={"Highlight the full downstream run in green\nClick again to clear"}
        >
          <TraceDot kind="downstream" /> Downstream
        </Button>
        <Button
          active={mode === "both"}
          onClick={() => toggleTrace("both")}
          tooltip={"Highlight the whole connected run\nClick again to clear"}
        >
          <TraceDot kind="upstream" />
          <TraceDot kind="downstream" /> Both
        </Button>
      </div>

      {loopCount > 0 && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-500 leading-snug">
          <IconRepeat size={13} className="mt-0.5 shrink-0" />
          <span>
            Part of a recirculation loop: {loopCount} objects are both upstream and downstream, so both traces
            highlight the same run.
          </span>
        </div>
      )}

      <Section
        title={
          <>
            <TraceDot kind="upstream" /> Upstream ({upstream.length})
          </>
        }
      >
        {upstream.length === 0 && <EmptyNote text="Nothing feeds this object." />}
        <ChipList>
          {upstream.map((id) => (
            <ObjectChip key={id} objectId={id} />
          ))}
        </ChipList>
      </Section>

      <Section
        title={
          <>
            <TraceDot kind="downstream" /> Downstream ({downstream.length})
          </>
        }
      >
        {downstream.length === 0 && <EmptyNote text="This object feeds nothing." />}
        <ChipList>
          {downstream.map((id) => (
            <ObjectChip key={id} objectId={id} />
          ))}
        </ChipList>
      </Section>

      <Section title={`Connection points (${linked.length})`}>
        {linked.length === 0 && <EmptyNote text="No ports, nodes or nozzles." />}
        <ChipList>
          {linked.map((id) => (
            <ObjectChip key={id} objectId={id} />
          ))}
        </ChipList>
      </Section>
    </PanelBody>
  );
}
