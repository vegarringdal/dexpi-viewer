import {
  formatSequence,
  type HotkeyDef,
  hotkeysActions,
  hotkeysState,
  recordSequence,
} from "@tredespace/ui/hotkeys";
import { Button } from "@tredespace/ui/widgets";
import { type JSX, useState } from "react";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type RecordUiState =
  | Readonly<{ step: "idle" }>
  | Readonly<{ step: "recording"; id: string }>
  | Readonly<{ step: "conflict"; id: string; msg: string }>;

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
        Defaults are placeholders (ALT then a 4-digit number). Click Record, press the new keys, then pause or
        hit Enter to commit — Escape cancels.
      </p>
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
