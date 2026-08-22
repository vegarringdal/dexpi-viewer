import type { JSX } from "react";
import { CanvasStage } from "../../../lib/canvas/CanvasStage.tsx";
import { UnderlayToolbar } from "./UnderlayToolbar.tsx";

/** The drawing surface with the verification-underlay toolbar on top. */
export function DrawingPanel(): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <UnderlayToolbar />
      <div className="min-h-0 flex-1">
        <CanvasStage />
      </div>
    </div>
  );
}
