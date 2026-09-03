import type { Result } from "../../lib/result.ts";
import { setViewerError } from "../../state/viewer/viewer.actions.ts";

/** Surfaces a failed export in the viewer's error dialog; success is silent
 *  (the file just downloads). */
export function reportExportError(result: Result<void>): void {
  if (result.error) {
    setViewerError(result.error.msg);
  }
}
