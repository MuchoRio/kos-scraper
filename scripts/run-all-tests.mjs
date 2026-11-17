import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const steps = [
  ["node", ["scripts/run-python-tests.mjs"]],
  [npmCmd, ["--workspace=server", "run", "test"]],
  [npmCmd, ["--workspace=client", "run", "build"]],
];

for (const [cmd, args] of steps) {
  const res = spawnSync(cmd, args, { cwd: rootDir, stdio: "inherit", shell: isWin && cmd === npmCmd });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

