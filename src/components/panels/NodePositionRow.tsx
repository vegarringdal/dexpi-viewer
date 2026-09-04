import { Checkbox, ColorSelect, NumberInput } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import type { NodePositionKindRow } from "../../lib/dexpi/nodePositionKinds.ts";
import {
  NODE_MARKER_SCALE_MAX,
  NODE_MARKER_SCALE_MIN,
  NODE_MARKER_SCALE_STEP,
  NODE_MARKER_WIDTH_MAX,
  NODE_MARKER_WIDTH_MIN,
  NODE_MARKER_WIDTH_STEP,
  updateNodePositionKind,
} from "../../state/nodePositions/nodePositions.actions.ts";
import type { NodePositionKindSettings } from "../../state/nodePositions/nodePositions.state.ts";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SOURCE_LABELS: Readonly<Record<NodePositionKindRow["source"], string>> = {
  file: "File",
  profile: "Profile",
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * One node-position kind: on/off, its marker glyph (circle for the file's own
 * node positions, triangle for the profile's declared attachment points),
 * color, size scale and outline width.
 */
type NodePositionRowProps = Readonly<{
  row: NodePositionKindRow;
  settings: NodePositionKindSettings;
}>;

export function NodePositionRow({ row, settings }: NodePositionRowProps): JSX.Element {
  const { source, kind, count } = row;

  return (
    <div className={`flex items-center gap-2 ${settings.enabled ? "" : "opacity-50"}`}>
      <Checkbox
        checked={settings.enabled}
        onChange={(enabled) => updateNodePositionKind(source, kind, { enabled })}
        label={
          <span className="inline-flex items-center gap-2">
            <span className="w-4 shrink-0 text-center" style={{ color: settings.colorHex }}>
              {source === "file" ? "○" : "△"}
            </span>
            <span className="truncate">
              {SOURCE_LABELS[source]} {kind}
            </span>
          </span>
        }
        hint={`${count}`}
        tooltip={
          source === "file"
            ? "Node positions declared by the DEXPI file itself — drawn as hollow circles"
            : "Attachment points the profile symbol declares, placed by each usage's transform — drawn as hollow triangles inscribed in the same circle, so a coinciding pair stays readable"
        }
        className="min-w-0 flex-1"
      />
      <ColorSelect
        value={settings.colorHex}
        onChange={(colorHex) => updateNodePositionKind(source, kind, { colorHex })}
      />
      <div className="w-20 shrink-0" data-tooltip="Marker size">
        <NumberInput
          value={settings.scale}
          onChange={(scale) => updateNodePositionKind(source, kind, { scale })}
          min={NODE_MARKER_SCALE_MIN}
          max={NODE_MARKER_SCALE_MAX}
          step={NODE_MARKER_SCALE_STEP}
          unit="×"
        />
      </div>
      <div className="w-24 shrink-0" data-tooltip="Outline width">
        <NumberInput
          value={settings.widthMm}
          onChange={(widthMm) => updateNodePositionKind(source, kind, { widthMm })}
          min={NODE_MARKER_WIDTH_MIN}
          max={NODE_MARKER_WIDTH_MAX}
          step={NODE_MARKER_WIDTH_STEP}
          unit="mm"
        />
      </div>
    </div>
  );
}
