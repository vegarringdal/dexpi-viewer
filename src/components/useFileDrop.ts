import { useEffect } from "react";
import { openDocumentFile } from "../state/viewer/viewer.actions.ts";

/** Accepts a DEXPI XML file dropped anywhere on the window. */
export function useFileDrop(): void {
  useEffect(() => {
    const handleDragOver = (e: DragEvent): void => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent): void => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) {
        return;
      }

      void openDocumentFile(file);
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);
}
