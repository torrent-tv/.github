import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { npmPackageReady } from "../scripts/npm-package-ready.mjs";

test("a package is ready only after npm serves the version archive", () => {
  const calls = [];
  const ready = npmPackageReady("@torrent-tv/proxy@2.102.4", (command, args) => {
    calls.push([command, args]);
    if (args[0] === "view") return { status: 0, stdout: "2.102.4\n" };
    const destination = args[args.indexOf("--pack-destination") + 1];
    writeFileSync(join(destination, "torrent-tv-proxy-2.102.4.tgz"), "archive");
    return { status: 0, stdout: JSON.stringify([{ filename: "torrent-tv-proxy-2.102.4.tgz" }]) };
  });
  assert.equal(ready, true);
  assert.deepEqual(calls.map(([, args]) => args), [
    ["view", "@torrent-tv/proxy@2.102.4", "version"],
    ["pack", "--json", "--pack-destination", calls[1][1][3], "@torrent-tv/proxy@2.102.4"]
  ]);
});

test("a missing version or tarball is not ready", () => {
  const calls = [];
  assert.equal(npmPackageReady("@torrent-tv/proxy@2.102.4", (command, args) => {
    calls.push(args);
    return { status: 0, stdout: "2.102.3\n" };
  }), false);
  assert.deepEqual(calls, [["view", "@torrent-tv/proxy@2.102.4", "version"]]);

  assert.equal(npmPackageReady("@torrent-tv/proxy@2.102.4", (_command, args) =>
    args[0] === "view" ? { status: 1, stdout: "2.102.4\n" } : { status: 0, stdout: "[]" }), false);

  assert.equal(npmPackageReady("@torrent-tv/proxy@2.102.4", (_command, args) =>
    args[0] === "view" ? { status: 0, stdout: "2.102.4\n" } : { status: 1, stdout: "" }), false);

  assert.equal(npmPackageReady("@torrent-tv/proxy@2.102.4", (_command, args) =>
    args[0] === "view" ? { status: 0, stdout: "2.102.4\n" } : { status: 0, stdout: "[]" }), false);
});
