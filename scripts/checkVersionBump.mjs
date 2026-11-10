// Fails unless the version in <head package.json> is strictly higher than
// the one in <base package.json>. Used by the PR-to-main workflow.
//   node scripts/checkVersionBump.mjs <base package.json> <head package.json>

import { readFileSync } from "node:fs";

const [basePath, headPath] = process.argv.slice(2);
if (!basePath || !headPath) {
  console.error("usage: checkVersionBump.mjs <base package.json> <head package.json>");
  process.exit(2);
}

const read = (path) => JSON.parse(readFileSync(path, "utf-8")).version;

function parse(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    console.error(`"${version}" is not a plain x.y.z version.`);
    process.exit(1);
  }
  return match.slice(1).map(Number);
}

const base = read(basePath);
const head = read(headPath);
const [a, b] = [parse(base), parse(head)];
const cmp = b[0] - a[0] || b[1] - a[1] || b[2] - a[2];

if (cmp <= 0) {
  console.error(`::error file=package.json::Version ${head} must be higher than main's ${base}. Bump package.json before merging.`);
  process.exit(1);
}
console.log(`Version bump OK: ${base} -> ${head}`);
