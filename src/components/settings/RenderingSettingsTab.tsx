import { Button, Checkbox, NumberInput } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import {
  resetRenderingSettings,
  setMinStrokePx,
  setSelectionTextRect,
  setShowGrid,
  setStrokeWidthScale,
  setUnitDisplay,
} from "../../state/rendering/rendering.actions.ts";
import { renderingState } from "../../state/rendering/rendering.state.ts";

// -----------------------------------------------------------------------------
// Row helper
// -----------------------------------------------------------------------------

type SettingRowProps = Readonly<{
  label: string;
  hint: string;
  children: React.ReactNode;
}>;

function SettingRow({ label, hint, children }: SettingRowProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="w-44 shrink-0">
        <div className="text-slate-200 text-xs">{label}</div>
        <div className="text-slate-500 text-xs">{hint}</div>
      </div>
      <div className="w-36">{children}</div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function RenderingSettingsTab(): JSX.Element {
  const { minStrokePx, strokeWidthScale, showGrid, unitDisplay, selectionTextRect } = renderingState.use();

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <SettingRow label="Minimum line width" hint="Screen px floor at any zoom">
        <NumberInput value={minStrokePx} onChange={setMinStrokePx} min={0.25} max={5} step={0.25} unit="px" />
      </SettingRow>
      <SettingRow label="Line width scale" hint="Multiplier on authored widths">
        <NumberInput
          value={strokeWidthScale}
          onChange={setStrokeWidthScale}
          min={0.1}
          max={5}
          step={0.1}
          unit="×"
        />
      </SettingRow>
      <Checkbox checked={showGrid} onChange={setShowGrid} label="Show grid" hint="10 mm spacing" />
      <Checkbox
        checked={selectionTextRect}
        onChange={setSelectionTextRect}
        label="Backdrop behind selected text"
        hint="Yellow rect under text"
        info="The selection halo re-strokes the selected geometry in thick yellow; text cannot be emboldened legibly, so it gets a filled yellow rect instead. Turn off to leave selected text unmarked."
      />
      <Checkbox
        checked={unitDisplay === "name"}
        onChange={(on) => setUnitDisplay(on ? "name" : "symbol")}
        label="Spec unit names"
        hint="Kilowatt instead of kW"
        info="Show units as the DEXPI specification's enumeration literals (Kilowatt, DegreeCelsius) instead of conventional symbols (kW, °C). Applies to the Properties panel only — drawing labels always use symbols. The document re-parses on change."
      />
      <div>
        <Button onClick={() => resetRenderingSettings()}>Reset to defaults</Button>
      </div>
    </div>
  );
}
