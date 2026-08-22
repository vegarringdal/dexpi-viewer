import type { ProfileLabelTemplate } from "./discProfile.ts";
import { transformPrimitive } from "./flattenScene.ts";
import { isRenderableLabelValue } from "./labelPolicy.ts";
import { formatForRepresentation, type LookupIndex, lookupDisplayAttribute } from "./resolveTemplates.ts";
import { TEXT_LINE_SPACING } from "./textLayout.ts";
import type { SceneNode, UseTransform } from "./types.ts";
import { dataValue, getData, refLocalName } from "./xml.ts";

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

      return renderableOrBlank(ownValueText(target, attrName));
    }

    const value = lookupDisplayAttribute(index, objectId, attrName);
    return value === undefined ? "" : renderableOrBlank(formatForRepresentation(value, "Value"));
  });
  return unresolved ? null : resolved;
}

/**
 * World-space text nodes for every pending placement's LabelTemplates —
 * resolved per instance, transformed by the instance's use-transform, and
 * drawn on top as ordinary label primitives (canvas and exports alike).
 *
 * Director's rendering rules: the enhanced file's explicit diagram labels
 * are authoritative — a placement whose represented object already has
 * explicit label text renders NO template overlays (never both). Template
 * line breaks are real formatting: each line becomes its own text primitive.
 */
export function buildProfileLabelOverlays(
  index: LookupIndex,
  pending: readonly PendingProfileLabels[],
  objectIdsWithExplicitLabels: ReadonlySet<string>,
): SceneNode[] {
  const nodes: SceneNode[] = [];
  for (const entry of pending) {
    if (objectIdsWithExplicitLabels.has(entry.objectId)) {
      continue;
    }

    const roleCounters = new Map<string, number>();
    for (const template of entry.templates) {
      const value = resolveProfileLabelText(template.text, entry.objectId, index, roleCounters);
      if (!value || value.trim().length === 0) {
        continue;
      }

      for (const [lineIndex, line] of value.split(/\r?\n/).entries()) {
        if (line.trim().length === 0) {
          continue;
        }

        const prim = transformPrimitive(entry.transform, {
          kind: "text",
          value: line,
          position: {
            x: template.position.x,
            y: template.position.y + lineIndex * template.size * TEXT_LINE_SPACING,
          },
          rotation: template.rotation,
          size: template.size,
          color: template.color,
          font: template.font,
          hAlign: template.hAlign,
          vAlign: template.vAlign,
        });
        nodes.push({ kind: "prim", prim, objectId: entry.objectId, role: "label" });
      }
    }
  }
  return nodes;
}
