import {
  formatSequence,
  type HotkeyDef,
  hotkeysActions,
  hotkeysState,
  recordSequence,
} from "@tredespace/ui/hotkeys";
import { Button } from "@tredespace/ui/widgets";
import { type JSX, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type RecordUiState =
  | Readonly<{ step: "idle" }>
  | Readonly<{ step: "recording"; id: string }>
  | Readonly<{ step: "conflict"; id: string; msg: string }>;

type ImportReport = Readonly<{ applied: string[]; skipped: string[]; conflicts: string[] }>;

// -----------------------------------------------------------------------------
// Keymap file I/O
// -----------------------------------------------------------------------------

const KEYMAP_FILE_NAME = "dexpi-keymap.json";

function downloadKeymap(): void {
  const blob = new Blob([hotkeysActions.exportJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = KEYMAP_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function describeImport(defs: Record<string, HotkeyDef>, report: ImportReport): string {
  const names = (ids: string[]): string => ids.map((id) => defs[id]?.label ?? id).join(", ");
  const parts = [`Applied ${report.applied.length} binding${report.applied.length === 1 ? "" : "s"}.`];
  if (report.skipped.length > 0) {
    parts.push(`Skipped (unknown or unparseable): ${names(report.skipped)}.`);
  }
  if (report.conflicts.length > 0) {
    parts.push(`Skipped (conflicting keys): ${names(report.conflicts)}.`);
  }
  return parts.join(" ");
}

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------

type ShortcutRowProps = Readonly<{
  def: HotkeyDef;
  recordState: RecordUiState;
  onRecord: (id: string) => void;
}>;

function ShortcutRow({ def, recordState, onRecord }: ShortcutRowProps): JSX.Element {
  const sequence = hotkeysActions.sequenceFor(def.id);
  const isRecording = recordState.step === "recording" && recordState.id === def.id;
  const conflictMsg = recordState.step === "conflict" && recordState.id === def.id ? recordState.msg : null;

  return (
    <div className="border-slate-800 border-b py-1.5">
      <div className="truncate text-slate-200 text-xs" title={def.description}>
        {def.label}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <code className="whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-300 text-xs">
          {isRecording ? "press keys…" : sequence ? formatSequence(sequence) : "—"}
        </code>
        <Button onClick={() => onRecord(def.id)} active={isRecording} tooltip="Record a new key sequence">
          Record
        </Button>
        <Button
          onClick={() => hotkeysActions.resetOne(def.id)}
          disabled={!hotkeysActions.isCustom(def.id)}
          tooltip="Back to the default binding"
        >
          Reset
        </Button>
      </div>
      {conflictMsg && <div className="mt-1 text-red-400 text-xs">{conflictMsg}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tab
// -----------------------------------------------------------------------------

export function ShortcutsSettingsTab(): JSX.Element {
  const { defs, order } = hotkeysState.use();
  const [recordState, setRecordState] = useState<RecordUiState>({ step: "idle" });
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportFile = async (file: File): Promise<void> => {
    try {
      const report = hotkeysActions.importJson(await file.text());
      setImportMsg(describeImport(defs, report));
    } catch {
      setImportMsg("Import failed — not a readable keymap file.");
    }
  };

  const categories = new Map<string, HotkeyDef[]>();
  for (const id of order) {
    const def = defs[id];
    if (!def) {
      continue;
    }

    const group = categories.get(def.category) ?? [];
    group.push(def);
    categories.set(def.category, group);
  }

  const handleRecord = async (id: string): Promise<void> => {
    setRecordState({ step: "recording", id });
    try {
      const sequence = await recordSequence();
      const conflicts = hotkeysActions.conflictsFor(sequence, id);
      if (conflicts.length > 0) {
        const names = conflicts.map((c) => defs[c]?.label ?? c).join(", ");
        setRecordState({ step: "conflict", id, msg: `Already used by: ${names}` });
        return;
      }

      hotkeysActions.setOverride(id, sequence);
      setRecordState({ step: "idle" });
    } catch {
      setRecordState({ step: "idle" });
    }
  };

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      <p className="text-slate-500 text-xs">
        Click Record, press the new keys, then pause or hit Enter to commit — Escape cancels. Sequences like{" "}
        <code>E + P</code> mean E, then P. Export saves your overrides as a portable JSON keymap; Import
        applies one (unknown ids and conflicting keys are skipped).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={downloadKeymap} tooltip="Download your overrides as dexpi-keymap.json">
          Export keymap
        </Button>
        <Button onClick={() => importInputRef.current?.click()} tooltip="Apply a saved keymap file">
          Import keymap
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
      {[...categories.entries()].map(([category, group]) => (
        <section key={category}>
          <h3 className="mb-1 font-semibold text-slate-400 text-xs uppercase tracking-wide">{category}</h3>
          {group.map((def) => (
            <ShortcutRow
              key={def.id}
              def={def}
              recordState={recordState}
              onRecord={(id) => {
                void handleRecord(id);
              }}
            />
          ))}
        </section>
      ))}
      <div>
        <Button onClick={() => hotkeysActions.resetAll()}>Reset all to defaults</Button>
      </div>
    </div>
  );
}
