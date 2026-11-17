import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

const children = [
  spawn(npmCmd, ["--workspace=server", "run", "dev"], { cwd: rootDir, stdio: "inherit", shell: isWin }),
  spawn(npmCmd, ["--workspace=client", "run", "dev"], { cwd: rootDir, stdio: "inherit", shell: isWin }),
];

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (!exiting && code && code !== 0) shutdown(code);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

