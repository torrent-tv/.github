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
  const text = readFileSync(file, "utf8");
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
  const lines = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n");
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
