// Writes a released server image into infra's docker-compose.yml.
//
// infra runs the server in two slots (server-a, server-b): one serves, and a
// release starts in the other, which then takes over (torrent-tv/meta#94). The
// image goes into the slot that is not serving. Which one serves is asked of
// the site — its /healthz names the slot and its state — and given here. When
// it is not known, the slot that names the older version is taken, since the
// newer version is the one that serves; two slots with one version, as right
// after they were created, can only be told apart by asking. With one server
// service its image is replaced, as before.
//
// Usage: node server-image.mjs <docker-compose.yml> <version> <sha256:digest> [serving slot]
// Exit 0: written. Exit 2: a version at least this one is already written.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { compareVersions } from "./lib.mjs";

const IMAGE = /^(\s+image:\s+ghcr\.io\/torrent-tv\/server:)([0-9.]+)(@sha256:[0-9a-f]{64})\s*$/;
const SERVICE = /^ {2}([A-Za-z0-9_-]+):\s*$/;

/**
 * @param {string} text - The compose file.
 * @param {string} version
 * @param {string} digest - sha256:…
 * @param {string} [servingSlot] - "a" or "b" when the site said which slot serves.
 * @returns {{ written: true, text: string, service: string, replaced: string } | { written: false, newest: string }}
 */
export function placeServerImage(text, version, digest, servingSlot = "") {
  const lines = text.split("\n");
  const images = [];
  let service = null;
  lines.forEach((raw, index) => {
    const line = raw.replace(/\r$/, "");
    const named = SERVICE.exec(line);
    if (named) service = named[1];
    const match = IMAGE.exec(line);
    if (match) images.push({ index, service, prefix: match[1], version: match[2] });
  });
  if (images.length === 0) throw new Error("docker-compose.yml names no pinned server image");
  const newest = images.reduce((a, b) => (compareVersions(b.version, a.version) > 0 ? b : a));
  if (compareVersions(newest.version, version) >= 0) return { written: false, newest: newest.version };
  const notServing = images.filter((image) => !servingSlot || image.service !== `server-${servingSlot}`);
  const candidates = notServing.length > 0 ? notServing : images;
  const target = candidates.reduce((a, b) => (compareVersions(b.version, a.version) < 0 ? b : a));
  const cr = lines[target.index].endsWith("\r") ? "\r" : "";
  lines[target.index] = `${target.prefix}${version}@${digest}${cr}`;
  return { written: true, text: lines.join("\n"), service: target.service, replaced: target.version };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [file, version, digest, servingSlot = ""] = process.argv.slice(2);
  if (!file || !version || !/^sha256:[0-9a-f]{64}$/.test(digest ?? "")) {
    throw new Error("usage: server-image.mjs <docker-compose.yml> <version> <sha256:digest> [serving slot]");
  }
  const result = placeServerImage(readFileSync(file, "utf8"), version, digest, servingSlot);
  if (!result.written) {
    console.log(`infra already runs server ${result.newest} (asked: ${version}); nothing to write`);
    process.exitCode = 2;
  } else {
    writeFileSync(file, result.text);
    console.log(`server ${version} written into ${result.service} in place of ${result.replaced}${servingSlot ? ` (slot ${servingSlot} serves)` : ""}`);
  }
}
