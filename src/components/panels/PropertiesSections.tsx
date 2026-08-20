import type { JSX, ReactNode } from "react";
import { setHoveredObject, setSelectedObject } from "../../state/selection/selection.actions.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";

// -----------------------------------------------------------------------------
// Building blocks for the properties panel's sections
// -----------------------------------------------------------------------------

export function Section({
  title,
  children,
}: Readonly<{ title: ReactNode; children: ReactNode }>): JSX.Element {
  return (
    <section className="mt-3">
      <h4 className="mb-1 flex items-center gap-1.5 font-semibold text-[10px] text-slate-400 uppercase tracking-wide">
        {title}
      </h4>
      {children}
    </section>
  );
}

/** Small color swatch matching the drawing's trace overlay colors. */
export function TraceDot({ kind }: Readonly<{ kind: "upstream" | "downstream" }>): JSX.Element {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        kind === "upstream" ? "bg-amber-500" : "bg-green-500"
      }`}
    />
  );
}

export function EmptyNote({ text }: Readonly<{ text: string }>): JSX.Element {
  return <div className="text-slate-500 text-xs">{text}</div>;
}

/**
 * A clickable object row: label left, bare type right. Clicking selects the
 * object (properties, tree and drawing all follow the selection store);
 * hovering highlights it in the drawing.
 */
export function ObjectChip({ objectId, note }: Readonly<{ objectId: string; note?: string }>): JSX.Element {
  const doc = getLoadedDocument();
  const node = doc?.plant.byId.get(objectId);
  const label = node?.label ?? objectId;
  const typeName = node?.typeName.split(".").pop() ?? doc?.objectTypes.get(objectId)?.split(".").pop();
  // Untagged labels are raw ids that already spell out the type — repeating
  // it just steals width from the name.
  const annotation = note ?? (typeName && !label.startsWith(typeName) ? typeName : undefined);

  return (
    <button
      type="button"
      onClick={() => setSelectedObject(objectId)}
      onMouseEnter={() => setHoveredObject(objectId)}
      onMouseLeave={() => setHoveredObject(null)}
      title={typeName ? `${label} — ${typeName}` : label}
      className="flex w-full cursor-pointer items-baseline gap-2 rounded bg-slate-800/60 px-1.5 py-0.5 text-left hover:bg-slate-700/60"
    >
      <span className="min-w-0 flex-1 truncate text-slate-200 text-xs">{label}</span>
      {annotation && <span className="shrink-0 text-[10px] text-slate-500">{annotation}</span>}
    </button>
  );
}

export function ChipList({ children }: Readonly<{ children: ReactNode }>): JSX.Element {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}
