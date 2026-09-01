import { type HotkeyDef, hotkeysActions } from "@tredespace/ui/hotkeys";
import type { Result } from "../lib/result.ts";
import { setHighlightMonochrome } from "../state/highlight/highlight.actions.ts";
import { highlightState } from "../state/highlight/highlight.state.ts";
import { toggleTheme } from "../state/theme/theme.actions.ts";
import { resetDockLayout, toggleDockPanel } from "../state/ui/ui.actions.ts";
import {
  openBundledProfile,
  openExampleDocument,
  requestViewCommand,
  setViewerError,
} from "../state/viewer/viewer.actions.ts";
import { exportIssuesCsv, exportPdf, exportSvg } from "./exportService.ts";
import { PANEL_IDS } from "./panelIds.ts";
import { openDocs } from "./ribbon/HelpSection.tsx";

const ZOOM_STEP_FACTOR = 1.5;

// -----------------------------------------------------------------------------
// Open-file trigger
// -----------------------------------------------------------------------------

/**
 * The file picker lives inside RibbonBar (it owns the hidden <input>); the
 * hotkey reaches it through this registration point.
 */
let openFileTrigger: (() => void) | null = null;

export function setOpenFileTrigger(trigger: (() => void) | null): void {
  openFileTrigger = trigger;
}

function reportError(result: Result<void>): void {
  if (result.error) {
    setViewerError(result.error.msg);
  }
}

// -----------------------------------------------------------------------------
// Registration
// -----------------------------------------------------------------------------

/**
 * Default keymap (every binding rebindable in Settings → Shortcuts):
 * plain letters/digits for app actions (they can never collide with browser
 * chords), leader sequences for grouped ones — E then P/S/C exports,
 * Z then I/O zooms — and Ctrl-combos only for the file-open family.
 */
const APP_HOTKEYS: HotkeyDef[] = [
  {
    id: "file.open",
    category: "File",
    label: "Open file",
    description: "Open a DEXPI 2.0 XML file.",
    defaultKeys: "CTRL&O",
    run: () => openFileTrigger?.(),
  },
  {
    id: "file.example",
    category: "File",
    label: "Load example",
    description: "Load the bundled DISC example P&ID.",
    defaultKeys: "CTRL&SHIFT&O",
    run: () => {
      void openExampleDocument();
    },
  },
  {
    id: "file.profile063",
    category: "File",
    label: "Use 0.6.3 profile",
    description: "Load the bundled official DISC Profile 0.6.3 catalogue.",
    defaultKeys: "CTRL&SHIFT&L",
    run: () => {
      void openBundledProfile();
    },
  },
  {
    id: "view.fit",
    category: "View",
    label: "Fit drawing",
    description: "Fit the whole drawing into the viewport.",
    defaultKeys: "F",
    run: () => requestViewCommand({ kind: "fit" }),
  },
  {
    id: "view.zoomIn",
    category: "View",
    label: "Zoom in",
    description: "Zoom in around the viewport center.",
    defaultKeys: "Z + I",
    run: () => requestViewCommand({ kind: "zoom", factor: ZOOM_STEP_FACTOR }),
  },
  {
    id: "view.zoomOut",
    category: "View",
    label: "Zoom out",
    description: "Zoom out around the viewport center.",
    defaultKeys: "Z + O",
    run: () => requestViewCommand({ kind: "zoom", factor: 1 / ZOOM_STEP_FACTOR }),
  },
  {
    id: "view.zoom100",
    category: "View",
    label: "Zoom 100%",
    description: "Reset the zoom to 100% (1 mm per 1/96 inch).",
    defaultKeys: "0",
    run: () => requestViewCommand({ kind: "zoom100" }),
  },
  {
    id: "view.theme",
    category: "View",
    label: "Toggle theme",
    description: "Switch between the light and dark theme.",
    defaultKeys: "D",
    run: () => toggleTheme(),
  },
  {
    id: "view.monochrome",
    category: "View",
    label: "Black & white drawing",
    description: "Toggle the monochrome drawing mode (highlight colors stand alone).",
    defaultKeys: "B",
    run: () => setHighlightMonochrome(!highlightState.get().monochrome),
  },
  {
    id: "export.pdf",
    category: "Export",
    label: "Export PDF",
    description: "Export the drawing as a vector PDF.",
    defaultKeys: "E + P",
    run: () => {
      void exportPdf().then(reportError);
    },
  },
  {
    id: "export.svg",
    category: "Export",
    label: "Export SVG",
    description: "Export the drawing as a standalone SVG.",
    defaultKeys: "E + S",
    run: () => reportError(exportSvg()),
  },
  {
    id: "export.report",
    category: "Export",
    label: "Export validation report",
    description: "Export the validation findings as CSV.",
    defaultKeys: "E + C",
    run: () => reportError(exportIssuesCsv()),
  },
  {
    id: "panel.explorer",
    category: "Panels",
    label: "Explorer",
    description: "Toggle the object explorer tree.",
    defaultKeys: "1",
    run: () => toggleDockPanel(PANEL_IDS.topology),
  },
  {
    id: "panel.conceptualModelTree",
    category: "Panels",
    label: "Conceptual Model Tree",
    description: "Toggle the raw ConceptualModel XML tree panel.",
    defaultKeys: "T + C",
    run: () => toggleDockPanel(PANEL_IDS.conceptualModelTree),
  },
  {
    id: "panel.diagramTree",
    category: "Panels",
    label: "Diagram Tree",
    description: "Toggle the raw Diagram XML tree panel.",
    defaultKeys: "T + D",
    run: () => toggleDockPanel(PANEL_IDS.diagramTree),
  },
  {
    id: "panel.properties",
    category: "Panels",
    label: "Properties",
    description: "Toggle the properties panel.",
    defaultKeys: "2",
    run: () => toggleDockPanel(PANEL_IDS.properties),
  },
  {
    id: "panel.validation",
    category: "Panels",
    label: "Validation",
    description: "Toggle the validation findings panel.",
    defaultKeys: "3",
    run: () => toggleDockPanel(PANEL_IDS.issues),
  },
  {
    id: "panel.connections",
    category: "Panels",
    label: "Connections",
    description: "Toggle the upstream/downstream connections panel.",
    defaultKeys: "4",
    run: () => toggleDockPanel(PANEL_IDS.connections),
  },
  {
    id: "app.highlight",
    category: "Panels",
    label: "Highlight",
    description: "Toggle the classification highlight panel.",
    defaultKeys: "5",
    run: () => toggleDockPanel(PANEL_IDS.highlight),
  },
  {
    id: "app.topologyGraph",
    category: "Panels",
    label: "Topology graph",
    description: "Toggle the semantic topology graph panel.",
    defaultKeys: "6",
    run: () => toggleDockPanel(PANEL_IDS.topologyGraph),
  },
  {
    id: "panel.inspect",
    category: "Panels",
    label: "Inspect",
    description: "Toggle the UML-style instance diagram panel.",
    defaultKeys: "7",
    run: () => toggleDockPanel(PANEL_IDS.inspect),
  },
  {
    id: "panel.minimap",
    category: "Panels",
    label: "Minimap",
    description: "Toggle the minimap panel.",
    defaultKeys: "8",
    run: () => toggleDockPanel(PANEL_IDS.minimap),
  },
  {
    id: "app.settings",
    category: "Panels",
    label: "Settings",
    description: "Toggle the Settings panel.",
    defaultKeys: "9",
    run: () => toggleDockPanel(PANEL_IDS.settings),
  },
  {
    id: "panel.resetLayout",
    category: "Panels",
    label: "Reset layout",
    description: "Restore the default panel layout.",
    defaultKeys: "CTRL&ALT&R",
    run: () => resetDockLayout(),
  },
  {
    id: "help.docs",
    category: "Help",
    label: "Open documentation",
    description: "Open the user manual in a new tab.",
    defaultKeys: "F1",
    run: () => openDocs(),
  },
];

/** The binding table, exposed for the boot-time validation test. */
export function appHotkeyDefs(): readonly HotkeyDef[] {
  return APP_HOTKEYS;
}

/** Call once at boot — also starts the key engine. */
export function registerAppHotkeys(): void {
  hotkeysActions.register(APP_HOTKEYS);
}
