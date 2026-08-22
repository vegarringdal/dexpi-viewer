import { type HotkeyDef, hotkeysActions } from "@tredespace/ui/hotkeys";
import { toggleTheme } from "../state/theme/theme.actions.ts";
import { openHighlightPanel, openSettings, openTopologyGraphPanel } from "../state/ui/ui.actions.ts";
import {
  openBundledProfile,
  openExampleDocument,
  requestViewCommand,
} from "../state/viewer/viewer.actions.ts";

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

// -----------------------------------------------------------------------------
// Registration
// -----------------------------------------------------------------------------

/**
 * Placeholder default bindings: every ribbon action is ALT then a 4-digit
 * number (rebindable in Settings → Shortcuts). First digit = ribbon section
 * (1 File, 2 View, 9 App), the rest is the ordinal within the section.
 */
const APP_HOTKEYS: HotkeyDef[] = [
  {
    id: "file.open",
    category: "File",
    label: "Open file",
    description: "Open a DEXPI 2.0 XML file.",
    defaultKeys: "ALT + 1001",
    run: () => openFileTrigger?.(),
  },
  {
    id: "file.example",
    category: "File",
    label: "Load example",
    description: "Load the bundled DISC example P&ID.",
    defaultKeys: "ALT + 1002",
    run: () => {
      void openExampleDocument();
    },
  },
  {
    id: "file.profile063",
    category: "File",
    label: "Use 0.6.3 profile",
    description: "Load the bundled official DISC Profile 0.6.3 catalogue.",
    defaultKeys: "ALT + 1003",
    run: () => {
      void openBundledProfile();
    },
  },
  {
    id: "view.theme",
    category: "View",
    label: "Toggle theme",
    description: "Switch between the light and dark theme.",
    defaultKeys: "ALT + 2001",
    run: () => toggleTheme(),
  },
  {
    id: "view.fit",
    category: "View",
    label: "Fit drawing",
    description: "Fit the whole drawing into the viewport.",
    defaultKeys: "ALT + 2002",
    run: () => requestViewCommand({ kind: "fit" }),
  },
  {
    id: "view.zoomIn",
    category: "View",
    label: "Zoom in",
    description: "Zoom in around the viewport center.",
    defaultKeys: "ALT + 2003",
    run: () => requestViewCommand({ kind: "zoom", factor: ZOOM_STEP_FACTOR }),
  },
  {
    id: "view.zoomOut",
    category: "View",
    label: "Zoom out",
    description: "Zoom out around the viewport center.",
    defaultKeys: "ALT + 2004",
    run: () => requestViewCommand({ kind: "zoom", factor: 1 / ZOOM_STEP_FACTOR }),
  },
  {
    id: "view.zoom100",
    category: "View",
    label: "Zoom 100%",
    description: "Reset the zoom to 100% (1 mm per 1/96 inch).",
    defaultKeys: "ALT + 2005",
    run: () => requestViewCommand({ kind: "zoom100" }),
  },
  {
    id: "app.settings",
    category: "Panels",
    label: "Settings",
    description: "Open the Settings panel.",
    defaultKeys: "ALT + 9001",
    run: () => openSettings(),
  },
  {
    id: "app.topologyGraph",
    category: "Panels",
    label: "Topology graph",
    description: "Open the semantic topology graph panel.",
    defaultKeys: "ALT + 9002",
    run: () => openTopologyGraphPanel(),
  },
  {
    id: "app.highlight",
    category: "Panels",
    label: "Highlight",
    description: "Open the classification highlight panel.",
    defaultKeys: "ALT + 9003",
    run: () => openHighlightPanel(),
  },
];

/** Call once at boot — also starts the key engine. */
export function registerAppHotkeys(): void {
  hotkeysActions.register(APP_HOTKEYS);
}
