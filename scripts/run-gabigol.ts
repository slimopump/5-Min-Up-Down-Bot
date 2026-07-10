/**
 * Spawns one EarlyBird process per crypto asset for gabigol-style multi-market farming.
 *
 * Usage:
 *   npx tsx scripts/run-gabigol.ts
 *   npx tsx scripts/run-gabigol.ts --prod
 *   npx tsx scripts/run-gabigol.ts --window 15m
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ASSETS = ["btc", "eth", "sol", "xrp"] as const;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const windowArg = args.find((a) => a.startsWith("--window="));
const window = windowArg?.split("=")[1] ?? "5m";
const slotOffset =
  args.find((a) => a.startsWith("--slot-offset="))?.split("=")[1] ?? "1";

const runner = process.platform === "win32" ? "npx.cmd" : "npx";
const runnerArgs = ["tsx", "index.ts", "--strategy", "gabigol", "--slot-offset", slotOffset];

if (prod) {
  runnerArgs.push("--prod");
  process.env.FORCE_PROD = "true";
  process.env.PROD = "true";
}

const children: ReturnType<typeof spawn>[] = [];

for (const asset of ASSETS) {
  const child = spawn(runner, runnerArgs, {
    cwd: ROOT,
    env: {
      ...process.env,
      MARKET_ASSET: asset,
      MARKET_WINDOW: window,
    },
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    console.log(`[run-gabigol] ${asset} exited with code ${code ?? "?"}`);
  });

  children.push(child);
  console.log(`[run-gabigol] started ${asset}-updown-${window} (pid ${child.pid})`);
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
