import assert from "node:assert/strict";
import { test } from "node:test";
import { placeServerImage } from "../scripts/server-image.mjs";

const digest = (n) => `sha256:${String(n).repeat(64).slice(0, 64)}`;
const slots = (a, b) => [
  "services:",
  "  server-a:",
  "    <<: *server",
  `    image: ghcr.io/torrent-tv/server:${a}@${digest(1)}`,
  "  server-b:",
  "    <<: *server",
  `    image: ghcr.io/torrent-tv/server:${b}@${digest(2)}`,
  ""
].join("\n");

test("a release goes into the slot with the older version when nobody said which serves", () => {
  const result = placeServerImage(slots("0.40.0", "0.41.0"), "0.42.0", digest(3));
  assert.equal(result.written, true);
  assert.equal(result.service, "server-a");
  assert.ok(result.text.includes(`server:0.42.0@${digest(3)}`));
  assert.ok(result.text.includes(`server:0.41.0@${digest(2)}`));
});

test("versions compare by number", () => {
  assert.equal(placeServerImage(slots("0.10.0", "0.9.0"), "0.11.0", digest(3)).service, "server-b");
});

test("the slot the site says serves is never replaced, also between equal versions", () => {
  assert.equal(placeServerImage(slots("0.41.0", "0.41.0"), "0.42.0", digest(3), "a").service, "server-b");
  assert.equal(placeServerImage(slots("0.41.0", "0.41.0"), "0.42.0", digest(3), "b").service, "server-a");
});

test("a version already written, or an older one, is not written", () => {
  assert.deepEqual(placeServerImage(slots("0.40.0", "0.41.0"), "0.41.0", digest(3), "b"), { written: false, newest: "0.41.0" });
  assert.deepEqual(placeServerImage(slots("0.40.0", "0.41.0"), "0.40.5", digest(3)), { written: false, newest: "0.41.0" });
});

test("one server service has its image replaced, line endings kept", () => {
  const text = `services:\r\n  server:\r\n    image: ghcr.io/torrent-tv/server:0.40.0@${digest(1)}\r\n`;
  const result = placeServerImage(text, "0.41.0", digest(2), "solo");
  assert.equal(result.text, `services:\r\n  server:\r\n    image: ghcr.io/torrent-tv/server:0.41.0@${digest(2)}\r\n`);
});

test("a file with no pinned server image is an error", () => {
  assert.throws(() => placeServerImage("services: {}\n", "0.41.0", digest(1)));
});
