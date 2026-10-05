// A release job checks out the commit of its own push. When an earlier job released a
// commit pushed before it and its release commit reached main after this push, that
// release is not in the checkout: planned from there, this job computes the version the
// earlier job already published (torrent-tv/meta#126). This merges the newest release
// into the checkout first, so the plan starts from it. A newest release that already
// holds the checkout is a re-run of a published release and is left to the plan.
// Usage: node release-catch-up.mjs --changelog <file> --version-files <a,b>
import { git, isAncestor, mergeRelease, options } from "./lib.mjs";

const { changelog, "version-files": files } = options();
if (!changelog || !files) throw new Error("--changelog and --version-files are required");

const head = git("rev-parse", "--short", "HEAD");
const newest = git("tag", "--list", "v[0-9]*", "--sort=-v:refname").split("\n")[0];
if (!newest) {
  console.log("no v* release tag exists");
} else if (isAncestor(newest, "HEAD")) {
  console.log(`${newest} is in the history of ${head}`);
} else if (isAncestor("HEAD", newest)) {
  console.log(`${newest} already holds ${head}`);
} else {
  const version = mergeRelease({ release: `refs/tags/${newest}`, changelog, versionFiles: files.split(",").map((file) => file.trim()) });
  console.log(`::notice::${newest} was released from a commit pushed before ${head} and is not in its history; ${version} is merged in before the plan`);
}
