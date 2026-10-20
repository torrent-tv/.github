import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Whether npm serves both the version metadata and its package archive. */
export function npmPackageReady(spec, run = spawnSync) {
  const version = spec.slice(spec.lastIndexOf("@") + 1);
  if (!version) return false;
  const metadata = run("npm", ["view", spec, "version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (metadata.status !== 0 || metadata.stdout?.trim() !== version) return false;
  return run("npm", ["pack", "--dry-run", "--json", spec], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]
  }).status === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = npmPackageReady(process.argv[2]) ? 0 : 1;
}
