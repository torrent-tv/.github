// Prints the body of one changelog section.
// Usage: node changelog-section.mjs --changelog <file> --heading <version|Unreleased>
import { options, readChangelog } from "./lib.mjs";

const { changelog, heading } = options();
const section = readChangelog(changelog).sections.find((entry) => entry.heading === heading);
if (!section) throw new Error(`${changelog} has no "## ${heading}" section`);
process.stdout.write(`${section.lines.join("\n").trim()}\n`);
