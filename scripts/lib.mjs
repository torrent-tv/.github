// Shared helpers for the release and check scripts of every torrent-tv repository.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

export const TYPES = ["feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "style", "revert"];

const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^()\r\n]+)\))?(?<breaking>!)?: (?<subject>\S.*)$/;

/** Parses a Conventional Commits header; returns null when it does not conform. */
export function parseHeader(header) {
  const match = HEADER.exec(header);
  if (!match || !TYPES.includes(match.groups.type)) return null;
  return { type: match.groups.type, scope: match.groups.scope ?? null, breaking: Boolean(match.groups.breaking) };
}

/**
 * Every task is an issue of torrent-tv/meta. A commit header ends with
 * ` #ttv-<issue number>`; each repository autolinks `ttv-<number>` to that issue.
 */
const TASK = /\s#ttv-(?<number>[1-9][0-9]*)$/;

/** The meta issue number a header refers to, or null when it names none. */
export function taskOf(header) {
  const match = TASK.exec(header);
  return match ? Number(match.groups.number) : null;
}

/** The identity of commits made by our own workflows, which carry no task. */
export const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";

const BRANCH = new RegExp(`^(?:${TYPES.join("|")})/ttv-[1-9][0-9]*-[a-z0-9][a-z0-9.-]*$`);

/** A working branch is `<type>/ttv-<issue number>-<description>`. */
export function isTaskBranch(name) {
  return BRANCH.test(name);
}

/** A commit made by the release job itself never starts another release. */
export function isReleaseCommit(header) {
  return /^chore\(release\): /.test(header);
}

const RANK = { none: 0, patch: 1, minor: 2 };

/**
 * The version step a set of commits asks for. feat gives minor; fix, perf and
 * revert give patch; everything else gives none. A breaking change gives minor,
 * because the project does not publish major versions for now.
 */
export function bumpOf(messages) {
  let bump = "none";
  for (const message of messages) {
    const [header, ...rest] = message.split("\n");
    if (isReleaseCommit(header)) continue;
    const parsed = parseHeader(header);
    if (!parsed) continue;
    const breaking = parsed.breaking || /^BREAKING[ -]CHANGE: /m.test(rest.join("\n"));
    let step = "none";
    if (parsed.type === "feat" || breaking) step = "minor";
    else if (["fix", "perf", "revert"].includes(parsed.type)) step = "patch";
    if (RANK[step] > RANK[bump]) bump = step;
  }
  return bump;
}

/** Negative, zero or positive as a is below, equal to or above b (x.y.z). */
export function compareVersions(a, b) {
  const left = String(a).split(".").map(Number);
  const right = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return (left[i] || 0) - (right[i] || 0);
  }
  return 0;
}

export function nextVersion(version, bump) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  return version;
}

export function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** The newest release tag reachable from HEAD, or null when there is none. */
export function lastTag() {
  try {
    return git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
  } catch {
    return null;
  }
}

/** Full messages and author emails of the non-merge commits in a range, oldest first. */
export function messagesIn(range) {
  const raw = git("log", "--no-merges", "--reverse", "--format=%H%x1f%ae%x1f%B%x1e", range);
  return raw
    .split("\x1e")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, email, message] = entry.split("\x1f");
      return { sha, email, message: message.trim() };
    });
}

export function readVersion(file) {
  return versionIn(readFileSync(file, "utf8"), file);
}

/** The version a version file's text states; the file name says how it is written. */
export function versionIn(text, file) {
  if (file.endsWith(".json")) return JSON.parse(text).version;
  const match = /^version:\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?\s*$/m.exec(text);
  if (!match) throw new Error(`${file} states no version`);
  return match[1];
}

export function writeVersion(file, version) {
  const text = readFileSync(file, "utf8");
  if (file.endsWith(".json")) {
    const data = JSON.parse(text);
    data.version = version;
    if (data.packages?.[""]) data.packages[""].version = version;
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  writeFileSync(file, text.replace(/^version:\s*"?[0-9]+\.[0-9]+\.[0-9]+"?\s*$/m, `version: "${version}"`));
}

/** Reads `--name value` pairs from the command line. */
export function options(argv = process.argv.slice(2)) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const name = argv[i].slice(2);
    const value = argv[i + 1] === undefined || argv[i + 1].startsWith("--") ? "true" : argv[++i];
    result[name] = value;
  }
  return result;
}

export function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  console.log(`${name}=${value}`);
}

export function fail(message) {
  console.log(`::error::${message}`);
  process.exitCode = 1;
}

/** The changelog split into its leading text and its `## ` sections. */
export function readChangelog(file) {
  return parseChangelog(readFileSync(file, "utf8"));
}

export function parseChangelog(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  const head = [];
  for (const line of lines) {
    if (line.startsWith("## ")) sections.push({ heading: line.slice(3).trim(), lines: [] });
    else if (sections.length) sections.at(-1).lines.push(line);
    else head.push(line);
  }
  return { head, sections };
}

export function writeChangelog(file, { head, sections }) {
  const parts = [...head];
  for (const section of sections) parts.push(`## ${section.heading}`, ...section.lines);
  writeFileSync(file, parts.join("\n"));
}

export function hasEntries(section) {
  return section.lines.some((line) => line.trim().startsWith("- "));
}

/** The entries of a section: each `- ` line with the lines that continue it. */
export function entriesOf(section) {
  const entries = [];
  for (const line of section?.lines ?? []) {
    if (line.startsWith("- ")) entries.push([line]);
    else if (line.trim() && entries.length) entries.at(-1).push(line);
  }
  return entries.map((lines) => lines.join("\n"));
}

/**
 * The changelog of a later commit of main once the release `version` is merged into it.
 * The later commit's changelog is kept, except that the entries the release published
 * leave "## Unreleased" for the "## <version>" section the release wrote. Entries are
 * compared by their exact text, so a released entry that a later commit edited stays
 * pending as a new one.
 */
export function combineChangelogs(development, release, version) {
  const shipped = release.sections.find((section) => section.heading === version);
  if (!shipped) throw new Error(`the release changelog has no "## ${version}" section`);
  if (development.sections.some((section) => section.heading === version)) return development;
  const [first, ...rest] = development.sections;
  const unreleased = first?.heading === "Unreleased" ? first : null;
  const published = new Set(entriesOf(shipped));
  const pending = entriesOf(unreleased).filter((entry) => !published.has(entry));
  const sections = [];
  if (pending.length) sections.push({ heading: "Unreleased", lines: ["", ...pending.flatMap((entry) => entry.split("\n")), ""] });
  const lines = [...shipped.lines];
  if (lines.at(-1) !== "") lines.push("");
  sections.push({ heading: version, lines }, ...(unreleased ? rest : development.sections));
  return { head: development.head, sections };
}

/** Whether commit a is in the history of commit b. */
export function isAncestor(a, b) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", a, b]);
    return true;
  } catch (error) {
    if (error.status === 1) return false;
    throw error;
  }
}

/**
 * Merges the release commit `release` into the commit checked out: a later commit of main
 * that was pushed before the release commit existed. A textual merge of the changelog puts
 * the later commit's entries under the released heading (torrent-tv/meta#126), so the merge
 * is built instead from the files of the commit checked out, the version of the release and
 * the changelog combineChangelogs gives. That holds only while every commit the release
 * brings is the release job's own: its release commit, which changes nothing but the
 * changelog and the version files, and its merges. Anything else is refused by name.
 * Returns the released version.
 */
export function mergeRelease({ release, changelog, versionFiles }) {
  const version = versionIn(git("show", `${release}:${versionFiles[0]}`), versionFiles[0]);
  const subject = git("log", "-1", "--format=%s", release);
  if (subject !== `chore(release): ${version}`) throw new Error(`${release} is "${subject}", not the release commit of ${version}`);
  const allowed = new Set([changelog, ...versionFiles]);
  const foreign = git("diff", "--name-only", `${release}^`, release)
    .split("\n")
    .filter((file) => file && !allowed.has(file));
  if (foreign.length) throw new Error(`the release commit of ${version} changes ${foreign.join(", ")} besides the changelog and the version files`);
  for (const line of git("log", "--format=%h%x1f%ae%x1f%p%x1f%s", `HEAD..${release}`).split("\n").filter(Boolean)) {
    const [sha, email, parents, header] = line.split("\x1f");
    const own = email === BOT_EMAIL && (isReleaseCommit(header) || parents.includes(" "));
    if (!own) throw new Error(`${sha} "${header}" is in ${version} and not in HEAD, and the release job did not make it; merge ${release} by hand`);
  }
  const released = parseChangelog(git("show", `${release}:${changelog}`));
  git("merge", "--quiet", "--no-ff", "--no-commit", "-s", "ours", release);
  for (const file of versionFiles) writeVersion(file, version);
  writeChangelog(changelog, combineChangelogs(readChangelog(changelog), released, version));
  git("add", changelog, ...versionFiles);
  git("commit", "-q", "-m", `chore(release): merge ${version} into main`);
  return version;
}
