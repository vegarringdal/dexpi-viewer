import { PanelBody } from "@tredespace/ui/dockable";
import { type JSX, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { type MinimapImage, renderMinimap } from "../../lib/canvas/renderMinimap.ts";
import { themeState } from "../../state/theme/theme.state.ts";
import { getLoadedDocument, requestViewCommand } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MinimapPanel(): JSX.Element {
  const { docRevision, file, viewportRect } = viewerState.use();
  const { theme } = themeState.use();
  const [image, setImage] = useState<MinimapImage | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    void docRevision;
    const scene = getLoadedDocument()?.scene;
    if (!scene) {
      setImage(null);
      return;
    }

    let cancelled = false;
    void renderMinimap(scene, theme).then((next) => {
      if (cancelled || !next) {
        return;
      }

      setImage((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous.url);
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [docRevision, theme]);

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const centerAtEvent = (e: ReactPointerEvent<HTMLImageElement>): void => {
    const el = imgRef.current;
    if (!el || !image) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const displayScale = rect.width / image.widthPx;
    const xImg = (e.clientX - rect.left) / displayScale;
    const yImg = (e.clientY - rect.top) / displayScale;
    requestViewCommand({
      kind: "centerAt",
      xMm: (xImg - image.offsetX) / image.scale,
      yMm: (yImg - image.offsetY) / image.scale,
    });
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLImageElement>): void => {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    centerAtEvent(e);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLImageElement>): void => {
    if (isDraggingRef.current) {
      centerAtEvent(e);
    }
  };

  const handlePointerUp = (): void => {
    isDraggingRef.current = false;
  };

  // ---------------------------------------------------------------------------
  // Derived state & render
  // ---------------------------------------------------------------------------

  if (!file || !image) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        {file ? "Rendering overview…" : "Open a DEXPI file to get started."}
      </PanelBody>
    );
  }

  const overlay = viewportRect
    ? {
        left: `${((image.offsetX + viewportRect.xMm * image.scale) / image.widthPx) * 100}%`,
        top: `${((image.offsetY + viewportRect.yMm * image.scale) / image.heightPx) * 100}%`,
        width: `${((viewportRect.widthMm * image.scale) / image.widthPx) * 100}%`,
        height: `${((viewportRect.heightMm * image.scale) / image.heightPx) * 100}%`,
      }
    : null;

  return (
    <PanelBody className="flex h-full items-start justify-center overflow-hidden p-1">
      <div className="relative max-h-full max-w-full">
        <img
          ref={imgRef}
          src={image.url}
          alt="Drawing overview"
          draggable={false}
          className="max-h-full max-w-full cursor-crosshair select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {overlay && (
          <div
            className="pointer-events-none absolute border border-blue-500 bg-blue-500/10"
            style={overlay}
          />
        )}
      </div>
    </PanelBody>
  );
}
