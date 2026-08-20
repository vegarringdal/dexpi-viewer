import { IconLicense, IconX } from "@tabler/icons-react";
import { Modal, TitleBar } from "@tredespace/ui/widgets";
import { type JSX, useEffect, useState } from "react";

const DIALOG_Z = 1100;

/** Shows the project's LICENSE file (lazy-loaded — the AGPL is long). */
export function LicenseDialog({ onClose }: Readonly<{ onClose: () => void }>): JSX.Element {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("../../../LICENSE?raw").then((module) => {
      if (!cancelled) {
        setText(module.default);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Modal z={DIALOG_Z} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="flex h-[80vh] w-[min(680px,92vw)] flex-col border border-slate-600 bg-slate-900 shadow-black/50 shadow-xl">
        <TitleBar icon={<IconLicense size={16} className="shrink-0 text-blue-400" />}>
          <span>License — AGPL-3.0-only</span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="ml-auto cursor-pointer text-slate-400 hover:text-slate-200"
          >
            <IconX size={16} />
          </button>
        </TitleBar>
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {text === null ? (
            <div className="p-4 text-center text-slate-500 text-xs">Loading…</div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-[10px] text-slate-400 leading-snug">
              {text}
            </pre>
          )}
        </div>
      </div>
    </Modal>
  );
}
