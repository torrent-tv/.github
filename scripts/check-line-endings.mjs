// Shell scripts and Dockerfiles must be stored with LF endings: CRLF breaks the shebang
// and the `RUN ... \` continuations inside Alpine containers.
import { git } from "./lib.mjs";

const strict = /(^|\/)(Dockerfile[^/]*|[^/]+\.sh|commit-msg)$/;
let bad = 0;
for (const line of git("ls-files", "--eol").split("\n")) {
  const match = /^i\/(\S+)\s+w\/\S+\s+attr\/.*?\t(.+)$/.exec(line);
  if (!match || !strict.test(match[2])) continue;
  if (match[1] === "crlf" || match[1] === "mixed") {
    bad += 1;
    console.log(`::error file=${match[2]}::stored with ${match[1]} line endings; shell scripts and Dockerfiles must use LF`);
  }
}
if (bad) process.exitCode = 1;
else console.log("line endings: shell scripts and Dockerfiles use LF");
