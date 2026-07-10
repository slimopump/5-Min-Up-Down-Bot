/**
 * Wrap USDC.e -> pUSD or unwrap pUSD -> USDC.e via the Polymarket relayer.
 * Uses the proxy/funder wallet (POLY_FUNDER_ADDRESS) as the recipient.
 *
 * Usage:
 *   bun scripts/pusd.ts wrap                  # interactive amount prompt
 *   bun scripts/pusd.ts wrap   --amount 100
 *   bun scripts/pusd.ts unwrap --amount 100
 *   bun scripts/pusd.ts wrap   --amount 100 --dry-run
 */

import { createInterface } from "readline/promises";
import { Command } from "commander";
import { formatUnits, parseUnits } from "viem";
import { Env } from "../utils/config.ts";
import { PolymarketEarlyBirdClient } from "../engine/client.ts";

const USDCE = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
const PUSD = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB" as const;

async function resolveAmount(
  cliAmount: string | undefined,
  tokenLabel: string,
  fetchBalance: () => Promise<bigint>,
): Promise<bigint> {
  if (cliAmount) return parseUnits(cliAmount, 6);

  const balance = await fetchBalance();
  const balanceHuman = formatUnits(balance, 6);
  console.log(`${tokenLabel} balance: ${balanceHuman}`);

  if (balance === 0n) {
    console.error(`No ${tokenLabel} balance to use.`);
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (
      await rl.question(
        `Amount to use (press Enter for full balance, or type a number): `,
      )
    ).trim();
    if (answer === "") return balance;
    const amount = parseUnits(answer, 6);
    if (amount <= 0n) {
      console.error("Amount must be > 0");
      process.exit(1);
    }
    if (amount > balance) {
      console.error(`Amount ${answer} exceeds balance ${balanceHuman}`);
      process.exit(1);
    }
    return amount;
  } finally {
    rl.close();
  }
}

function getFunder(): `0x${string}` {
  const funder = Env.get("POLY_FUNDER_ADDRESS");
  if (!funder) {
    console.error("POLY_FUNDER_ADDRESS env var must be set");
    process.exit(1);
  }
  return funder as `0x${string}`;
}

const program = new Command()
  .description(
    "Wrap USDC.e -> pUSD or unwrap pUSD -> USDC.e via Polymarket relayer",
  )
  .option("--dry-run", "Print action without submitting");

program
  .command("wrap")
  .description("Wrap USDC.e into pUSD")
  .option(
    "--amount <amount>",
    "Amount in human units (e.g. 100 = 100 USDC.e). Prompts if omitted.",
  )
  .action(async (opts: { amount?: string }) => {
    const dryRun = (program.opts<{ dryRun?: boolean }>().dryRun ?? false) as boolean;
    const funder = getFunder();
    const client = new PolymarketEarlyBirdClient();
    const amount = await resolveAmount(
      opts.amount,
      "USDC.e",
      () => client.getTokenBalance(USDCE),
    );
    const human = formatUnits(amount, 6);
    console.log(`Wrapping ${human} USDC.e -> pUSD for ${funder}`);
    if (dryRun) {
      console.log(`DRY RUN — would wrap ${human} USDC.e -> pUSD`);
      return;
    }
    await client.wrapUSDC(amount);
    console.log(`Done: wrap ${human} USDC.e -> pUSD`);
  });

program
  .command("unwrap")
  .description("Unwrap pUSD into USDC.e")
  .option(
    "--amount <amount>",
    "Amount in human units (e.g. 100 = 100 pUSD). Prompts if omitted.",
  )
  .action(async (opts: { amount?: string }) => {
    const dryRun = (program.opts<{ dryRun?: boolean }>().dryRun ?? false) as boolean;
    const funder = getFunder();
    const client = new PolymarketEarlyBirdClient();
    const amount = await resolveAmount(
      opts.amount,
      "pUSD",
      () => client.getTokenBalance(PUSD),
    );
    const human = formatUnits(amount, 6);
    console.log(`Unwrapping ${human} pUSD -> USDC.e for ${funder}`);
    if (dryRun) {
      console.log(`DRY RUN — would unwrap ${human} pUSD -> USDC.e`);
      return;
    }
    await client.unwrapUSDC(amount);
    console.log(`Done: unwrap ${human} pUSD -> USDC.e`);
  });

await program.parseAsync();
