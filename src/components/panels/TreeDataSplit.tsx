import type { JSX, ReactNode } from "react";
import { useDragResize } from "./useDragResize.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_TYPE_COL_WIDTH_PX = 96;
const MIN_TYPE_COL_WIDTH_PX = 48;
const MAX_TYPE_COL_WIDTH_PX = 240;

const DEFAULT_DATA_HEIGHT_PX = 224;
const MIN_DATA_HEIGHT_PX = 100;
const MAX_DATA_HEIGHT_PX = 480;

type TreeDataSplitProps = Readonly<{
  tree: ReactNode;
  data: ReactNode;
}>;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * The ConceptualModel/Diagram Tree panels' body: a tree (top) whose type
 * column is drag-resizable via a thin handle bar sitting above it (feeding
 * `--pt-type-col-width` to `PlantTree`'s `resizableTypeColumn` rows), and a
 * Data/Inverse-References section (bottom) whose height is drag-resizable
 * via a handle between the two — both pointer-drag only, no persistence.
 */
export function TreeDataSplit({ tree, data }: TreeDataSplitProps): JSX.Element {
  const typeCol = useDragResize(DEFAULT_TYPE_COL_WIDTH_PX, {
    axis: "x",
    min: MIN_TYPE_COL_WIDTH_PX,
    max: MAX_TYPE_COL_WIDTH_PX,
    invert: true,
  });
  const dataHeight = useDragResize(DEFAULT_DATA_HEIGHT_PX, {
    axis: "y",
    min: MIN_DATA_HEIGHT_PX,
    max: MAX_DATA_HEIGHT_PX,
    invert: true,
  });

  return (
    <>
      <div
        className="relative min-h-0 flex-1"
        style={{ ["--pt-type-col-width" as string]: `${typeCol.size}px` }}
      >
        {tree}
        <button
          type="button"
          aria-label="Resize type column"
          onPointerDown={typeCol.onPointerDown}
          className="group -translate-x-1/2 absolute inset-y-0 z-10 flex w-3 cursor-col-resize touch-none justify-center"
          style={{ right: typeCol.size }}
        >
          <span className="h-full w-px bg-slate-600 group-hover:w-0.5 group-hover:bg-blue-500" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Resize data section"
        onPointerDown={dataHeight.onPointerDown}
        className="h-1.5 shrink-0 cursor-row-resize border-slate-800 border-y bg-slate-900 hover:bg-slate-700"
      />
      <div className="shrink-0 overflow-auto" style={{ height: dataHeight.size }}>
        {data}
      </div>
    </>
  );
}
