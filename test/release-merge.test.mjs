// Two pushes released in turn, the second pushed before the first one's release commit
// reached main: torrent-tv/meta#126, replayed in a scratch repository. Only git and node run.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { BOT_EMAIL, combineChangelogs, parseChangelog } from "../scripts/lib.mjs";

const SCRIPTS = fileURLToPath(new URL("../scripts/", import.meta.url));
const HUMAN = ["-c", "user.name=Dev", "-c", "user.email=dev@example.com"];

function repository() {
  const dir = mkdtempSync(join(tmpdir(), "ttv-release-"));
  const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const run = (script, ...args) => {
    const env = { ...process.env };
    delete env.GITHUB_OUTPUT;
    return execFileSync("node", [join(SCRIPTS, script), ...args], { cwd: dir, encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  };
  const write = (file, text) => writeFileSync(join(dir, file), text);
  const read = (file) => readFileSync(join(dir, file), "utf8");
  git("init", "-q", "-b", "main");
  git("config", "core.autocrlf", "false");
  // The release job's identity, as release-prepare sets it.
  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", BOT_EMAIL);
  const commit = (message, files, who = HUMAN) => {
    for (const [file, text] of Object.entries(files)) write(file, text);
    git("add", "-A");
    git(...who, "commit", "-q", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const release = (version) => {
    run("apply-release.mjs", "--version", version, "--changelog", "CHANGELOG.md", "--version-files", "package.json");
    git("add", "-A");
    git("commit", "-q", "-m", `chore(release): ${version}`);
    git("tag", `v${version}`);
    return git("rev-parse", "HEAD");
  };
  return { git, run, read, commit, release };
}

const version = (v) => `${JSON.stringify({ name: "x", version: v }, null, 2)}\n`;

/** 1.0.0 released; E pushed and released as 1.0.1; L pushed on E before that release reached main. */
function race() {
  const repo = repository();
  repo.commit("chore: start #ttv-1", { "package.json": version("1.0.0"), "CHANGELOG.md": "## 1.0.0\n\n- **Fix**: zero.\n", "code.txt": "zero\n" });
  repo.git("tag", "v1.0.0");
  const E = repo.commit("fix: one #ttv-1", { "CHANGELOG.md": "## Unreleased\n\n- **Fix**: one.\n\n## 1.0.0\n\n- **Fix**: zero.\n", "code.txt": "one\n" });
  const R = repo.release("1.0.1");
  repo.git("checkout", "-q", "--detach", E);
  const L = repo.commit("fix: two #ttv-1", { "CHANGELOG.md": "## Unreleased\n\n- **Fix**: two.\n- **Fix**: one.\n\n## 1.0.0\n\n- **Fix**: zero.\n", "code.txt": "two\n" });
  return { ...repo, E, R, L };
}

const MERGED = "## Unreleased\n\n- **Fix**: two.\n\n## 1.0.1\n\n- **Fix**: one.\n\n## 1.0.0\n\n- **Fix**: zero.\n";

test("the later push plans the next version, not the one already published", () => {
  const repo = race();
  assert.match(repo.run("release-plan.mjs", "--version-file", "package.json"), /version=1\.0\.1/, "the stale plan of the field case");
  repo.git("checkout", "-q", "--detach", repo.L);
  repo.run("release-catch-up.mjs", "--changelog", "CHANGELOG.md", "--version-files", "package.json");
  assert.equal(repo.read("CHANGELOG.md"), MERGED);
  assert.equal(JSON.parse(repo.read("package.json")).version, "1.0.1");
  assert.equal(repo.read("code.txt"), "two\n");
  assert.equal(repo.git("rev-list", "--parents", "-n", "1", "HEAD").split(" ").length, 3, "a merge");
  const plan = repo.run("release-plan.mjs", "--version-file", "package.json");
  assert.match(plan, /bump=patch/);
  assert.match(plan, /version=1\.0\.2/);
});

test("a release merged into a main that moved keeps the later entry pending", () => {
  const repo = race();
  repo.git("checkout", "-q", "--detach", repo.L);
  repo.run("merge-release.mjs", "--release", "refs/tags/v1.0.1", "--changelog", "CHANGELOG.md", "--version-files", "package.json");
  assert.equal(repo.read("CHANGELOG.md"), MERGED);
  assert.match(repo.run("check-changelog.mjs", "--changelog", "CHANGELOG.md", "--version-file", "package.json"), /unreleased entries: true/);
});

test("the next release merges into the main the previous merge left", () => {
  const repo = race();
  repo.git("checkout", "-q", "--detach", repo.L);
  repo.run("release-catch-up.mjs", "--changelog", "CHANGELOG.md", "--version-files", "package.json");
  const R2 = repo.release("1.0.2");
  // main as release-finish of the earlier job left it: L with 1.0.1 merged in.
  repo.git("checkout", "-q", "--detach", repo.L);
  repo.run("merge-release.mjs", "--release", "refs/tags/v1.0.1", "--changelog", "CHANGELOG.md", "--version-files", "package.json");
  repo.run("merge-release.mjs", "--release", "refs/tags/v1.0.2", "--changelog", "CHANGELOG.md", "--version-files", "package.json");
  assert.equal(repo.read("CHANGELOG.md"), "## 1.0.2\n\n- **Fix**: two.\n\n## 1.0.1\n\n- **Fix**: one.\n\n## 1.0.0\n\n- **Fix**: zero.\n");
  assert.equal(JSON.parse(repo.read("package.json")).version, "1.0.2");
  repo.git("merge-base", "--is-ancestor", R2, "HEAD"); // throws when the release is not in main
});

test("a newest release that holds the commit is left to the plan", () => {
  const repo = race();
  repo.git("checkout", "-q", "--detach", repo.E);
  const before = repo.git("rev-parse", "HEAD");
  assert.match(repo.run("release-catch-up.mjs", "--changelog", "CHANGELOG.md", "--version-files", "package.json"), /v1\.0\.1 already holds/);
  assert.equal(repo.git("rev-parse", "HEAD"), before);
  assert.equal(repo.git("tag", "--contains", "HEAD", "--list", "v[0-9]*", "--sort=v:refname").split("\n")[0], "v1.0.1");
});

test("a release that brings a commit the release job did not make is refused by name", () => {
  const repo = race();
  repo.git("checkout", "-q", "--detach", repo.R);
  const foreign = repo.commit("fix: three #ttv-1", { "CHANGELOG.md": "## Unreleased\n\n- **Fix**: three.\n\n" + repo.read("CHANGELOG.md"), "code.txt": "three\n" });
  repo.release("1.0.2");
  repo.git("checkout", "-q", "--detach", repo.L);
  assert.throws(
    () => repo.run("release-catch-up.mjs", "--changelog", "CHANGELOG.md", "--version-files", "package.json"),
    (error) => error.stderr.includes(foreign.slice(0, 7)) && error.stderr.includes("fix: three"),
  );
});

test("combining keeps older sections as the later commit has them and multi-line entries whole", () => {
  const development = parseChangelog("## Unreleased\n\n- **Fix**: two,\n  continued.\n- **Fix**: one.\n\n## 1.0.0\n\n- **Fix**: zero, corrected.\n");
  const release = parseChangelog("## 1.0.1\n\n- **Fix**: one.\n\n## 1.0.0\n\n- **Fix**: zero.\n");
  const lines = [];
  for (const section of combineChangelogs(development, release, "1.0.1").sections) lines.push(`## ${section.heading}`, ...section.lines);
  assert.equal(lines.join("\n"), "## Unreleased\n\n- **Fix**: two,\n  continued.\n\n## 1.0.1\n\n- **Fix**: one.\n\n## 1.0.0\n\n- **Fix**: zero, corrected.\n");
});
