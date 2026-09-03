import { PanelBody } from "@tredespace/ui/dockable";
import { Checkbox, Select, type SelectOption } from "@tredespace/ui/widgets";
import { type JSX, useMemo } from "react";
import { classifyColor, getScenePalette } from "../../lib/canvas/scenePalette.ts";
import { buildClassificationGroups, type HighlightMode } from "../../lib/dexpi/classification.ts";
import {
  setHighlightDimOthers,
  setHighlightMode,
  setHighlightMonochrome,
  toggleHighlightGroup,
} from "../../state/highlight/highlight.actions.ts";
import { highlightState } from "../../state/highlight/highlight.state.ts";
import { themeState } from "../../state/theme/theme.state.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { CustomHighlightEditor } from "./CustomHighlightEditor.tsx";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

type FixedHighlightMode = Exclude<HighlightMode, "off" | "custom">;

const MODE_LABELS: Readonly<Record<FixedHighlightMode, string>> = {
  heatTrace: "Heat traced",
  signal: "Signal & instrument lines",
  fluidCode: "Fluid code",
  pipingClass: "Piping class",
};

const SELECTABLE_MODES = Object.keys(MODE_LABELS).filter(isFixedHighlightMode);

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

function isFixedHighlightMode(value: string | null): value is FixedHighlightMode {
  return value !== null && value in MODE_LABELS;
}

function isHighlightMode(value: string | null): value is HighlightMode {
  return value === "off" || value === "custom" || isFixedHighlightMode(value);
}

function cssColor(color: readonly [number, number, number, number]): string {
  const [r, g, b, a] = color;
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Classification highlighting for the drawing: pick a classification and the
 * canvas tints every matching object; the legend lists each value with its
 * canvas color and a visibility toggle. Counts come from the loaded document
 * so data-less modes read as honestly empty instead of silently doing nothing.
 */
export function HighlightPanel(): JSX.Element {
  const { file, docRevision } = viewerState.use();
  const { mode, groups, hiddenKeys, monochrome, dimOthers, customFilters } = highlightState.use();
  const { theme } = themeState.use();
  const palette = getScenePalette(theme);

  const modeCounts = useMemo<ReadonlyMap<HighlightMode, number>>(() => {
    void docRevision;
    const doc = getLoadedDocument();
    const counts = new Map<HighlightMode, number>();
    for (const m of SELECTABLE_MODES) {
      const total = doc
        ? buildClassificationGroups(doc, m).reduce((sum, g) => sum + g.objectIds.length, 0)
        : 0;
      counts.set(m, total);
    }
    return counts;
  }, [docRevision]);

  if (!file) {
    return (
      <PanelBody className="flex h-full items-center justify-center p-4 text-center text-slate-500 text-xs">
        Open a DEXPI file to get started.
      </PanelBody>
    );
  }

  const options: SelectOption[] = [
    { value: "off", label: "Off" },
    ...SELECTABLE_MODES.map((m) => {
      const count = modeCounts.get(m) ?? 0;
      return {
        value: m,
        label: MODE_LABELS[m],
        hint: `${count}`,
        disabled: count === 0,
      };
    }),
    { value: "custom", label: "Custom", hint: `${customFilters.filter((f) => f.enabled).length}` },
  ];

  return (
    <PanelBody className="flex h-full flex-col gap-3 overflow-auto p-3">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Highlight by</span>
        <Select
          value={mode}
          options={options}
          onChange={(value) => setHighlightMode(isHighlightMode(value) ? value : "off")}
        />
      </div>
      <Checkbox
        checked={monochrome}
        onChange={setHighlightMonochrome}
        label="Black & white drawing"
        tooltip="Render all content in ink only, so highlight tints never mix with the file's own colors (also on the ribbon: View → B/W)"
      />
      <Checkbox
        checked={dimOthers}
        onChange={setHighlightDimOthers}
        label="Dim others"
        disabled={mode === "off"}
        tooltip="Fade everything outside the highlighted groups so the tints stand out"
      />
      {mode === "custom" && <CustomHighlightEditor />}
      {mode !== "off" && mode !== "custom" && groups.length === 0 && (
        <div className="text-slate-500 text-xs">No {MODE_LABELS[mode]} data in this document.</div>
      )}
      {groups.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Values</span>
          {groups.map((group, index) => (
            <div key={group.key} className={hiddenKeys.includes(group.key) ? "opacity-50" : ""}>
              <Checkbox
                checked={!hiddenKeys.includes(group.key)}
                onChange={() => toggleHighlightGroup(group.key)}
                label={
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cssColor(classifyColor(palette, index)) }}
                    />
                    {group.label}
                  </span>
                }
                hint={`${group.objectIds.length}`}
                tooltip="Show/hide this value's tint on the drawing"
              />
            </div>
          ))}
        </div>
      )}
    </PanelBody>
  );
}
