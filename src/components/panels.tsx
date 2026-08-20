import { definePanel } from "@tredespace/ui/dockable";
import type { JSX } from "react";
import { CanvasStage } from "../lib/canvas/CanvasStage.tsx";
import { ConnectionsPanel } from "./panels/ConnectionsPanel.tsx";
import { IssuesPanel } from "./panels/IssuesPanel.tsx";
import { MinimapPanel } from "./panels/MinimapPanel.tsx";
import { PropertiesPanel } from "./panels/PropertiesPanel.tsx";
import { TopologyPanel } from "./panels/TopologyPanel.tsx";
import { RibbonBar } from "./RibbonBar.tsx";
import { SettingsPanel } from "./settings/SettingsPanel.tsx";

// -----------------------------------------------------------------------------
// Panel bodies
// -----------------------------------------------------------------------------

function DrawingPanel(): JSX.Element {
  return <CanvasStage />;
}

// -----------------------------------------------------------------------------
// Panel definitions
// -----------------------------------------------------------------------------

export { PANEL_IDS } from "./panelIds.ts";

import { PANEL_IDS } from "./panelIds.ts";

export const viewerPanels = [
  definePanel({
    id: PANEL_IDS.ribbon,
    title: "Ribbon",
    closable: false,
    floatable: false,
    component: RibbonBar,
  }),
  definePanel({ id: PANEL_IDS.drawing, title: "Drawing", closable: false, component: DrawingPanel }),
  definePanel({ id: PANEL_IDS.topology, title: "Topology", minWidth: 200, component: TopologyPanel }),
  definePanel({ id: PANEL_IDS.properties, title: "Properties", minWidth: 220, component: PropertiesPanel }),
  definePanel({
    id: PANEL_IDS.connections,
    title: "Connections",
    minWidth: 220,
    home: "right",
    component: ConnectionsPanel,
  }),
  definePanel({
    id: PANEL_IDS.issues,
    title: "Validation",
    minHeight: 80,
    home: "left",
    component: IssuesPanel,
  }),
  definePanel({
    id: PANEL_IDS.minimap,
    title: "Minimap",
    minHeight: 100,
    home: "rightBottom",
    component: MinimapPanel,
  }),
  definePanel({
    id: PANEL_IDS.settings,
    title: "Settings",
    minWidth: 260,
    home: "right",
    component: SettingsPanel,
  }),
];
