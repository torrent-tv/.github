// Describes a dependency update from the lock file before and after it, and from
// `npm audit --json` before and after it. Writes the commit message, the type that
// decides whether the update is released, and the changelog entry.
// Usage: node deps-summary.mjs --before-lock <file> --audit-before <file> --audit-after <file>
//        --ships-lockfile true|false --out <dir>
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { git, options } from "./lib.mjs";

const opts = options();
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const before = read(opts["before-lock"]).packages ?? {};
const after = read("package-lock.json").packages ?? {};
const vulnerabilities = (file) => {
  try {
    return read(file).metadata?.vulnerabilities?.total ?? 0;
  } catch {
    return 0;
  }
};

// Direct dependencies are the ones package.json names; a hoisted transitive
// package also sits at the top of node_modules, so its path says nothing.
const manifest = read("package.json");
const declared = new Set(Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies }));
const changed = [];
for (const [path, entry] of Object.entries(after)) {
  if (!path || before[path]?.version === entry.version) continue;
  const name = path.replace(/^.*node_modules\//, "");
  const direct = declared.has(name) && path === `node_modules/${name}`;
  changed.push({ name, from: before[path]?.version ?? "new", to: entry.version, direct });
}
const removed = Object.keys(before).filter((path) => path && !(path in after)).length;
const fixed = Math.max(0, vulnerabilities(opts["audit-before"]) - vulnerabilities(opts["audit-after"]));
const manifestChanged = git("status", "--porcelain", "--", "package.json") !== "";
const releasable = fixed > 0 || manifestChanged || opts["ships-lockfile"] === "true";
const type = releasable ? "fix" : "chore";

const direct = changed.filter((entry) => entry.direct).map((entry) => `${entry.name} ${entry.from} → ${entry.to}`);
const parts = [];
if (direct.length) parts.push(direct.join(", "));
parts.push(`${changed.length} package(s) changed in the lock file${removed ? `, ${removed} removed` : ""}`);
if (fixed) parts.push(`${fixed} known vulnerabilit${fixed === 1 ? "y" : "ies"} resolved`);
const summary = parts.join("; ");

writeFileSync(join(opts.out, "type"), type);
writeFileSync(join(opts.out, "message"), `${type}(deps): update dependencies\n\n${summary}.\n`);
writeFileSync(join(opts.out, "entry"), `- **Chore**: Update dependencies: ${summary}.\n`);
console.log(`${type}(deps): ${summary}`);
