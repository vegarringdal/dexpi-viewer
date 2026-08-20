import { IconChevronDown, IconChevronRight, IconLicense, IconX } from "@tabler/icons-react";
import { Modal, TextInput, TitleBar } from "@tredespace/ui/widgets";
import { type JSX, useEffect, useState } from "react";
import type { NoticeEntry } from "../../lib/generated/thirdPartyNotices.ts";

// -----------------------------------------------------------------------------
// Types & constants
// -----------------------------------------------------------------------------

const DIALOG_Z = 1100;

type NoticesData = Readonly<{
  npmNotices: readonly NoticeEntry[];
  fontNotices: readonly NoticeEntry[];
}>;

// -----------------------------------------------------------------------------
// Rows
// -----------------------------------------------------------------------------

function NoticeRow({ entry }: Readonly<{ entry: NoticeEntry }>): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer items-baseline gap-2 rounded bg-slate-800/60 px-1.5 py-1 text-left hover:bg-slate-700/60"
      >
        <span className="shrink-0 self-center text-slate-500">
          {open ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
        </span>
        <span className="font-semibold text-slate-200 text-xs">{entry.name}</span>
        <span className="font-mono text-[10px] text-slate-500">{entry.version}</span>
        <span className="ml-auto shrink-0 text-[10px] text-emerald-400">{entry.license}</span>
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap border border-slate-800 p-2 font-mono text-[10px] text-slate-400 leading-snug">
          {entry.text}
        </pre>
      )}
    </div>
  );
}

function NoticeGroup({
  title,
  entries,
}: Readonly<{ title: string; entries: readonly NoticeEntry[] }>): JSX.Element | null {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="mb-3">
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="font-semibold text-slate-300 text-xs">{title}</h4>
        <span className="text-slate-500 text-xs">{entries.length}</span>
      </div>
      {entries.map((entry) => (
        <NoticeRow key={`${entry.name}@${entry.version}`} entry={entry} />
      ))}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Dialog
// -----------------------------------------------------------------------------

export function ThirdPartyNoticesDialog({ onClose }: Readonly<{ onClose: () => void }>): JSX.Element {
  const [data, setData] = useState<NoticesData | null>(null);
  const [filter, setFilter] = useState("");

  // The notices module carries every license text — load it only when the
  // dialog actually opens.
  useEffect(() => {
    let cancelled = false;
    void import("../../lib/generated/thirdPartyNotices.ts").then((module) => {
      if (!cancelled) {
        setData(module);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const query = filter.trim().toLowerCase();
  const match = (entries: readonly NoticeEntry[]): readonly NoticeEntry[] =>
    query ? entries.filter((e) => e.name.toLowerCase().includes(query)) : entries;

  return (
    <Modal z={DIALOG_Z} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="flex h-[80vh] w-[min(680px,92vw)] flex-col border border-slate-600 bg-slate-900 shadow-black/50 shadow-xl">
        <TitleBar icon={<IconLicense size={16} className="shrink-0 text-blue-400" />}>
          <span>Third-party notices</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto cursor-pointer text-slate-400 hover:text-slate-200"
          >
            <IconX size={16} />
          </button>
        </TitleBar>
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <TextInput value={filter} onChange={setFilter} placeholder="Filter by name…" />
          <p className="text-slate-500 text-xs">
            This product bundles the open-source components below; each is used under its own license,
            reproduced in full. Development-only tooling is not distributed and is not listed.
          </p>
          <div className="min-h-0 flex-1 overflow-auto">
            {!data && <div className="p-4 text-center text-slate-500 text-xs">Loading…</div>}
            {data && (
              <>
                <NoticeGroup title="npm packages" entries={match(data.npmNotices)} />
                <NoticeGroup title="Fonts" entries={match(data.fontNotices)} />
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
