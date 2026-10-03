// Fails when a working branch is not named `<type>/ttv-<issue>-<description>`.
// The default branch is exempt. Usage: node check-branch.mjs --branch <name> [--default main]
import { isTaskBranch, options, TYPES } from "./lib.mjs";

const { branch, default: defaultBranch = "main" } = options();
if (!branch) throw new Error("--branch is required");

if (branch === defaultBranch || isTaskBranch(branch)) {
  console.log(`branch "${branch}" conforms`);
} else {
  console.log(`::error::branch "${branch}" is not <type>/ttv-<issue>-<description>: type one of ${TYPES.join(", ")}, issue a number in torrent-tv/meta, description of a-z, 0-9, "." and "-"`);
  process.exitCode = 1;
}
