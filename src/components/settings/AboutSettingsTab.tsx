import { IconLicense } from "@tabler/icons-react";
import { Button } from "@tredespace/ui/widgets";
import { type JSX, useState } from "react";
import { LicenseDialog } from "./LicenseDialog.tsx";
import { ThirdPartyNoticesDialog } from "./ThirdPartyNoticesDialog.tsx";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SOURCE_URL = "https://github.com/vegarringdal/dexpi-viewer";

const REFERENCES = [
  { label: "DEXPI specifications", url: "https://dexpi.org/specifications/" },
  { label: "DEXPI specification sources (GitLab)", url: "https://gitlab.com/dexpi/Specification" },
  {
    label: "DEXPIViewer by Tonia Pedersen (prior art)",
    url: "https://github.com/ToniaPedersen/DEXPIViewer",
  },
  {
    label: "DISCDEXPI — DISC Profile spec & examples",
    url: "https://github.com/ToniaPedersen/DISCDEXPI",
  },
  {
    label: "DISCDEXPI 2026 Pack — Profile 0.6, validation method, blueprints",
    url: "https://github.com/ToniaPedersen/DISCDEXPI_2026Pack",
  },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AboutSettingsTab(): JSX.Element {
  const [showNotices, setShowNotices] = useState(false);
  const [showLicense, setShowLicense] = useState(false);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4">
      <div>
        <h3 className="font-semibold text-slate-200 text-sm">DEXPI Viewer</h3>
        <div className="text-slate-400 text-xs">Made by Vegar Ringdal</div>
        <div className="text-slate-500 text-xs">Version {__APP_VERSION__}</div>
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 text-xs hover:underline"
        >
          Source code on GitHub
        </a>
      </div>

      <p className="text-slate-400 text-xs leading-relaxed">
        A viewer for DEXPI 2.0 P&amp;ID files — just having fun with AI and coding. Rendering is Skia
        CanvasKit; everything runs locally in your browser, files never leave your machine.
      </p>

      <p className="text-slate-400 text-xs leading-relaxed">
        I have limited access to real DEXPI files, so there may be bugs I don&apos;t know about. The app is
        provided &quot;as is&quot;, without warranty of any kind — use at your own risk and always verify
        against the source documents.
      </p>

      <p className="text-slate-400 text-xs leading-relaxed">
        The UI is also me trying out{" "}
        <a
          href="https://tredespace.com/docs/widgets"
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline"
        >
          tredespaceUI
        </a>
        , the component library I created for a 3D app in my spare time.
      </p>

      <div>
        <h4 className="mb-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wide">References</h4>
        <ul className="flex flex-col gap-0.5 text-xs">
          {REFERENCES.map((ref) => (
            <li key={ref.url}>
              <a href={ref.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                {ref.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wide">License</h4>
        <p className="text-slate-500 text-xs">
          AGPL-3.0-only. Modified versions — including ones run as a network service — must make their source
          available under the same license.
        </p>
      </div>

      <div className="flex flex-col items-start gap-1">
        <Button icon={<IconLicense />} onClick={() => setShowLicense(true)}>
          Show license
        </Button>
        <Button icon={<IconLicense />} onClick={() => setShowNotices(true)}>
          Show third-party notices
        </Button>
      </div>

      {showLicense && <LicenseDialog onClose={() => setShowLicense(false)} />}
      {showNotices && <ThirdPartyNoticesDialog onClose={() => setShowNotices(false)} />}
    </div>
  );
}
