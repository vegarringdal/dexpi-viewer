import { fail, ok, type Result } from "../result.ts";
import { buildConnectivity } from "./connectivity.ts";
import type { DiscProfile } from "./discProfile.ts";
import { buildPlantModel } from "./plantModel.ts";
import { buildSceneGraph } from "./sceneGraph.ts";
import type { DexpiDocument, DocumentMeta } from "./types.ts";
import { validateDocument } from "./validation.ts";
import { stringFromData } from "./xml.ts";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function parseMeta(root: Element): DocumentMeta {
  const engineering = root.querySelector('Object[type="Core/EngineeringModel"]');
  return {
    modelName: root.getAttribute("name") ?? "",
    originatingSystem: engineering ? stringFromData(engineering, "OriginatingSystemName") : "",
    exportDateTime: engineering ? stringFromData(engineering, "ExportDateTime") : "",
  };
}

function indexObjectTypes(root: Element): Map<string, string> {
  const map = new Map<string, string>();
  for (const el of root.querySelectorAll("Object[id]")) {
    const id = el.getAttribute("id");
    if (id) {
      map.set(id, el.getAttribute("type") ?? "");
    }
  }
  return map;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * Parses DEXPI 2.0 XML text into the viewer's document model, resolving
 * Profile/SymbolUsage references against `profile` (a loaded DiscProfile)
 * when given. Expected failures (malformed XML, not a DEXPI model, no
 * drawable content) come back as Result errors, never throws.
 */
export function parseDexpiDocument(
  xmlText: string,
  profile: DiscProfile | null = null,
): Result<DexpiDocument> {
  const dom = new DOMParser().parseFromString(xmlText, "text/xml");
  if (dom.querySelector("parsererror")) {
    return fail("Not well-formed XML — the file could not be parsed.");
  }

  const root = dom.documentElement;
  if (root.tagName !== "Model") {
    return fail(`Not a DEXPI 2.0 XML file (root element is <${root.tagName}>, expected <Model>).`);
  }

  const scene = buildSceneGraph(root, profile);
  if (scene.nodes.length === 0) {
    return fail("The file contains no drawable diagram content.");
  }

  return ok({
    meta: parseMeta(root),
    scene,
    plant: buildPlantModel(root),
    connectivity: buildConnectivity(root),
    issues: validateDocument(root, profile),
    objectTypes: indexObjectTypes(root),
  });
}
