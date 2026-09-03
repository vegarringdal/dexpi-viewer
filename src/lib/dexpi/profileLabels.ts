import type { ProfileInstanceData, ProfileLabelTemplate } from "./discProfile.ts";
import { transformPrimitive } from "./flattenScene.ts";
import { isRenderableLabelValue } from "./labelPolicy.ts";
import { formatForRepresentation, type LookupIndex, lookupDisplayAttribute } from "./resolveTemplates.ts";
import { isOffPageConnectorType, isPropertyBreakType } from "./typeNames.ts";
import type { SceneNode, ScenePrimitive, UseTransform } from "./types.ts";
import { dataValue, directChildrenByTag, getData, refLocalName } from "./xml.ts";

// -----------------------------------------------------------------------------
// DiscProfile label overlays
//
// Synthesizes text primitives from a profile symbol variant's LabelTemplates
// for each placed instance. The template Text carries placeholders:
//   <Attr>            — resolved on the represented object or (2-hop BFS) a
//                       related object; unresolved renders blank, keeping the
//                       other fields of a multi-field line.
//   ClassName:<Attr>  — resolved on a SPECIFIC child of that class; matched
//                       by PortStatus when the text carries an H=/HH=/L=/LL=
//                       alarm prefix, else positionally. No matching child
//                       suppresses the whole template (no right answer).
// Semantics reconstructed from the prior-art viewer. The official 0.6.3
// catalogue (refrences/discdexpi-2026pack/) now verifies the FORMAT parses
// (discProfileOfficial.test.ts); the placeholder-resolution semantics here
// remain prior-art-derived until real placed-symbol fixtures confirm them.
// -----------------------------------------------------------------------------

/** A pending overlay: which templates to place with which instance transform. */
export type PendingProfileLabels = Readonly<{
  templates: readonly ProfileLabelTemplate[];
  transform: UseTransform;
  objectId: string;
}>;

/** "H=" → StatusHighPort etc.; longest prefix first so "HH=" isn't read as "H=". */
const PORT_STATUS_HINTS: Readonly<Record<string, string>> = {
  HHH: "StatusHighHighHighPort",
  HH: "StatusHighHighPort",
  H: "StatusHighPort",
  LLL: "StatusLowLowLowPort",
  LL: "StatusLowLowPort",
  L: "StatusLowPort",
};

const PLACEHOLDER = /(?:([A-Za-z][A-Za-z0-9_]*):)?<([^<>]+)>/g;

function extractPortStatusHint(text: string): string | null {
  const match = /^\s*(HHH|HH|H|LLL|LL|L)\s*=/.exec(text);
  return match ? (PORT_STATUS_HINTS[match[1] ?? ""] ?? null) : null;
}

function typeSuffix(el: Element): string {
  const type = el.getAttribute("type") ?? "";
  return type.split(/[./]/).pop() ?? type;
}

/**
 * The child of `parentId` that should supply a "ClassName:<Attr>" value:
 * by PortStatus when hinted (no positional fallback — a wrong alarm's value
 * is worse than none), else the next same-class child in document order
 * (roleCounters shared across one placement's templates).
 */
function pickRoleChild(
  index: LookupIndex,
  parentId: string,
  roleName: string,
  roleCounters: Map<string, number>,
  portStatusHint: string | null,
): Element | null {
  const matches = (index.childrenOf.get(parentId) ?? [])
    .map((id) => index.byId.get(id))
    .filter((el): el is Element => el !== undefined && typeSuffix(el) === roleName);
  if (matches.length === 0) {
    return null;
  }

  if (portStatusHint) {
    return (
      matches.find((el) => refLocalName(dataValue(getData(el, "PortStatus"))) === portStatusHint) ?? null
    );
  }

  const idx = roleCounters.get(roleName) ?? 0;
  roleCounters.set(roleName, idx + 1);
  return matches[idx] ?? matches[matches.length - 1] ?? null;
}

/**
 * Direct-only Data lookup on one element, tolerating prefixed spellings.
 * Prefers the `<Attr>Representation` twin — the spec's readable drawing
 * code — over the base attribute (see lookupDisplayAttribute).
 */
function ownValueText(el: Element, attributeName: string): string {
  const bare = attributeName.split("/").pop() ?? attributeName;
  const candidates = bare.endsWith("Representation")
    ? [attributeName, bare, `DiscProfile/${bare}`]
    : [
        `${bare}Representation`,
        `DiscProfile/${bare}Representation`,
        attributeName,
        bare,
        `DiscProfile/${bare}`,
      ];
  for (const name of candidates) {
    const data = getData(el, name);
    if (data) {
      return formatForRepresentation(dataValue(data), "Value");
    }
  }
  return "";
}

const NO_INSTANCES: ReadonlyMap<string, ProfileInstanceData> = new Map();

/**
 * Flips a placement rotation into the readable half-plane for label GLYPHS:
 * 90 and 180 flip by 180° (top-to-bottom / upside-down text never appears
 * in the official renderings), 0 and 270 stay. This governs orientation
 * only — a label's anchor follows the placement's true rotation.
 */
function normalizeLabelRotation(rotation: number): number {
  const r = ((rotation % 360) + 360) % 360;
  return r > 45 && r <= 225 ? (r + 180) % 360 : r;
}

/**
 * A placeholder can name a ReferenceProperty instead of a Data property —
 * e.g. <TypeCode> on the MCC/SIS function boxes and actuator circles: the
 * object carries `References property="DiscProfile/TypeCode"` to a
 * published profile instance (…TypeCodes.MotorControlCenter), whose
 * Abbreviation is the drawing code ("MCC", "M", …).
 */
function instanceValueFromReferences(
  el: Element,
  attributeName: string,
  instances: ReadonlyMap<string, ProfileInstanceData>,
): string | undefined {
  if (instances.size === 0) {
    return undefined;
  }

  const bare = attributeName.split("/").pop() ?? attributeName;
  for (const refs of directChildrenByTag(el, "References")) {
    const property = refs.getAttribute("property") ?? "";
    if (property !== attributeName && property !== bare && property !== `DiscProfile/${bare}`) {
      continue;
    }

    for (const raw of (refs.getAttribute("objects") ?? "").split(/\s+/)) {
      const attrs = instances.get(raw) ?? instances.get(raw.split("/").pop() ?? raw);
      const abbreviation = attrs?.get("Abbreviation");
      if (abbreviation) {
        return abbreviation;
      }
    }
  }
  return undefined;
}

/**
 * Resolves one LabelTemplate text for an instance; null suppresses the
 * template (an alarm role-path with no matching child). The "' & " VB-style
 * concatenation syntax some templates embed is stripped first.
 */
export function resolveProfileLabelText(
  rawText: string,
  objectId: string,
  index: LookupIndex,
  roleCounters: Map<string, number>,
  instances: ReadonlyMap<string, ProfileInstanceData> = NO_INSTANCES,
): string | null {
  const text = rawText.replace(/'\s*&\s*/g, "");
  if (!/[<>]/.test(text)) {
    return text;
  }

  const portStatusHint = extractPortStatusHint(text);
  let unresolved = false;
  // Non-renderable values (sentinels, leaked placeholder tokens) render
  // blank like an unmodelled field, so that label position is suppressed
  // without hiding the template's other fields or sibling positions.
  const renderableOrBlank = (formatted: string): string =>
    isRenderableLabelValue(formatted) ? formatted : "";
  const resolved = text.replace(PLACEHOLDER, (_match, roleName: string | undefined, attrName: string) => {
    if (roleName) {
      const target = pickRoleChild(index, objectId, roleName, roleCounters, portStatusHint);
      if (!target) {
        unresolved = true;
        return "";
      }

      const own = ownValueText(target, attrName);
      return renderableOrBlank(own || (instanceValueFromReferences(target, attrName, instances) ?? ""));
    }

    const value = lookupDisplayAttribute(index, objectId, attrName);
    if (value !== undefined) {
      return renderableOrBlank(formatForRepresentation(value, "Value"));
    }

    const el = index.byId.get(objectId);
    return el ? renderableOrBlank(instanceValueFromReferences(el, attrName, instances) ?? "") : "";
  });
  return unresolved ? null : resolved;
}

/**
 * One template text in world space: ANCHORED with `anchorRotation` (the
 * placement's own rotation, so the label sits on the geometry it annotates)
 * but DRAWN at `glyphRotation` (normalized, so it never reads upside-down).
 * Both paths go through `transformPrimitive`, keeping mirroring and scaling
 * in one place — only the two angles differ.
 */
function placeLabelText(
  transform: UseTransform,
  anchorRotation: number,
  glyphRotation: number,
  template: ProfileLabelTemplate,
  value: string,
): ScenePrimitive {
  const local: ScenePrimitive = {
    kind: "text",
    value,
    position: { x: template.position.x, y: template.position.y },
    rotation: template.rotation,
    size: template.size,
    color: template.color,
    font: template.font,
    hAlign: template.hAlign,
    vAlign: template.vAlign,
  };
  const anchored = transformPrimitive({ ...transform, rotation: anchorRotation }, local);
  const oriented = transformPrimitive({ ...transform, rotation: glyphRotation }, local);
  return anchored.kind === "text" && oriented.kind === "text"
    ? { ...anchored, rotation: oriented.rotation }
    : anchored;
}

/**
 * World-space text nodes for every pending placement's LabelTemplates —
 * resolved per instance, transformed by the instance's use-transform, and
 * drawn on top as ordinary label primitives (canvas and exports alike).
 *
 * Director's rendering rules: the enhanced file's explicit diagram labels
 * are authoritative — a placement whose represented object already has
 * explicit label text renders NO template overlays (never both). A
 * multi-line value stays ONE text primitive so layoutTextLines block-aligns
 * it per the template's vAlign — bottom-anchored labels (the break values)
 * grow UPWARD from the anchor like the official renderings, never down into
 * the symbol.
 */
export function buildProfileLabelOverlays(
  index: LookupIndex,
  pending: readonly PendingProfileLabels[],
  objectIdsWithExplicitLabels: ReadonlySet<string>,
  instances: ReadonlyMap<string, ProfileInstanceData> = NO_INSTANCES,
): SceneNode[] {
  const nodes: SceneNode[] = [];
  for (const entry of pending) {
    if (objectIdsWithExplicitLabels.has(entry.objectId)) {
      continue;
    }

    // A label's ANCHOR follows the placement's true rotation — the same
    // transform the symbol's own artwork gets — so a rotated symbol's label
    // stays on the geometry it annotates (ND0049 at 270° in
    // DISC_EXAMPLE-14-01..04 draws its type code INSIDE the circle, at the
    // rotated 10.5-unit offset). Only the GLYPH orientation is normalized.
    // Sheet-space families opt out of both: PropertyBreak and
    // OffPageConnector text blocks stay unrotated at the template offsets
    // (the 180°-rotated off-page connectors' "TO TEST P&ID…" and the
    // 270°-rotated breaks' values render horizontal in the official SVGs).
    // All three behaviours are pinned by profileLabelsOfficial.test.ts.
    const representedType = index.byId.get(entry.objectId)?.getAttribute("type") ?? "";
    const isSheetSpaceLabel = isPropertyBreakType(representedType) || isOffPageConnectorType(representedType);
    const anchorRotation = isSheetSpaceLabel ? 0 : entry.transform.rotation;
    const glyphRotation = isSheetSpaceLabel ? 0 : normalizeLabelRotation(entry.transform.rotation);
    const roleCounters = new Map<string, number>();
    for (const template of entry.templates) {
      const value = resolveProfileLabelText(template.text, entry.objectId, index, roleCounters, instances);
      if (!value || value.trim().length === 0) {
        continue;
      }

      const lines = value.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const prim = placeLabelText(entry.transform, anchorRotation, glyphRotation, template, lines.join("\n"));
      nodes.push({ kind: "prim", prim, objectId: entry.objectId, role: "label" });
    }
  }
  return nodes;
}
