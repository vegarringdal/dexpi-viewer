import { Button, Checkbox, ColorSelect, NumberInput } from "@tredespace/ui/widgets";
import { type ChangeEvent, type JSX, useRef } from "react";
import {
  clearUnderlay,
  loadUnderlayFile,
  setUnderlayHideWhite,
  setUnderlayOffset,
  setUnderlayOpacity,
  setUnderlayPlacement,
  setUnderlayScale,
  setUnderlayTint,
  setUnderlayVisible,
} from "../../../state/underlay/underlay.actions.ts";
import { underlayState } from "../../../state/underlay/underlay.state.ts";
import { setViewerError } from "../../../state/viewer/viewer.actions.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.pdf";
const OFFSET_STEP_MM = 0.1;
const DEFAULT_TINT_HEX = "#e02020";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Verification underlay controls on top of the drawing: load a reference
 * image/SVG/PDF, stretched to the diagram extent by default (the official
 * DISC renderings then align exactly), with opacity, under/over placement
 * and mm-offset/scale nudges for scans that need alignment.
 */
export function UnderlayToolbar(): JSX.Element {
  const state = underlayState.use();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      return;
    }

    const result = await loadUnderlayFile(file);
    if (result.error) {
      setViewerError(result.error.msg);
    }
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-slate-800 border-b px-2 py-1">
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFile} />
      <Button
        onClick={() => inputRef.current?.click()}
        tooltip="Load a reference image, SVG or PDF as an alignment underlay"
      >
        Underlay…
      </Button>
      {state.name !== null && (
        <>
          <span className="max-w-40 truncate font-mono text-[11px] text-slate-400" title={state.name}>
            {state.name}
          </span>
          <Checkbox checked={state.visible} onChange={setUnderlayVisible} label="Show" />
          <Button
            active={state.placement === "over"}
            onClick={() => setUnderlayPlacement(state.placement === "over" ? "under" : "over")}
            tooltip="Draw the underlay on top of the drawing instead of behind it"
          >
            On top
          </Button>
          <span className="text-[10px] text-slate-500">Opacity</span>
          <div className="w-24">
            <NumberInput
              value={state.opacityPercent}
              onChange={setUnderlayOpacity}
              min={0}
              max={100}
              step={5}
              unit="%"
            />
          </div>
          <span className="text-[10px] text-slate-500">X</span>
          <div className="w-24">
            <NumberInput
              value={state.offsetXMm}
              onChange={(v) => setUnderlayOffset(v, state.offsetYMm)}
              step={OFFSET_STEP_MM}
              unit="mm"
            />
          </div>
          <span className="text-[10px] text-slate-500">Y</span>
          <div className="w-24">
            <NumberInput
              value={state.offsetYMm}
              onChange={(v) => setUnderlayOffset(state.offsetXMm, v)}
              step={OFFSET_STEP_MM}
              unit="mm"
            />
          </div>
          <span className="text-[10px] text-slate-500">Scale</span>
          <div className="w-24">
            <NumberInput
              value={state.scalePercent}
              onChange={setUnderlayScale}
              min={1}
              max={1000}
              step={0.5}
              unit="%"
            />
          </div>
          <Checkbox
            checked={state.hideWhite}
            onChange={setUnderlayHideWhite}
            label="Hide white"
            tooltip="Multiply-blend: the underlay's white background disappears, only its ink shows"
          />
          <Checkbox
            checked={state.tintHex !== null}
            onChange={(on) => setUnderlayTint(on ? DEFAULT_TINT_HEX : null)}
            label="Tint"
            tooltip="Recolor the underlay's ink (e.g. red) to tell reference and drawing apart"
          />
          {state.tintHex !== null && (
            <ColorSelect value={state.tintHex} onChange={(color) => setUnderlayTint(color)} />
          )}
          <Button onClick={clearUnderlay} tooltip="Remove the underlay">
            Clear
          </Button>
        </>
      )}
    </div>
  );
}
