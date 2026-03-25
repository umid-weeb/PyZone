import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "backend", "scripts", "seed_problems.py");
const extraArgs = process.argv.slice(2);

const candidates =
  process.platform === "win32"
    ? [
        ["py", ["-3", scriptPath, ...extraArgs]],
        ["python", [scriptPath, ...extraArgs]],
      ]
    : [
        ["python3", [scriptPath, ...extraArgs]],
        ["python", [scriptPath, ...extraArgs]],
      ];

for (const [command, args] of candidates) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  });

  if (!result.error) {
    process.exit(result.status ?? 0);
  }
}

console.error("No Python runtime was found. Install Python 3 or run the backend seeder directly.");
process.exit(1);
