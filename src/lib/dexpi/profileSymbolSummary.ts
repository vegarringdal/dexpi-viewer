import type { DiscProfile, ProfileSymbol } from "./discProfile.ts";
import type { PlantNode } from "./plantModel.ts";
import type { Point, ScenePrimitive } from "./types.ts";

// -----------------------------------------------------------------------------
// Profile symbol detail rows
//
// A published profile symbol carries the same geometry/label data
// sceneGraph.ts uses to render it — this exposes it as plain name/value
// rows so the Inspect and Diagram Tree panels can show what a "Symbol"
// reference actually resolves to, not just a variant/primitive count.
// -----------------------------------------------------------------------------

/** A ShapeUsage/SymbolUsage's `Shape`/`Symbol` reference names the profile
 *  catalogue entry it draws — the single most useful fact about one of
 *  these objects, which otherwise carry only Position/Rotation/Scale. */
const SYMBOL_REFERENCE_PROPERTIES = ["Symbol", "Shape"] as const;

/** The display name `node`'s Symbol/Shape reference resolves to in the
 *  loaded profile's catalogue (a symbol's short name, or a published
 *  instance's bare name), or null when it carries no such reference or no
 *  profile is loaded to resolve it against. */
export function resolveSymbolReferenceName(
  node: PlantNode,
  profile: DiscProfile | null | undefined,
): string | null {
  if (!profile) {
    return null;
  }

  for (const property of SYMBOL_REFERENCE_PROPERTIES) {
    const target = node.references.find((r) => r.property === property)?.targets[0];
    if (!target) {
      continue;
    }

    const bare = target.split("/").pop() ?? target;
    const symbol = profile.symbols.get(target) ?? profile.symbols.get(bare);
    if (symbol) {
      return symbol.name;
    }

    const instance = profile.instances.get(target) ?? profile.instances.get(bare);
    if (instance) {
      return bare.split(".").pop() ?? bare;
    }
  }
  return null;
}

export type ProfileSymbolDetailRow = Readonly<{ name: string; value: string }>;

function formatPoint(p: Point): string {
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
}

/** The real DEXPI/profile class each primitive kind is parsed from
 *  (`primitives.ts`'s `parsePrimitive`) — shown so a row reads as "this IS
 *  a Core/Diagram.Ellipse", not just a generic geometry summary. */
const PRIMITIVE_CLASS_NAME: Readonly<Record<ScenePrimitive["kind"], string>> = {
  polyline: "Core/Diagram.PolyLine",
  polygon: "Core/Diagram.Polygon",
  circle: "Core/Diagram.Circle",
  ellipse: "Core/Diagram.Ellipse",
  ellipseArc: "Core/Diagram.EllipseArc",
  rect: "Core/Diagram.Rectangle",
  text: "Core/Diagram.Text",
};

/** One line of geometry a symbol's Primitives entry actually draws, in its
 *  own local coordinate space (mm, y-down) — prefixed with its real class. */
function formatPrimitiveSummary(prim: ScenePrimitive): string {
  const className = PRIMITIVE_CLASS_NAME[prim.kind];
  switch (prim.kind) {
    case "circle":
      return `${className} — r=${prim.radius.toFixed(1)} @ ${formatPoint(prim.center)}`;
    case "ellipse":
      return `${className} — rx=${prim.rx.toFixed(1)} ry=${prim.ry.toFixed(1)} @ ${formatPoint(prim.center)}`;
    case "ellipseArc":
      return `${className} — rx=${prim.rx.toFixed(1)} ry=${prim.ry.toFixed(1)} @ ${formatPoint(prim.center)}`;
    case "rect":
      return `${className} — ${prim.width.toFixed(1)}×${prim.height.toFixed(1)} @ ${formatPoint(prim.center)}`;
    case "polyline":
      return `${className} — ${String(prim.points.length)} pt(s)`;
    case "polygon":
      return `${className} — ${String(prim.points.length)} pt(s)`;
    case "text":
      return `${className} — "${prim.value}" @ ${formatPoint(prim.position)}`;
  }
}

/** Every row a profile symbol's catalogue entry actually carries: per
 *  variant, its shape id, its condition (when the profile picks between
 *  variants), then every drawn primitive and every LabelTemplate token. */
export function profileSymbolDetailRows(symbol: ProfileSymbol): readonly ProfileSymbolDetailRow[] {
  const rows: ProfileSymbolDetailRow[] = [];
  const multi = symbol.variants.length > 1;
  symbol.variants.forEach((variant, vi) => {
    const prefix = multi ? `V${String(vi + 1)} ` : "";
    rows.push({ name: `${prefix}Shape`, value: variant.shapeId });
    if (variant.condition) {
      rows.push({
        name: `${prefix}Condition`,
        value: `${variant.condition.attributeName} = ${variant.condition.literalValue}`,
      });
    }
    variant.primitives.forEach((prim, pi) => {
      rows.push({ name: `${prefix}Primitive ${String(pi + 1)}`, value: formatPrimitiveSummary(prim) });
    });
    variant.labelTemplates.forEach((template, li) => {
      rows.push({
        name: `${prefix}Label ${String(li + 1)}`,
        value: `Profile/LabelTemplate — ${template.text} @ ${formatPoint(template.position)}`,
      });
    });
  });
  return rows;
}
