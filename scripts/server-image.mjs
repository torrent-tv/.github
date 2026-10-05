// Writes a released server image into infra's docker-compose.yml.
//
// infra may run the server in two slots (server-a, server-b): one serves, and
// a release starts in the other, which then takes over (torrent-tv/meta#94).
// The instance with the newer version serves, so the image goes into the slot
// that names the older version, and the serving one is left untouched. With
// one server service its image is replaced, as before.
//
// Usage: node server-image.mjs <docker-compose.yml> <version> <sha256:digest>
// Exit 0: written. Exit 2: a version at least this one is already written.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { compareVersions } from "./lib.mjs";

const IMAGE = /^(\s+image:\s+ghcr\.io\/torrent-tv\/server:)([0-9.]+)(@sha256:[0-9a-f]{64})\s*$/;

/**
 * @param {string} text - The compose file.
 * @param {string} version
 * @param {string} digest - sha256:…
 * @returns {{ written: true, text: string, replaced: string } | { written: false, newest: string }}
 */
export function placeServerImage(text, version, digest) {
  const lines = text.split("\n");
  const images = [];
  lines.forEach((line, index) => {
    const match = IMAGE.exec(line.replace(/\r$/, ""));
    if (match) images.push({ index, prefix: match[1], version: match[2] });
  });
  if (images.length === 0) throw new Error("docker-compose.yml names no pinned server image");
  const newest = images.reduce((a, b) => (compareVersions(b.version, a.version) > 0 ? b : a));
  if (compareVersions(newest.version, version) >= 0) return { written: false, newest: newest.version };
  const oldest = images.reduce((a, b) => (compareVersions(b.version, a.version) < 0 ? b : a));
  const cr = lines[oldest.index].endsWith("\r") ? "\r" : "";
  lines[oldest.index] = `${oldest.prefix}${version}@${digest}${cr}`;
  return { written: true, text: lines.join("\n"), replaced: oldest.version };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [file, version, digest] = process.argv.slice(2);
  if (!file || !version || !/^sha256:[0-9a-f]{64}$/.test(digest ?? "")) {
    throw new Error("usage: server-image.mjs <docker-compose.yml> <version> <sha256:digest>");
  }
  const result = placeServerImage(readFileSync(file, "utf8"), version, digest);
  if (!result.written) {
    console.log(`infra already runs server ${result.newest} (asked: ${version}); nothing to write`);
    process.exitCode = 2;
  } else {
    writeFileSync(file, result.text);
    console.log(`server ${version} written in place of ${result.replaced}`);
  }
}
