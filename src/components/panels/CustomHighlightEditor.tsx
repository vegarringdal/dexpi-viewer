import { IconDownload, IconPlus, IconUpload } from "@tabler/icons-react";
import { Button } from "@tredespace/ui/widgets";
import { type JSX, useMemo, useRef, useState } from "react";
import { countCustomFilterOverlaps, matchCustomFilters } from "../../lib/dexpi/customHighlightFilter.ts";
import { downloadBlob } from "../../lib/download.ts";
import {
  addCustomFilter,
  exportCustomFilters,
  importCustomFilters,
} from "../../state/highlight/highlight.actions.ts";
import { highlightState } from "../../state/highlight/highlight.state.ts";
import { getLoadedDocument } from "../../state/viewer/viewer.actions.ts";
import { viewerState } from "../../state/viewer/viewer.state.ts";
import { CustomHighlightFilterRow } from "./CustomHighlightFilterRow.tsx";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const CUSTOM_FILTERS_FILE_NAME = "dexpi-highlight-filters.json";

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Editor for user-defined highlight filters: match objects by type or
 * attribute (simple AND-list, or an advanced &/| expression), each with its
 * own color. List order is priority — where an object matches more than one
 * filter, the lower filter's color wins, so the warning banner surfaces
 * overlaps before they become a silent surprise.
 */
export function CustomHighlightEditor(): JSX.Element {
  const { docRevision } = viewerState.use();
  const { customFilters } = highlightState.use();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const matches = useMemo(() => {
    void docRevision;
    const doc = getLoadedDocument();
    return doc ? matchCustomFilters(doc.plant.byId.values(), customFilters) : [];
  }, [docRevision, customFilters]);

  const overlapCount = useMemo(() => countCustomFilterOverlaps(matches), [matches]);
  const matchCountFor = (id: string): number => matches.find((m) => m.filterId === id)?.objectIds.length ?? 0;
  const matchErrorFor = (id: string): string | undefined => matches.find((m) => m.filterId === id)?.error;

  const handleImportFile = async (file: File): Promise<void> => {
    const result = importCustomFilters(await file.text());
    if (result.error) {
      setImportMsg(result.error.msg);
      return;
    }

    setImportMsg(`Loaded ${result.data} filter${result.data === 1 ? "" : "s"}.`);
  };

  const handleExport = (): void => {
    downloadBlob(exportCustomFilters(), CUSTOM_FILTERS_FILE_NAME, "application/json");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">Custom filters</span>
        <Button icon={<IconPlus />} iconOnly onClick={addCustomFilter} tooltip="Add a filter" />
      </div>
      {customFilters.length === 0 && (
        <div className="text-slate-500 text-xs">No custom filters yet — add one to start highlighting.</div>
      )}
      {customFilters.map((filter, index) => (
        <CustomHighlightFilterRow
          key={filter.id}
          filter={filter}
          matchCount={matchCountFor(filter.id)}
          matchError={matchErrorFor(filter.id)}
          isFirst={index === 0}
          isLast={index === customFilters.length - 1}
        />
      ))}
      {overlapCount > 0 && (
        <div className="rounded border border-amber-700 bg-amber-950/40 p-2 text-amber-400 text-xs">
          {overlapCount} object{overlapCount === 1 ? "" : "s"} matched by more than one filter — the lower
          filter in the list wins.
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button icon={<IconDownload />} onClick={handleExport} tooltip="Save filters as JSON">
          Save
        </Button>
        <Button
          icon={<IconUpload />}
          onClick={() => importInputRef.current?.click()}
          tooltip="Load filters from JSON"
        >
          Load
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) {
              void handleImportFile(file);
            }
          }}
        />
      </div>
      {importMsg && <p className="text-slate-400 text-xs">{importMsg}</p>}
    </div>
  );
}
