import {
  IconAlertTriangle,
  IconChartDots3,
  IconColorFilter,
  IconFileVector,
  IconListDetails,
  IconListTree,
  IconMap,
  IconPlugConnected,
  IconRestore,
  IconSchema,
  IconSettings,
  IconSitemap,
} from "@tabler/icons-react";
import { useDockLayout, usePanelContext } from "@tredespace/ui/dockable";
import { RibbonButton, RibbonSection } from "@tredespace/ui/widgets";
import type { JSX } from "react";
import { resetDockLayout } from "../../state/ui/ui.actions.ts";
import { PANEL_IDS } from "../panelIds.ts";

/** Per-panel visibility toggles (selected = open) + layout reset. */
export function PanelsSection(): JSX.Element {
  const { manager } = usePanelContext();
  useDockLayout(manager);

  const panelToggle = (panelId: string): (() => void) => {
    return () => manager.togglePanel(panelId);
  };

  return (
    <RibbonSection title="Panels">
      <RibbonButton
        icon={<IconListTree />}
        label="Explorer"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.topology)}
        tooltip="Show/hide the object explorer tree"
        shortcut="panel.explorer"
        onClick={panelToggle(PANEL_IDS.topology)}
      />
      <RibbonButton
        icon={<IconSitemap />}
        label="Conceptual Model"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.conceptualModelTree)}
        tooltip="Raw ConceptualModel XML tree, grouped by property, with Data and Inverse References"
        shortcut="panel.conceptualModelTree"
        onClick={panelToggle(PANEL_IDS.conceptualModelTree)}
      />
      <RibbonButton
        icon={<IconFileVector />}
        label="Diagram Tree"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.diagramTree)}
        tooltip="Raw Diagram XML tree, grouped by property, cross-linked to the conceptual model"
        shortcut="panel.diagramTree"
        onClick={panelToggle(PANEL_IDS.diagramTree)}
      />
      <RibbonButton
        icon={<IconChartDots3 />}
        label="Topology"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.topologyGraph)}
        tooltip="Semantic topology graph: flow, containment and references"
        shortcut="app.topologyGraph"
        onClick={panelToggle(PANEL_IDS.topologyGraph)}
      />
      <RibbonButton
        icon={<IconSchema />}
        label="Inspect"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.inspect)}
        tooltip="UML-style diagram of the selected object: all data and one-hop relations (debug)"
        shortcut="panel.inspect"
        onClick={panelToggle(PANEL_IDS.inspect)}
      />
      <RibbonButton
        icon={<IconListDetails />}
        label="Properties"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.properties)}
        tooltip="Show/hide the properties panel"
        shortcut="panel.properties"
        onClick={panelToggle(PANEL_IDS.properties)}
      />
      <RibbonButton
        icon={<IconColorFilter />}
        label="Highlight"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.highlight)}
        tooltip="Tint the drawing by classification: heat trace, signal, fluid code, piping class"
        shortcut="app.highlight"
        onClick={panelToggle(PANEL_IDS.highlight)}
      />
      <RibbonButton
        icon={<IconPlugConnected />}
        label="Connections"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.connections)}
        tooltip="Direct upstream/downstream neighbours of the selection"
        shortcut="panel.connections"
        onClick={panelToggle(PANEL_IDS.connections)}
      />
      <RibbonButton
        icon={<IconSettings />}
        label="Settings"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.settings)}
        tooltip="Rendering options and shortcut bindings"
        shortcut="app.settings"
        onClick={panelToggle(PANEL_IDS.settings)}
      />
      <RibbonButton
        icon={<IconMap />}
        label="Minimap"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.minimap)}
        tooltip="Show/hide the drawing overview"
        shortcut="panel.minimap"
        onClick={panelToggle(PANEL_IDS.minimap)}
      />
      <RibbonButton
        icon={<IconAlertTriangle />}
        label="Validation"
        size="mini"
        selected={manager.isOpen(PANEL_IDS.issues)}
        tooltip="Show/hide the validation findings"
        shortcut="panel.validation"
        onClick={panelToggle(PANEL_IDS.issues)}
      />
      <RibbonButton
        icon={<IconRestore />}
        label="Reset"
        size="big"
        tooltip="Restore the default panel layout"
        shortcut="panel.resetLayout"
        onClick={resetDockLayout}
      />
    </RibbonSection>
  );
}
