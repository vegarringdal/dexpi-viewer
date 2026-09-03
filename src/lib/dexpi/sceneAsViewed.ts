import type { RgbColor, SceneGraph, SceneNode, ScenePrimitive, ShapeDef } from "./types.ts";

// -----------------------------------------------------------------------------
// "As viewed" scene recoloring
//
// The canvas paints highlights as extra PASSES over the drawing (a veil, then
// re-strokes in the overlay color). The file exporters have no passes — they
// emit each primitive once — so the same look is baked into a DERIVED scene
// here: every pass the canvas would composite is applied to the color itself.
// Pure, so the exporters stay free of view state and this stays testable.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ViewAppearance = Readonly<{
  /** Draw everything in ink/paper, so overlay tints never collide with file colors. */
  monochrome: boolean;
  /**
   * objectId → overlay color, precedence already resolved by the caller
   * (classification tint first, then the trace overlays on top).
   */
  tints: ReadonlyMap<string, RgbColor>;
  /** Fade everything that has no tint, so the tinted objects stand out. */
  dimOthers: boolean;
}>;

/** The color decisions for one node, derived once and reused per primitive. */
type ColorRules = Readonly<{
  monochrome: boolean;
  dimmed: boolean;
  tint: RgbColor | null;
}>;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// An export prints on white paper whatever the app theme is, so the monochrome
// remap uses the LIGHT palette's ink/paper — a dark-theme B/W export would
// otherwise come out as pale ink no printer can reproduce.
const PAPER: RgbColor = { r: 255, g: 255, b: 255 };
const INK: RgbColor = { r: 30, g: 41, b: 59 };

/** Above this relative luminance, monochrome keeps a color as paper (masking fills). */
const PAPER_LUMINANCE = 0.85;

/** Matches DIM_VEIL_ALPHA in drawDexpiScene. */
const DIM_VEIL_ALPHA = 0.8;

/** Matches the highlight pass's fill alpha in drawDexpiScene (makeFillPaint). */
const TINT_FILL_ALPHA = 0.35;

// -----------------------------------------------------------------------------
// Color math
// -----------------------------------------------------------------------------

function luminance(color: RgbColor): number {
  return (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
}

/** `over` composited onto `base` at `alpha` — the canvas's source-over blend. */
function composite(base: RgbColor, over: RgbColor, alpha: number): RgbColor {
  return {
    r: Math.round(base.r + (over.r - base.r) * alpha),
    g: Math.round(base.g + (over.g - base.g) * alpha),
    b: Math.round(base.b + (over.b - base.b) * alpha),
  };
}

function toMonochrome(color: RgbColor): RgbColor {
  return luminance(color) > PAPER_LUMINANCE ? PAPER : INK;
}

/**
 * The color a stroke or glyph ends up with: the overlay re-stroke is opaque, so
 * a tint simply replaces it; otherwise the base color survives the B/W remap
 * and the dim veil.
 */
function inkColor(color: RgbColor, rules: ColorRules): RgbColor {
  if (rules.tint) {
    return rules.tint;
  }

  const base = rules.monochrome ? toMonochrome(color) : color;
  return rules.dimmed ? composite(base, PAPER, DIM_VEIL_ALPHA) : base;
}

/** Fills keep showing through the overlay, which paints them at 35% (makeFillPaint). */
function areaColor(color: RgbColor, rules: ColorRules): RgbColor {
  const base = rules.monochrome ? toMonochrome(color) : color;
  const veiled = rules.dimmed ? composite(base, PAPER, DIM_VEIL_ALPHA) : base;
  return rules.tint ? composite(veiled, rules.tint, TINT_FILL_ALPHA) : veiled;
}

// -----------------------------------------------------------------------------
// Recoloring
// -----------------------------------------------------------------------------

function recolorPrimitive(prim: ScenePrimitive, rules: ColorRules): ScenePrimitive {
  if (prim.kind === "text") {
    return { ...prim, color: inkColor(prim.color, rules) };
  }

  const stroke = { ...prim.stroke, color: inkColor(prim.stroke.color, rules) };
  if (!("fill" in prim)) {
    return { ...prim, stroke };
  }

  // Hatch draws in the fill color as LINES, so it takes the ink treatment.
  const fillColor =
    prim.fill.style === "Hatch" ? inkColor(prim.fill.color, rules) : areaColor(prim.fill.color, rules);
  return { ...prim, stroke, fill: { ...prim.fill, color: fillColor } };
}

function isIdentity(rules: ColorRules): boolean {
  return !rules.monochrome && !rules.dimmed && rules.tint === null;
}

function rulesFor(objectId: string | null, appearance: ViewAppearance): ColorRules {
  const tint = (objectId !== null ? appearance.tints.get(objectId) : undefined) ?? null;
  return {
    monochrome: appearance.monochrome,
    dimmed: appearance.dimOthers && tint === null,
    tint,
  };
}

function rulesKey(rules: ColorRules): string {
  const tint = rules.tint ? `${rules.tint.r},${rules.tint.g},${rules.tint.b}` : "-";
  return `${rules.monochrome ? "m" : ""}${rules.dimmed ? "d" : ""}:${tint}`;
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * A copy of `scene` with the view's highlight treatment baked into every color.
 * Catalogue shapes are shared by many usages, so a shape is cloned ONCE PER
 * DISTINCT color treatment (`shapeId|rules`) rather than per placement — a
 * sheet where hundreds of valves share one tint stays one extra shape.
 * Returns the input untouched when the view asks for no change at all.
 */
export function sceneAsViewed(scene: SceneGraph, appearance: ViewAppearance): SceneGraph {
  if (!appearance.monochrome && appearance.tints.size === 0) {
    return scene;
  }

  const shapes = new Map<string, ShapeDef>();
  const nodes: SceneNode[] = scene.nodes.map((node) => {
    const rules = rulesFor(node.objectId, appearance);
    if (node.kind === "prim") {
      return isIdentity(rules) ? node : { ...node, prim: recolorPrimitive(node.prim, rules) };
    }

    const shape = scene.shapes.get(node.shapeId);
    if (!shape) {
      return node;
    }

    if (isIdentity(rules)) {
      shapes.set(shape.id, shape);
      return node;
    }

    const derivedId = `${shape.id}|${rulesKey(rules)}`;
    if (!shapes.has(derivedId)) {
      shapes.set(derivedId, {
        ...shape,
        id: derivedId,
        primitives: shape.primitives.map((prim) => recolorPrimitive(prim, rules)),
      });
    }

    return { ...node, shapeId: derivedId };
  });

  return { ...scene, nodes, shapes };
}
