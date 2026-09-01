import type { JSX, ReactNode } from "react";
import type { PlantAttribute, PlantModel } from "../../lib/dexpi/plantModel.ts";
import { setHoveredObject, setSelectedObject } from "../../state/selection/selection.actions.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { useDragResize } from "./useDragResize.ts";

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

const DEFAULT_LABEL_COL_WIDTH_PX = 120;
const MIN_LABEL_COL_WIDTH_PX = 60;
const MAX_LABEL_COL_WIDTH_PX = 360;

const INDENT = "  ";

/**
 * Breaks a formatted aggregate value (`values.ts`'s generic "Type { a: 1,
 * b: 2 }" fallback, used for Stroke/Color/etc. — anything without a
 * dedicated formatter) into an indented multi-line block, one entry per
 * line, nested braces indented further. Values with no `{` (the vast
 * majority — plain numbers, strings, PhysicalQuantity, …) pass through
 * unchanged. Brace/comma-driven, not a real parser: safe here because
 * `formatAggregate` never puts a literal `{`, `}` or `,` inside a leaf
 * value (numbers/enum names/quoted-free strings only).
 */
function prettyPrintValue(value: string): string {
  if (!value.includes("{")) {
    return value;
  }

  let depth = 0;
  let out = "";
  let skipNextSpace = false;
  for (const ch of value) {
    if (skipNextSpace) {
      skipNextSpace = false;
      if (ch === " ") {
        continue;
      }
    }

    if (ch === "{") {
      depth++;
      out += `{\n${INDENT.repeat(depth)}`;
      skipNextSpace = true;
    } else if (ch === "}") {
      depth = Math.max(0, depth - 1);
      out = `${out.trimEnd()}\n${INDENT.repeat(depth)}}`;
    } else if (ch === ",") {
      out += `,\n${INDENT.repeat(depth)}`;
      skipNextSpace = true;
    } else {
      out += ch;
    }
  }
  return out;
}

/** The attribute/value table shared by the Properties panel's "Data"
 *  section and the ConceptualModel/Diagram Tree panels' embedded view.
 *  The attribute-name column is drag-resizable and wraps instead of
 *  truncating, so a long name is never fully hidden. */
export function DataTable({
  attributes,
  undefinedAttributes,
}: Readonly<{
  attributes: readonly PlantAttribute[];
  undefinedAttributes: readonly string[];
}>): JSX.Element {
  const labelCol = useDragResize(DEFAULT_LABEL_COL_WIDTH_PX, {
    axis: "x",
    min: MIN_LABEL_COL_WIDTH_PX,
    max: MAX_LABEL_COL_WIDTH_PX,
  });

  if (attributes.length === 0 && undefinedAttributes.length === 0) {
    return <EmptyNote text="No attributes." />;
  }

  return (
    <div className="relative">
      <dl className="grid gap-x-3 gap-y-1 text-xs" style={{ gridTemplateColumns: `${labelCol.size}px 1fr` }}>
        {attributes.map((attr) => (
          <div key={attr.name} className="contents">
            <dt className="break-words text-slate-400">{attr.name}</dt>
            <dd className="whitespace-pre-wrap break-words font-mono text-slate-200">
              {prettyPrintValue(attr.value)}
            </dd>
          </div>
        ))}
        {undefinedAttributes.map((name) => (
          <div key={name} className="contents">
            <dt className="break-words text-slate-500">{name}</dt>
            <dd className="font-mono text-slate-500 italic">(undefined)</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        aria-label="Resize attribute column"
        onPointerDown={labelCol.onPointerDown}
        className="group -translate-x-1/2 absolute inset-y-0 z-10 flex w-3 cursor-col-resize touch-none justify-center"
        style={{ left: labelCol.size }}
      >
        <span className="h-full w-px bg-slate-600 group-hover:w-0.5 group-hover:bg-blue-500" />
      </button>
    </div>
  );
}

/**
 * Like `ObjectChip`, but resolves against an explicit `plant` model instead
 * of the global loaded document's conceptual model, and lets the caller
 * decide what a click does — needed for the Diagram Tree panel, whose
 * synthetic xpath ids aren't valid global selection targets and whose
 * click behavior differs from the conceptual model's direct-select.
 */
export function PlantNodeChip({
  plant,
  id,
  note,
  onSelect,
}: Readonly<{ plant: PlantModel; id: string; note?: string; onSelect: (id: string) => void }>): JSX.Element {
  const node = plant.byId.get(id);
  const label = node?.label ?? id;
  const typeName = node?.typeName.split(".").pop();
  const annotation = note ?? (typeName && !label.startsWith(typeName) ? typeName : undefined);

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      onMouseEnter={() => setHoveredObject(id)}
      onMouseLeave={() => setHoveredObject(null)}
      title={typeName ? `${label} — ${typeName}` : label}
      className="flex w-full cursor-pointer items-baseline gap-2 rounded bg-slate-800/60 px-1.5 py-0.5 text-left hover:bg-slate-700/60"
    >
      <span className="min-w-0 flex-1 truncate text-slate-200 text-xs">{label}</span>
      {annotation && <span className="shrink-0 text-[10px] text-slate-500">{annotation}</span>}
    </button>
  );
}
