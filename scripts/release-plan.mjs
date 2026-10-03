// Decides whether the commits since the last release tag make a release, and which version.
// Usage: node release-plan.mjs --version-file <package.json|config.yaml> [--bump auto|patch|minor]
// Outputs: bump (none|patch|minor), current, version, tag.
import { bumpOf, lastTag, messagesIn, nextVersion, options, output, readVersion } from "./lib.mjs";

const { "version-file": versionFile, bump: requested = "auto" } = options();
if (!versionFile) throw new Error("--version-file is required");

const current = readVersion(versionFile);
const tag = lastTag();
if (!tag) throw new Error(`no v* release tag is reachable from HEAD; tag the released version v${current} first`);
if (tag !== `v${current}`) throw new Error(`${versionFile} states ${current} while the last release tag is ${tag}`);

const messages = messagesIn(`${tag}..HEAD`).map((commit) => commit.message);
const bump = requested === "auto" ? bumpOf(messages) : requested;
if (!["none", "patch", "minor"].includes(bump)) throw new Error(`unknown bump "${bump}"`);

output("bump", bump);
output("current", current);
output("version", nextVersion(current, bump));
output("tag", `v${nextVersion(current, bump)}`);
console.log(`${messages.length} commit(s) since ${tag}; release step: ${bump}`);
