import { Command } from "commander";
import { loadState, saveState } from "../engine/state.ts";

const program = new Command()
  .description("Reset persisted engine state for simulation or production")
  .option("--prod", "Reset production state (state/early-bird-prod.json)")
  .option(
    "--active-markets",
    "Also clear the activeMarkets array (in addition to sessionPnl, sessionLoss, completedMarkets)",
  )
  .parse();

const opts = program.opts<{ prod?: boolean; activeMarkets?: boolean }>();

const statePath = opts.prod
  ? "state/early-bird-prod.json"
  : "state/early-bird.json";

const existing = loadState(statePath);

if (!existing) {
  console.error(`No state file found at ${statePath}. Nothing to reset.`);
  process.exit(1);
}

const updated = {
  ...existing,
  sessionPnl: 0,
  sessionLoss: 0,
  completedMarkets: [],
  ...(opts.activeMarkets ? { activeMarkets: [] } : {}),
};

saveState(statePath, updated);

const cleared = ["sessionPnl", "sessionLoss", "completedMarkets"];
if (opts.activeMarkets) cleared.push("activeMarkets");

console.log(`Reset ${statePath}:`);
for (const field of cleared) console.log(`  ${field} → cleared`);
