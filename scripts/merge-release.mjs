// Merges a release commit into the commit checked out, a later commit of main that does
// not hold it, keeping each changelog entry under the release that published it.
// Usage: node merge-release.mjs --release <ref> --changelog <file> --version-files <a,b>
import { mergeRelease, options } from "./lib.mjs";

const { release, changelog, "version-files": files } = options();
if (!release || !changelog || !files) throw new Error("--release, --changelog and --version-files are required");

const version = mergeRelease({ release, changelog, versionFiles: files.split(",").map((file) => file.trim()) });
console.log(`release ${version} merged into the commit checked out`);
