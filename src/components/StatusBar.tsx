import type { JSX } from "react";
import { viewerState } from "../state/viewer/viewer.state.ts";

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function StatusBar(): JSX.Element {
  const { file, objectCount, profileName, zoomPercent, cursor } = viewerState.use();

  return (
    <div className="flex shrink-0 items-center gap-4 border-slate-700 border-t bg-slate-900 px-3 py-0.5 font-mono text-slate-400 text-xs">
      <span>{file ? `${file.name} (${formatBytes(file.sizeBytes)})` : "No file loaded"}</span>
      {file && <span className="tabular-nums">{objectCount} objects</span>}
      {profileName && <span>profile: {profileName}</span>}
      <span className="ml-auto tabular-nums">{zoomPercent.toFixed(0)}%</span>
      <span className="w-40 text-right tabular-nums">
        {cursor ? `${cursor.xMm.toFixed(1)}, ${cursor.yMm.toFixed(1)} mm` : "—"}
      </span>
    </div>
  );
}
