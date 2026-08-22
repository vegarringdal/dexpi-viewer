import { DockView, split, tabs, useDockManager } from "@tredespace/ui/dockable";
import { ErrorDialogCore } from "@tredespace/ui/widgets";
import { type JSX, useEffect } from "react";
import { PANEL_IDS, viewerPanels } from "./components/panels.tsx";
import { StatusBar } from "./components/StatusBar.tsx";
import { useFileDrop } from "./components/useFileDrop.ts";
import { initLayoutPersistence, setDockManager } from "./state/ui/ui.actions.ts";
import { getEffectiveIssues } from "./state/validation/validation.actions.ts";
import { setViewerError } from "./state/viewer/viewer.actions.ts";
import { viewerState } from "./state/viewer/viewer.state.ts";

const RIBBON_HEIGHT_PX = 108;

export function App(): JSX.Element {
  const { errorMsg } = viewerState.use();
  useFileDrop();

  const manager = useDockManager(() => ({
    panels: viewerPanels,
    layout: split("column", [
      tabs([PANEL_IDS.ribbon], {
        id: "top",
        hideTabs: true,
        locked: true,
        fixedSize: RIBBON_HEIGHT_PX,
      }),
      split(
        "row",
        [
          tabs([PANEL_IDS.topology, PANEL_IDS.issues], { id: "left" }),
          tabs([PANEL_IDS.drawing], { id: "center" }),
          split(
            "column",
            [
              tabs([PANEL_IDS.properties, PANEL_IDS.connections, PANEL_IDS.settings], {
                id: "right",
              }),
              tabs([PANEL_IDS.minimap], { id: "rightBottom" }),
            ],
            [69, 31],
          ),
        ],
        [26, 50, 24],
      ),
    ]),
  }));

  useEffect(() => {
    setDockManager(manager);
    const disposePersistence = initLayoutPersistence(manager);
    // Every start lands on Settings → About (the panel defaults to that tab).
    manager.focusPanel(PANEL_IDS.settings);

    // The Validation panel mounts lazily — as an inactive tab it never
    // renders, so its count/title/content would go stale. Focus it whenever
    // a newly loaded document has findings.
    let seenRevision = viewerState.get().docRevision;
    const unsubIssues = viewerState.subscribe(() => {
      const revision = viewerState.get().docRevision;
      if (revision === seenRevision) {
        return;
      }

      seenRevision = revision;
      if (getEffectiveIssues().length > 0) {
        manager.focusPanel(PANEL_IDS.issues);
      }
    });

    return () => {
      unsubIssues();
      disposePersistence();
      setDockManager(null);
    };
  }, [manager]);

  return (
    <div className="flex h-full flex-col">
      <DockView manager={manager} className="min-h-0 flex-1" />
      <StatusBar />
      {errorMsg && (
        <ErrorDialogCore title="DEXPI Viewer" message={errorMsg} onDismiss={() => setViewerError(null)} />
      )}
    </div>
  );
}
