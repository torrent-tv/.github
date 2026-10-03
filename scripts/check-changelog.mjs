// A releasable change needs its entry under "## Unreleased"; the release job turns that
// heading into the version. Any other heading above the released version is refused.
// Usage: node check-changelog.mjs --changelog <file> --version-file <file>
import { bumpOf, fail, hasEntries, lastTag, messagesIn, options, readChangelog, readVersion } from "./lib.mjs";

const { changelog, "version-file": versionFile } = options();
const current = readVersion(versionFile);
const { sections } = readChangelog(changelog);
const top = sections[0];
const tag = lastTag();
const bump = tag ? bumpOf(messagesIn(`${tag}..HEAD`).map((commit) => commit.message)) : "none";

if (top && top.heading !== "Unreleased" && top.heading !== current) {
  fail(`${changelog} starts with "## ${top.heading}" but ${current} is the released version. Pending entries go under "## Unreleased"; the release job writes the version.`);
}
const unreleased = sections.find((section) => section.heading === "Unreleased");
if (unreleased && sections.indexOf(unreleased) !== 0) fail(`"## Unreleased" must be the first section of ${changelog}`);
if (bump !== "none" && !(unreleased && hasEntries(unreleased))) {
  fail(`commits since ${tag} make a ${bump} release, and ${changelog} has no entry under "## Unreleased"`);
}
console.log(`changelog ${changelog}: released ${current}, pending step ${bump}, unreleased entries: ${Boolean(unreleased && hasEntries(unreleased))}`);
