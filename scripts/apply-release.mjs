// Writes a release into the working tree: the version into every version file and the
// version heading in place of "## Unreleased". The release job commits and tags the result.
// Usage: node apply-release.mjs --version <x.y.z> --changelog <file> --version-files <a,b>
import { hasEntries, options, readChangelog, writeChangelog, writeVersion } from "./lib.mjs";

const { version, changelog, "version-files": files } = options();
if (!version || !changelog || !files) throw new Error("--version, --changelog and --version-files are required");

const log = readChangelog(changelog);
const unreleased = log.sections[0];
if (unreleased?.heading !== "Unreleased" || !hasEntries(unreleased)) {
  throw new Error(`${changelog} has no entries under a leading "## Unreleased"`);
}
unreleased.heading = version;
writeChangelog(changelog, log);
for (const file of files.split(",")) writeVersion(file.trim(), version);
console.log(`release ${version} written to ${changelog} and ${files}`);
