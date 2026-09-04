import { Checkbox, ColorSelect, NumberInput, Select } from "@tredespace/ui/widgets";
import { type JSX, useMemo } from "react";
import { setHighlightDimDrawing } from "../../state/highlight/highlight.actions.ts";
import { highlightState } from "../../state/highlight/highlight.state.ts";
import {
  setLabelInspectColor,
  setLabelInspectEnabled,
  setLabelInspectOpacity,
  setLabelInspectPlacement,
} from "../../state/labelInspect/labelInspect.actions.ts";
import { labelInspectState } from "../../state/labelInspect/labelInspect.state.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PLACEMENT_OPTIONS = [
  { value: "front", label: "In front of drawing" },
  { value: "back", label: "Behind drawing" },
];

const OPACITY_STEP_PERCENT = 5;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Draws every profile LabelTemplate where the template's own position,
 * rotation, size and alignment put it — including the placements the viewer
 * normally suppresses because the file carries its own label. Overlaying the
 * two is how you check that a generated DEXPI file placed its labels where
 * the profile prescribes.
 */
export function LabelInspectSection(): JSX.Element {
  const { docRevision } = viewerState.use();
  const { enabled, colorHex, opacityPercent, placement } = labelInspectState.use();
  const { dimDrawing } = highlightState.use();

  const templateCount = useMemo<number>(() => {
    void docRevision;
    return getLoadedDocument()?.scene.labelTemplateNodes.length ?? 0;
  }, [docRevision]);

  if (templateCount === 0) {
    return (
      <div className="text-slate-500 text-xs">
        No profile label templates in this drawing — load a DISC profile, or this file places no profile
        symbols that declare one.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        checked={enabled}
        onChange={setLabelInspectEnabled}
        label="Show label template positions"
        hint={`${templateCount}`}
        tooltip="Draw each profile LabelTemplate at the position, rotation, size and alignment the profile declares"
      />
      <Checkbox
        checked={dimDrawing}
        onChange={setHighlightDimDrawing}
        label="Dim drawing"
        tooltip="Fade the drawing so the overlays stand out. Shared with the other Highlight sections — it sits below every overlay, so it never dims one of them"
      />
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] text-slate-500 uppercase tracking-wide">Color</span>
        <ColorSelect value={colorHex} onChange={setLabelInspectColor} disabled={!enabled} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] text-slate-500 uppercase tracking-wide">Opacity</span>
        <div className="w-24">
          <NumberInput
            value={opacityPercent}
            onChange={setLabelInspectOpacity}
            min={0}
            max={100}
            step={OPACITY_STEP_PERCENT}
            unit="%"
            disabled={!enabled}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] text-slate-500 uppercase tracking-wide">Depth</span>
        <Select
          value={placement}
          options={PLACEMENT_OPTIONS}
          disabled={!enabled}
          onChange={(value) => setLabelInspectPlacement(value === "back" ? "back" : "front")}
        />
      </div>
    </div>
  );
}
