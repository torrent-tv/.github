import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Whether npm serves both the version metadata and its package archive. */
export function npmPackageReady(spec, run = spawnSync, makeTempDir = mkdtempSync) {
  const version = spec.slice(spec.lastIndexOf("@") + 1);
  if (!version) return false;
  const metadata = run("npm", ["view", spec, "version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (metadata.status !== 0 || metadata.stdout?.trim() !== version) return false;

  const destination = makeTempDir(join(tmpdir(), "npm-package-ready-"));
  try {
    const packed = run("npm", ["pack", "--json", "--pack-destination", destination, spec], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
    });
    if (packed.status !== 0) return false;
    const [result] = JSON.parse(packed.stdout);
    return typeof result?.filename === "string" && existsSync(join(destination, result.filename));
  } catch {
    return false;
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = npmPackageReady(process.argv[2]) ? 0 : 1;
}
