# Migration Guide — clob-client-v2

This guide covers the one-time steps required after upgrading the engine's dependency from `@polymarket/clob-client` to `@polymarket/clob-client-v2`. The only meaningful change for operators is the collateral currency: the v2 CLOB settles in **pUSD** instead of raw USDC.e. Once your funder wallet's balance is in pUSD the engine runs exactly as before.

---

## What Changed

| | v1 | v2 |
|---|---|---|
| Collateral token | USDC.e (`0x2791…`) | pUSD (`0xC011…`) |
| Deposit/withdraw | Direct USDC.e | Wrap USDC.e → pUSD first |
| Order API | `@polymarket/clob-client` | `@polymarket/clob-client-v2` |
| Engine behaviour | unchanged | unchanged |

---

## Step 1 — Wrap USDC.e → pUSD

Your funder wallet holds USDC.e from the previous collateral scheme. The engine will not be able to place orders until that balance is wrapped into pUSD. Do this once.

### Option A — pusd script (recommended)

```bash
# Interactive — prompts for amount, defaults to full balance
bun scripts/pusd.ts wrap

# Non-interactive — wrap a specific amount
bun scripts/pusd.ts wrap --amount 100

# Dry-run — prints what would happen without sending transactions
bun scripts/pusd.ts wrap --amount 100 --dry-run
```

The script reads `PRIVATE_KEY`, `POLY_FUNDER_ADDRESS`, and `BUILDER_KEY/SECRET/PASSPHRASE` from `.env`. It submits two transactions through the Polymarket relayer: an ERC-20 `approve` followed by the `wrap` call on the on-ramp contract. No MATIC is required.

### Option B — Polymarket UI

1. Go to [polymarket.com](https://polymarket.com) and log in.
2. Look for a **"Balance migration"** banner or button, or open your profile and look for an **"Confirm pending deposit"** prompt at the top.
3. Follow the on-screen steps — Polymarket will wrap your existing USDC.e balance to pUSD automatically.

### Verify the balance

After wrapping, confirm the pUSD balance on your funder wallet before starting the engine:

```bash
# Run wrap without --amount to see the current USDC.e balance first,
# then Ctrl+C if you don't need to wrap more.
bun scripts/pusd.ts wrap
```

---

## Step 2 — Run the engine

No other changes are needed. Start the engine as usual:

```bash
# Simulation
bun run index.ts --rounds 10

# Production
bun run index.ts --prod
```

---

## Known Warning — "Could not create api key"

After upgrading to `clob-client-v2` you may see the following error in the console at startup:

```
[CLOB Client] request error {"status":400,"statusText":"Bad Request","data":{"error":"Could not create api key"},...}
```

**This is a benign warning, not a fatal error.** The v2 client attempts to derive an API key using a slightly different auth path than v1. The 400 response is returned when a key already exists for the signing address — the client falls back to using the existing key and continues normally. Order placement, fill tracking, and all other engine operations work correctly. You can safely ignore this message.

---

## Unwrapping pUSD → USDC.e

If you ever need to move funds out or revert to raw USDC.e:

```bash
bun scripts/pusd.ts unwrap --amount 100
```

This is the reverse operation: approves the off-ramp contract to spend pUSD, then calls `unwrap` to receive USDC.e back to the funder wallet.
