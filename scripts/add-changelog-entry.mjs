// Adds text under "## Unreleased", creating that section at the top when it is missing.
// Usage: node add-changelog-entry.mjs --changelog <file> --entry-file <file>
import { readFileSync } from "node:fs";
import { options, readChangelog, writeChangelog } from "./lib.mjs";

const { changelog, "entry-file": entryFile } = options();
const entry = readFileSync(entryFile, "utf8").replace(/\r\n/g, "\n").trim();
const log = readChangelog(changelog);
let unreleased = log.sections[0];
if (unreleased?.heading !== "Unreleased") {
  unreleased = { heading: "Unreleased", lines: ["", ""] };
  log.sections.unshift(unreleased);
}
const firstBullet = unreleased.lines.findIndex((line) => line.trim().startsWith("- "));
const at = firstBullet === -1 ? 1 : firstBullet;
unreleased.lines.splice(at, 0, ...entry.split("\n"));
if (firstBullet === -1 && unreleased.lines.at(-1) !== "") unreleased.lines.push("");
writeChangelog(changelog, log);
console.log(`added to ${changelog}:\n${entry}`);
