// Regenerates the DERIVED documentation content in documentation/:
//   rules.md      — validation rule reference, from the live rule tables
//   metamodel.md  — DEXPI 2.0 information-model summary, from metaModel-2.0
//   symbols.md    — DiscProfile 0.6.3 symbol catalogue + symbols/*.svg,
//                   rendered with the app's own SVG emitter
// Run: npm run generate:docs   (node imports the .ts sources directly)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const DOCS = new URL("../documentation/", import.meta.url);
mkdirSync(new URL("symbols/", DOCS), { recursive: true });
mkdirSync(new URL("signals/", DOCS), { recursive: true });

// jsdom provides DOMParser for the app's parsers.
const dom = new JSDOM("");
globalThis.DOMParser = dom.window.DOMParser;

const { RULE_TITLES, CATEGORY_LABELS, categoryOfRule } = await import("../src/lib/dexpi/validation.ts");
const { META_MODEL_2_0 } = await import("../src/lib/generated/metaModel-2.0.ts");
const { parseDiscProfile } = await import("../src/lib/dexpi/discProfile.ts");
const { sceneToSvg } = await import("../src/lib/dexpi/exportSvg.ts");
const { signalLineStyle, buildSignalMarkPrims } = await import("../src/lib/dexpi/signalLines.ts");

// ---------------------------------------------------------------------------
// Signal-line style previews (conventions.md) — rendered with the SAME code
// the canvas uses, so the documentation cannot drift from the behavior.
// ---------------------------------------------------------------------------

{
  const cases = [
    ["measuring", "Plant/Instrumentation.MeasuringLineFunction", null],
    ["signal", "Plant/Instrumentation.SignalConveyingFunction", "SignalConveying"],
    ["electrical", "Plant/Instrumentation.SignalConveyingFunction", "ElectricalSignalConveying"],
    ["bus", "Plant/Instrumentation.SignalConveyingFunction", "BusSignalConveying"],
    ["hydraulic", "Plant/Instrumentation.SignalConveyingFunction", "HydraulicSignalConveying"],
    ["authored", "Plant/Instrumentation.SignalConveyingFunction", "SomeFutureSignalConveying"],
  ];
  for (const [key, type, representation] of cases) {
    const rep = representation
      ? `<Data property="DiscProfile/SignalConveyingFunctionTypeRepresentation"><String>${representation}</String></Data>`
      : "";
    const el = new dom.window.DOMParser()
      .parseFromString(`<Object type="${type}">${rep}</Object>`, "text/xml").documentElement;
    const style = signalLineStyle(el);
    // "authored" keeps the file's stroke — shown as the idiomatic LongDash.
    const dash = style ? style.dash : [2, 0.75];
    const points = [{ x: 0, y: 0 }, { x: 60, y: 0 }];
    const stroke = { color: { r: 0, g: 0, b: 0 }, width: 0.25, dash };
    const prims = [
      { kind: "polyline", points, stroke },
      ...(style?.mark ? buildSignalMarkPrims(points, style.mark, stroke) : []),
    ];
    const scene = {
      nodes: prims.map((prim) => ({ kind: "prim", prim, objectId: null, role: "connector" })),
      shapes: new Map(),
      bounds: { minX: -1, minY: -3, maxX: 61, maxY: 3 },
    };
    writeFileSync(new URL(`signals/${key}.svg`, DOCS), sceneToSvg(scene));
  }
  console.log(`signals: ${cases.length} previews`);
}

// ---------------------------------------------------------------------------
// Rule reference
// ---------------------------------------------------------------------------

/** Hand-curated per-rule prose; ids not listed fall back to their title. */
const RULE_DOCS = {
  "SCH-001": ["error", "Two objects share one id. Ids must be unique — duplicates break references and selection."],
  "SCH-002": ["error", "A References target id does not exist in the document (namespace-qualified published-model targets are exempt)."],
  "SCH-003": ["error", "An object id violates the DEXPI XML Schema identifier pattern [A-Za-z_][A-Za-z_0-9]*."],
  "SCH-004": ["error", 'A References token is neither "#id" nor a qualified name reference ("Model/Name.Name").'],
  "GFX-001": ["error/warning", "A ShapeUsage/SymbolUsage does not resolve to a catalogue Shape or a loaded DISC-profile symbol. Aggregated per symbol; well-known shapes like /Border warn only."],
  "GFX-002": ["warning", "A ConnectorLine has fewer than two resolvable points and cannot be drawn."],
  "GFX-003": ["warning", "The Diagram declares no usable Min/Max extent; bounds were computed from geometry."],
  "CON-001": ["warning", "A flow item (Pipe/Stream) is missing its source or target connection. Off-page ends are legitimate — confirm intent."],
  "CON-002": ["warning", "A PipingNode is not referenced by any SourceNode/TargetNode connection."],
  "CON-003": ["info", "A nozzle has no piping connected to it or its nodes — possibly an intentional spare."],
  "CON-004": ["warning", "The two nodes a connection joins declare different nominal diameters (like representations compared only; segment endpoints skipped — a PipeReducer inside legitimately changes DN)."],
  "CON-005": ["info", "The piping class changes between two connected segments without a PropertyBreak marking the transition."],
  "MDL-000": ["warning", "The document declares a DEXPI model version this build has no tables for; validation fell back to the newest available."],
  "MDL-001": ["warning", "An object's class is not in the DEXPI information model (base-model namespaces only — extension classes are exempt)."],
  "MDL-002": ["warning", "A Data property is not defined for the object's class (typo detection; namespaced extension attributes are exempt)."],
  "MDL-003": ["error", "A property with lower bound 1 is missing (an <Undefined/> value counts as missing)."],
  "MDL-004": ["error", "An enumeration-typed property carries a literal the model does not define, or references the wrong enumeration."],
  "MDL-005": ["warning", "A References property is not defined for the object's class."],
  "MDL-006": ["error", "A property carries more reference targets or components than its upper bound allows."],
  "MDL-007": ["error", "A reference target's class is incompatible with the declared target class (profile extension ancestry is honoured; unknown extensions are skipped, never guessed)."],
  "MDL-008": ["warning", "A Components property is not defined for the object's class."],
  "MDL-009": ["error", "An abstract model class is instantiated — the spec requires a concrete subclass."],
  "META-002": ["error", "An AttributeRepresentation names an attribute that does not resolve on (or near) its object — the template fragment renders blank."],
};

{
  const byCategory = new Map();
  for (const ruleId of Object.keys(RULE_TITLES)) {
    const cat = categoryOfRule(ruleId);
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), ruleId]);
  }
  let md = `# Validation rule reference

Generated from the app's rule tables by \`npm run generate:docs\` — ${Object.keys(RULE_TITLES).length} rules.
Default severities can be overridden per rule (including *Ignore*) in the Validation panel's severity configuration; overrides persist across sessions.

`;
  for (const [cat, ids] of byCategory) {
    md += `## ${CATEGORY_LABELS[cat]}\n\n| Rule | Title | Default severity | What it means |\n| --- | --- | --- | --- |\n`;
    for (const id of ids) {
      const [severity, text] = RULE_DOCS[id] ?? ["—", RULE_TITLES[id]];
      md += `| \`${id}\` | ${RULE_TITLES[id]} | ${severity} | ${text} |\n`;
    }
    md += "\n";
  }
  md += `The \`MDL-*\` family is model-driven: every base-model object is checked against the DEXPI information model the document declares via its \`data.dexpi.org\` Import URIs (see [metamodel.md](metamodel.md)).\n`;
  writeFileSync(new URL("rules.md", DOCS), md);
  console.log(`rules.md: ${Object.keys(RULE_TITLES).length} rules`);
}

// ---------------------------------------------------------------------------
// Metamodel summary
// ---------------------------------------------------------------------------

{
  const model = META_MODEL_2_0;
  const packages = new Map();
  for (const [name, cls] of Object.entries(model.classes)) {
    const pkg = name.includes(".") ? name.slice(0, name.lastIndexOf(".")) : (name.split("/")[0] ?? name);
    packages.set(pkg, [...(packages.get(pkg) ?? []), [name, cls]]);
  }
  let md = `# DEXPI ${model.version} information model

Generated from \`refrences/Dexpi-2.0.xmi\` by \`npm run generate:metamodel\` + \`generate:docs\`:
**${Object.keys(model.classes).length} classes** and **${Object.keys(model.enums).length} enumerations**. Model-driven validation (the \`MDL-*\` rules) checks every object against these tables.

`;
  for (const [pkg, classes] of [...packages.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    md += `## ${pkg} (${classes.length} classes)\n\n| Class | Own properties | Required | Supertypes |\n| --- | --- | --- | --- |\n`;
    for (const [name, cls] of classes.sort(([a], [b]) => a.localeCompare(b))) {
      const bare = name.split(".").pop() ?? name;
      const required = cls.properties.filter((p) => p.lower >= 1).map((p) => p.name);
      const supers = cls.superTypes.map((s) => s.split(/[/.]/).pop()).join(", ");
      md += `| ${bare}${cls.isAbstract ? " *(abstract)*" : ""} | ${cls.properties.length} | ${required.join(", ") || "—"} | ${supers || "—"} |\n`;
    }
    md += "\n";
  }
  md += `## Enumerations\n\n| Enumeration | Literals |\n| --- | --- |\n`;
  for (const [name, literals] of Object.entries(model.enums)) {
    md += `| ${name.split(".").pop()} | ${literals.join(", ")} |\n`;
  }
  writeFileSync(new URL("metamodel.md", DOCS), md);
  console.log(`metamodel.md: ${packages.size} packages`);
}

// ---------------------------------------------------------------------------
// Profile symbol catalogue
// ---------------------------------------------------------------------------

function primitiveBounds(prims) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const point = (x, y) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  for (const p of prims) {
    if (p.kind === "polyline" || p.kind === "polygon") {
      for (const pt of p.points) point(pt.x, pt.y);
    } else if (p.kind === "circle") {
      point(p.center.x - p.radius, p.center.y - p.radius);
      point(p.center.x + p.radius, p.center.y + p.radius);
    } else if (p.kind === "ellipse" || p.kind === "ellipseArc") {
      point(p.center.x - p.rx, p.center.y - p.ry);
      point(p.center.x + p.rx, p.center.y + p.ry);
    } else if (p.kind === "rect") {
      point(p.center.x - p.width / 2, p.center.y - p.height / 2);
      point(p.center.x + p.width / 2, p.center.y + p.height / 2);
    } else if (p.kind === "text") {
      point(p.position.x, p.position.y);
    }
  }
  if (minX > maxX) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  const pad = 1;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

{
  const profileXml = readFileSync(
    new URL("../refrences/discdexpi-2026pack/Profile/xml/DiscProfile.xml", import.meta.url),
    "utf-8",
  );
  const profile = parseDiscProfile(profileXml).data;
  if (!profile) {
    throw new Error("profile parse failed");
  }

  const names = [...profile.symbols.keys()].filter((k) => !k.includes("/")).sort();
  let md = `# DiscProfile 0.6.3 symbol catalogue

Generated from the official \`DiscProfile.xml\` by \`npm run generate:docs\`, rendered with the app's own SVG emitter — ${names.length} symbols.
Conditional variants render their default variant; label-template placeholders are listed per symbol.

| Symbol | Preview | Variants | Label templates |
| --- | --- | --- | --- |
`;
  let rendered = 0;
  for (const name of names) {
    const symbol = profile.symbols.get(name);
    const variant = symbol?.variants.find((v) => v.condition === null) ?? symbol?.variants[0];
    if (!symbol || !variant) continue;

    const cell = variant.primitives.length > 0 ? `![${name}](symbols/${name}.svg)` : "*(label-only)*";
    if (variant.primitives.length > 0) {
      const scene = {
        nodes: variant.primitives.map((prim) => ({ kind: "prim", prim, objectId: null, role: "symbol" })),
        shapes: new Map(),
        bounds: primitiveBounds(variant.primitives),
      };
      writeFileSync(new URL(`symbols/${name}.svg`, DOCS), sceneToSvg(scene));
      rendered += 1;
    }
    const conditions = symbol.variants
      .filter((v) => v.condition)
      .map((v) => `${v.condition.attributeName}=${v.condition.literalValue}`);
    const escapeCell = (text) =>
      text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("|", "\\|")
        .replaceAll(/\r?\n/g, " ⏎ ");
    const templates = [...new Set(variant.labelTemplates.map((t) => escapeCell(t.text)))];
    md += `| \`${name}\` | ${cell} | ${symbol.variants.length}${conditions.length ? ` (${conditions.join("; ")})` : ""} | ${templates.join("<br>") || "—"} |\n`;
  }
  writeFileSync(new URL("symbols.md", DOCS), md);
  console.log(`symbols.md: ${names.length} symbols, ${rendered} SVGs`);
}
