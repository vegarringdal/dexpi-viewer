// Generates src/lib/generated/metaModel.ts from refrences/Dexpi-2.0.xmi
// (the DEXPI 2.0 information model, extracted from the official supporting
// materials' Dexpi.xmi). Run: node scripts/generateMetaModel.mjs
//
// The XMI is machine-generated EA output — regular, attribute-quoted, no
// CDATA — so a small tag tokenizer suffices; no XML dependency needed.

import { readFileSync, writeFileSync } from "node:fs";

const VERSION = process.argv[3] ?? "2.0";
const SOURCE = new URL(process.argv[2] ?? "../refrences/Dexpi-2.0.xmi", import.meta.url);
const TARGET = new URL(`../src/lib/generated/metaModel-${VERSION}.ts`, import.meta.url);

// ---------------------------------------------------------------------------
// Minimal XML tree
// ---------------------------------------------------------------------------

function parseXml(text) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const tagRe = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>/g;
  const attrRe = /([\w:.-]+)="([^"]*)"/g;
  for (let m = tagRe.exec(text); m !== null; m = tagRe.exec(text)) {
    const [, closing, tag, attrText, selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const attrs = {};
    for (let a = attrRe.exec(attrText); a !== null; a = attrRe.exec(attrText)) {
      attrs[a[1]] = a[2];
    }
    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
  }
  return root;
}

// ---------------------------------------------------------------------------
// Model extraction
// ---------------------------------------------------------------------------

const xmiType = (node) => node.attrs["xmi:type"];
const xmiId = (node) => node.attrs["xmi:id"];

function multiplicity(attr) {
  const lower = attr.children.find((c) => c.tag === "lowerValue");
  const upper = attr.children.find((c) => c.tag === "upperValue");
  return {
    lower: lower ? Number.parseInt(lower.attrs.value ?? "0", 10) || 0 : 1,
    upper: upper ? (upper.attrs.value === "*" ? null : Number.parseInt(upper.attrs.value ?? "1", 10) || 1) : 1,
  };
}

function dataTypeKind(name) {
  if (name.includes("PhysicalQuantity")) return "quantity";
  if (name.includes("MultiLanguageString")) return "multilanguage";
  if (name.includes("String")) return "string";
  if (name.includes("Integer")) return "integer";
  if (name.includes("Double")) return "double";
  if (name.includes("Boolean")) return "boolean";
  if (name.includes("DateTime")) return "datetime";
  if (name.includes("AnyURI")) return "anyuri";
  return "unknown";
}

const xmi = parseXml(readFileSync(SOURCE, "utf-8"));
const models = xmi.children[0].children.filter((c) => xmiType(c) === "uml:Model");

// First pass: index every id-bearing element with its qualified name.
const byId = new Map(); // id -> { node, kind: "class"|"enum"|"datatype", qualified }
const walkIndex = (node, model, path) => {
  for (const child of node.children) {
    const t = xmiType(child);
    const name = child.attrs.name ?? "";
    if (t === "uml:Package") {
      walkIndex(child, model, [...path, name]);
    } else if (t === "uml:Class" || t === "uml:Enumeration" || t === "uml:DataType") {
      const qualified =
        path.length === 0 ? `${model}/${name}` : `${model}/${path.join(".")}.${name}`;
      const kind = t === "uml:Class" ? "class" : t === "uml:Enumeration" ? "enum" : "datatype";
      const id = xmiId(child);
      if (id) {
        byId.set(id, { node: child, kind, qualified, name });
      }
      walkIndex(child, model, path); // nested classifiers (rare) keep the path
    }
  }
};
for (const model of models) {
  walkIndex(model, model.attrs.name, []);
}

// Second pass: classes with properties, and enums with literals.
const classes = {};
const enums = {};
for (const entry of byId.values()) {
  if (entry.kind === "enum") {
    enums[entry.qualified] = entry.node.children
      .filter((c) => c.tag === "ownedLiteral")
      .map((c) => c.attrs.name);
    continue;
  }
  if (entry.kind !== "class" || entry.qualified.startsWith("_Auxiliaries/")) {
    continue;
  }

  const superTypes = entry.node.children
    .filter((c) => c.tag === "generalization")
    .map((c) => byId.get(c.attrs.general)?.qualified)
    .filter((s) => s !== undefined);
  const properties = [];
  for (const attr of entry.node.children) {
    if (attr.tag !== "ownedAttribute" || !attr.attrs.name) {
      continue;
    }

    const target = byId.get(attr.attrs.type);
    const { lower, upper } = multiplicity(attr);
    if (target?.kind === "class") {
      properties.push({
        name: attr.attrs.name,
        kind: attr.attrs.aggregation === "composite" ? "composition" : "reference",
        target: target.qualified,
        lower,
        upper,
      });
    } else if (target?.kind === "enum") {
      properties.push({ name: attr.attrs.name, kind: "enum", target: target.qualified, lower, upper });
    } else {
      properties.push({
        name: attr.attrs.name,
        kind: dataTypeKind(target?.name ?? ""),
        lower,
        upper,
      });
    }
  }
  classes[entry.qualified] = {
    isAbstract: entry.node.attrs.isAbstract === "true",
    superTypes: superTypes.sort(),
    properties: properties.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const sortedClasses = Object.fromEntries(Object.entries(classes).sort(([a], [b]) => a.localeCompare(b)));
const sortedEnums = Object.fromEntries(Object.entries(enums).sort(([a], [b]) => a.localeCompare(b)));
const topNames = models.map((m) => m.attrs.name).filter((n) => n !== "_Auxiliaries");

const datatypeNames = [...byId.values()]
  .filter((e) => e.kind === "datatype" && !e.qualified.startsWith("_Auxiliaries/"))
  .map((e) => e.qualified)
  .sort();

const constName = `META_MODEL_${VERSION.replace(/\./g, "_")}`;
const out = `// Generated by scripts/generateMetaModel.mjs from the DEXPI ${VERSION}
// information model XMI. Do not edit by hand — regenerate instead.
import type { MetaModel } from "../dexpi/metaModel.ts";

export const ${constName}: MetaModel = {
 version: ${JSON.stringify(VERSION)},
 topModels: ${JSON.stringify(topNames)},
 datatypes: ${JSON.stringify(datatypeNames, null, 1)},
 enums: ${JSON.stringify(sortedEnums, null, 1)},
 classes: ${JSON.stringify(sortedClasses, null, 1)},
};
`;
writeFileSync(TARGET, out);
console.log(
  `wrote ${Object.keys(sortedClasses).length} classes, ${Object.keys(sortedEnums).length} enums, tops: ${topNames.join(",")}`,
);
