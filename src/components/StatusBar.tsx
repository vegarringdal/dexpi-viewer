import type { JSX } from "react";
import { activeProfileLabel, activeProfileVersion, profileState } from "../state/profile/profile.state.ts";
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
  const { file, objectCount, zoomPercent, cursor } = viewerState.use();
  const { active, declaredVersion } = profileState.use();

  const profileName = activeProfileLabel(active);
  const activeVersion = activeProfileVersion(active);
  const isProfileMismatch =
    activeVersion !== null && declaredVersion !== null && activeVersion !== declaredVersion;

  return (
    <div className="flex shrink-0 items-center gap-4 border-slate-700 border-t bg-slate-900 px-3 py-0.5 font-mono text-slate-400 text-xs">
      <span>{file ? `${file.name} (${formatBytes(file.sizeBytes)})` : "No file loaded"}</span>
      {file && <span className="tabular-nums">{objectCount} objects</span>}
      {profileName && (
        <span
          className={isProfileMismatch ? "text-amber-400" : undefined}
          title={
            isProfileMismatch ? `This document declares DiscProfile ${declaredVersion ?? ""}` : undefined
          }
        >
          profile: {profileName}
        </span>
      )}
      <span className="ml-auto tabular-nums">{zoomPercent.toFixed(0)}%</span>
      <span className="w-40 text-right tabular-nums">
        {cursor ? `${cursor.xMm.toFixed(1)}, ${cursor.yMm.toFixed(1)} mm` : "—"}
      </span>
    </div>
  );
}
