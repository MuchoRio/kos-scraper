import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = process.env.PYTHON_BIN
  ? [process.env.PYTHON_BIN]
  : process.platform === "win32"
    ? ["python", "python3"]
    : ["python3", "python"];

let pyBin = null;
for (const bin of candidates) {
  const probe = spawnSync(bin, ["--version"], { stdio: "ignore" });
  if (probe.status === 0) {
    pyBin = bin;
    break;
  }
}

if (!pyBin) {
  console.error("Python 3 interpreter not found. Set PYTHON_BIN or install python3.");
  process.exit(1);
}

const res = spawnSync(pyBin, ["-m", "unittest", "discover", "-s", "tests/python", "-v"], {
  cwd: rootDir,
  stdio: "inherit",
});
process.exit(res.status ?? 1);

