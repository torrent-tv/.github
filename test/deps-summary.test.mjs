import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const SCRIPT = new URL("../scripts/deps-summary.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function lock(versions) {
  const packages = { "": { name: "x" } };
  for (const [path, version] of Object.entries(versions)) packages[path] = { version };
  return JSON.stringify({ name: "x", lockfileVersion: 3, packages });
}

test("only packages that package.json names are listed as direct", () => {
  const dir = mkdtempSync(join(tmpdir(), "ttv-deps-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir });
  git("init", "-q");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { fastify: "^5.0.0" } }));
  git("add", "package.json");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "chore: start");
  writeFileSync(join(dir, "before.json"), lock({ "node_modules/fastify": "5.0.0", "node_modules/pino": "9.0.0" }));
  writeFileSync(join(dir, "package-lock.json"), lock({ "node_modules/fastify": "5.1.0", "node_modules/pino": "10.0.0" }));
  writeFileSync(join(dir, "audit.json"), JSON.stringify({ metadata: { vulnerabilities: { total: 0 } } }));
  execFileSync(process.execPath, [SCRIPT, "--before-lock", "before.json", "--audit-before", "audit.json",
    "--audit-after", "audit.json", "--ships-lockfile", "true", "--out", "."], { cwd: dir });
  const entry = readFileSync(join(dir, "entry"), "utf8");
  assert.match(entry, /fastify 5\.0\.0 → 5\.1\.0; 2 package\(s\) changed/);
  assert.doesNotMatch(entry, /pino/);
  assert.equal(readFileSync(join(dir, "type"), "utf8"), "fix");
});
