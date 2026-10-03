import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { bumpOf, isTaskBranch, nextVersion, parseHeader, readChangelog, readVersion, taskOf, writeChangelog, writeVersion } from "../scripts/lib.mjs";

test("headers follow Conventional Commits", () => {
  assert.deepEqual(parseHeader("fix(proxy): close the run"), { type: "fix", scope: "proxy", breaking: false });
  assert.deepEqual(parseHeader("feat!: drop the old route"), { type: "feat", scope: null, breaking: true });
  assert.equal(parseHeader("Fix the run"), null);
  assert.equal(parseHeader("wip: something"), null);
  assert.equal(parseHeader("fix:no space"), null);
});

test("a header ends with the task it belongs to", () => {
  assert.equal(taskOf("fix(subtitles): keep the track #ttv-12"), 12);
  assert.equal(parseHeader("fix(subtitles): keep the track #ttv-12")?.type, "fix");
  assert.equal(taskOf("fix(subtitles): keep the track"), null);
  assert.equal(taskOf("fix: see #ttv-12 for the cause"), null);
  assert.equal(taskOf("fix: keep the track #12"), null);
  assert.equal(taskOf("fix: keep the track#ttv-12"), null);
  assert.equal(taskOf("fix: keep the track #ttv-0"), null);
});

test("a working branch names its type and task", () => {
  assert.equal(isTaskBranch("fix/ttv-12-keep-subtitle-track"), true);
  assert.equal(isTaskBranch("feat/ttv-7-hls.v2"), true);
  assert.equal(isTaskBranch("fix/ttv-12"), false);
  assert.equal(isTaskBranch("feature/ttv-12-menu"), false);
  assert.equal(isTaskBranch("fix/12-keep"), false);
  assert.equal(isTaskBranch("fix/ttv-12-Keep"), false);
  assert.equal(isTaskBranch("claude/roadmap-github-project"), false);
});

test("the release step follows the strongest commit", () => {
  assert.equal(bumpOf(["docs: note", "chore(deps): update"]), "none");
  assert.equal(bumpOf(["docs: note", "fix: one"]), "patch");
  assert.equal(bumpOf(["perf: faster", "feat(server): menu", "fix: one"]), "minor");
  assert.equal(bumpOf(["refactor!: rename"]), "minor");
  assert.equal(bumpOf(["chore: x\n\nBREAKING CHANGE: gone"]), "minor");
  assert.equal(bumpOf(["chore(release): 1.2.3", "Not conventional"]), "none");
});

test("versions step by patch and minor", () => {
  assert.equal(nextVersion("2.89.7", "patch"), "2.89.8");
  assert.equal(nextVersion("2.89.7", "minor"), "2.90.0");
  assert.equal(nextVersion("2.89.7", "none"), "2.89.7");
});

test("version files are read and written in place", () => {
  const dir = mkdtempSync(join(tmpdir(), "ttv-ci-"));
  const yaml = join(dir, "config.yaml");
  writeFileSync(yaml, 'name: "x"\nversion: "0.79.16"\nslug: "y"\n');
  writeVersion(yaml, "0.79.17");
  assert.equal(readVersion(yaml), "0.79.17");
  assert.equal(readFileSync(yaml, "utf8"), 'name: "x"\nversion: "0.79.17"\nslug: "y"\n');
  const lock = join(dir, "package-lock.json");
  writeFileSync(lock, JSON.stringify({ name: "a", version: "1.0.0", packages: { "": { version: "1.0.0" } } }, null, 2));
  writeVersion(lock, "1.0.1");
  assert.equal(JSON.parse(readFileSync(lock, "utf8")).packages[""].version, "1.0.1");
});

test("a changelog survives a read and a write unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "ttv-ci-"));
  const file = join(dir, "CHANGELOG.md");
  const text = "## Unreleased\n\n- **Fix**: one.\n\n## 1.0.0\n\n- **New**: two.\n";
  writeFileSync(file, text);
  const log = readChangelog(file);
  assert.deepEqual(log.sections.map((section) => section.heading), ["Unreleased", "1.0.0"]);
  writeChangelog(file, log);
  assert.equal(readFileSync(file, "utf8"), text);
});

test("versions compare by number, not by text", async () => {
  const { compareVersions } = await import("../scripts/lib.mjs");
  assert.ok(compareVersions("2.89.10", "2.89.9") > 0);
  assert.ok(compareVersions("2.90.0", "2.89.99") > 0);
  assert.equal(compareVersions("0.36.14", "0.36.14"), 0);
  assert.ok(compareVersions("0.9.5", "0.36.0") < 0);
});
