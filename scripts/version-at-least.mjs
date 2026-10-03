// Exits 0 when the first version is at least the second (x.y.z), 1 otherwise.
// Usage: node version-at-least.mjs <version> <minimum>
import { compareVersions } from "./lib.mjs";

const [version, minimum] = process.argv.slice(2);
if (!version || !minimum) throw new Error("usage: version-at-least.mjs <version> <minimum>");
process.exitCode = compareVersions(version, minimum) >= 0 ? 0 : 1;
