// Fails when `npm audit` reports an advisory of moderate severity or above that the
// repository has not reviewed. A reviewed advisory is listed in audit-exceptions.json
// at the repository root with the reason it does not apply, e.g.
//   { "GHSA-2p57-rm9w-gvfp": { "package": "ip", "reason": "only ip.toString is called" } }
// Usage: npm audit --json | node check-audit.mjs
import { existsSync, readFileSync } from "node:fs";

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const report = JSON.parse(readFileSync(0, "utf8") || "{}");
const exceptions = existsSync("audit-exceptions.json") ? JSON.parse(readFileSync("audit-exceptions.json", "utf8")) : {};

const advisories = new Map();
for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of entry.via ?? []) {
    if (typeof via !== "object" || RANK[via.severity] < RANK.moderate) continue;
    const id = String(via.url ?? "").split("/").pop() || String(via.source);
    advisories.set(id, { id, name, severity: via.severity, title: via.title, url: via.url });
  }
}

let open = 0;
for (const advisory of advisories.values()) {
  const exception = exceptions[advisory.id];
  if (exception?.reason) {
    console.log(`reviewed: ${advisory.id} ${advisory.name} (${advisory.severity}) — ${exception.reason}`);
    continue;
  }
  open += 1;
  console.log(`::error::${advisory.id} ${advisory.name} (${advisory.severity}): ${advisory.title} ${advisory.url}`);
}
for (const id of Object.keys(exceptions)) {
  if (!advisories.has(id)) console.log(`::warning::audit-exceptions.json lists ${id}, which npm audit no longer reports; remove it`);
}
console.log(`${advisories.size} advisory(ies) at moderate or above, ${open} not reviewed`);
if (open) process.exitCode = 1;
