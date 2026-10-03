// Fails when a commit in the given range does not follow Conventional Commits or,
// unless our own workflows made it, does not end its header with a task reference.
// Usage: node check-commits.mjs --range <from>..<to>
import { BOT_EMAIL, messagesIn, options, parseHeader, TYPES, taskOf } from "./lib.mjs";

const { range } = options();
if (!range) throw new Error("--range is required");

const commits = messagesIn(range);
let bad = 0;
for (const { sha, email, message } of commits) {
  const header = message.split("\n")[0];
  if (!parseHeader(header)) {
    bad += 1;
    console.log(`::error::${sha.slice(0, 7)} "${header}" is not a Conventional Commits header: <type>(<scope>)!: <subject> #ttv-<issue>, type one of ${TYPES.join(", ")}`);
    continue;
  }
  if (email === BOT_EMAIL || taskOf(header) !== null) continue;
  bad += 1;
  console.log(`::error::${sha.slice(0, 7)} "${header}" does not end with a task reference: #ttv-<issue number in torrent-tv/meta>`);
}
console.log(`${commits.length} commit(s) checked in ${range}, ${bad} not conforming`);
if (bad) process.exitCode = 1;
