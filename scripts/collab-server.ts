/**
 * Local TS entry kept for editors/IDE. Production and `npm run dev:collab`
 * use `scripts/collab-server.cjs` (plain Node, no tsx).
 *
 * Prefer editing collab-server.cjs when changing collab behavior.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(here, "collab-server.cjs")], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
