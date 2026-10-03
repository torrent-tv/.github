// Fails when a commit in the given range does not follow Conventional Commits.
// Usage: node check-commits.mjs --range <from>..<to>
import { messagesIn, options, parseHeader, TYPES } from "./lib.mjs";

const { range } = options();
if (!range) throw new Error("--range is required");

const commits = messagesIn(range);
let bad = 0;
for (const { sha, message } of commits) {
  const header = message.split("\n")[0];
  if (parseHeader(header)) continue;
  bad += 1;
  console.log(`::error::${sha.slice(0, 7)} "${header}" is not a Conventional Commits header: <type>(<scope>)!: <subject>, type one of ${TYPES.join(", ")}`);
}
console.log(`${commits.length} commit(s) checked in ${range}, ${bad} not conforming`);
if (bad) process.exitCode = 1;
