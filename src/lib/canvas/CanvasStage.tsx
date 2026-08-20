import type { JSX } from "react";
import { useCanvasStage } from "./useCanvasStage.ts";

/**
 * The drawing surface: a single CanvasKit-backed canvas filling its panel.
 * All drawing logic lives in useCanvasStage / drawPlaceholderScene.
 */
export function CanvasStage(): JSX.Element {
  const { containerRef, canvasRef } = useCanvasStage();

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
    </div>
  );
}
