import type { JSX, ReactNode } from "react";

// -----------------------------------------------------------------------------
// Helper components
// -----------------------------------------------------------------------------

function LegendSection({ title, children }: Readonly<{ title: string; children: ReactNode }>): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="font-semibold text-[10px] text-slate-400 uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  );
}

function LegendRow({ sample, text }: Readonly<{ sample: ReactNode; text: string }>): JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-10 shrink-0 justify-center">{sample}</span>
      <span>{text}</span>
    </div>
  );
}

function LineSample({ className, dash }: Readonly<{ className: string; dash?: string }>): JSX.Element {
  return (
    <svg role="img" aria-label="line style sample" width={40} height={10}>
      <path d="M 0 5 H 32" fill="none" strokeWidth={1.5} strokeDasharray={dash} className={className} />
    </svg>
  );
}

function ArrowSample(): JSX.Element {
  return (
    <svg role="img" aria-label="flow edge sample" width={40} height={10}>
      <path d="M 0 5 H 32" fill="none" strokeWidth={1.5} className="stroke-slate-400" />
      <path d="M 32 1 L 40 5 L 32 9 z" className="fill-slate-400" />
    </svg>
  );
}

function BoxSample({ className, dashed }: Readonly<{ className: string; dashed?: boolean }>): JSX.Element {
  return (
    <svg role="img" aria-label="node style sample" width={40} height={16}>
      <rect
        x={1}
        y={1}
        width={38}
        height={14}
        rx={dashed ? 7 : 4}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "3 2" : undefined}
        className={className}
      />
    </svg>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/** In-panel legend explaining the graph's visual encoding and interactions. */
export function GraphLegend(): JSX.Element {
  return (
    <div className="absolute top-2 right-2 z-10 flex max-h-[calc(100%-1rem)] w-72 flex-col gap-3 overflow-auto rounded border border-slate-700 bg-slate-900/95 p-3 text-slate-300 text-xs shadow-lg">
      <LegendSection title="Edges">
        <LegendRow sample={<ArrowSample />} text="Flow, in the direction it runs" />
        <LegendRow
          sample={<LineSample className="stroke-slate-600" dash="4 3" />}
          text="Containment — the left object owns the right"
        />
        <LegendRow
          sample={<LineSample className="stroke-amber-700/70" dash="1.5 3" />}
          text="Reference (hover shows the property)"
        />
        <LegendRow
          sample={<LineSample className="stroke-blue-500" />}
          text="Touches the selected or hovered object"
        />
      </LegendSection>
      <LegendSection title="Nodes (border = category)">
        <LegendRow sample={<BoxSample className="fill-slate-900 stroke-emerald-600" />} text="Equipment" />
        <LegendRow sample={<BoxSample className="fill-slate-900 stroke-slate-500" />} text="Piping" />
        <LegendRow
          sample={<BoxSample className="fill-slate-900 stroke-violet-500" />}
          text="Instrumentation"
        />
        <LegendRow sample={<BoxSample className="fill-slate-900 stroke-cyan-600" />} text="Process" />
        <LegendRow
          sample={<BoxSample className="fill-slate-900 stroke-slate-500" dashed />}
          text="Connection hardware (nozzle, node, port, chamber). Only a dashed ownership line = spare, no flow in the file"
        />
      </LegendSection>
      <LegendSection title="Selection tints (Linked)">
        <LegendRow
          sample={<BoxSample className="fill-amber-500/20 stroke-slate-500" />}
          text="Upstream — flows into the selection"
        />
        <LegendRow
          sample={<BoxSample className="fill-green-500/20 stroke-slate-500" />}
          text="Downstream — the selection flows into it"
        />
        <LegendRow
          sample={<BoxSample className="fill-violet-500/25 stroke-slate-500" />}
          text="Signal / electrical link"
        />
      </LegendSection>
      <LegendSection title="Interactions">
        <div>Click — select and re-root the neighborhood</div>
        <div>Ctrl/Cmd-click — multi-select without re-rooting</div>
        <div>Double-click — zoom the drawing to the object</div>
        <div>Drag / mouse wheel — pan and zoom</div>
        <div>Depth — hops from the selection; Gap — vertical spread</div>
      </LegendSection>
    </div>
  );
}
