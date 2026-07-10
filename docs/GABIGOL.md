# Gabigol Strategy

High-frequency, buy-only crypto Up/Down farming inspired by observed [gabigol](https://polymarket.com/@gabigol) behavior. **Not financial advice.**

## Architecture

One `gabigol` strategy runs inside the [polymarket-trade-engine](https://github.com/KaustubhPatange/polymarket-trade-engine) lifecycle per process. Three scanners run concurrently on each 5m/15m slot:

| Scanner | Window | Price band | Role |
|---------|--------|------------|------|
| **Convergence** | Last `GABIGOL_CONVERGENCE_MAX_SECS` (default 120s) | 94–99.5¢ on likely winner | Endgame FOK bursts (~$2 clips) |
| **Lottery** | `60–280s` remaining | 3–30¢ on likely loser | Cheap tail tickets (~$1.50) |
| **Mid** | Rest of slot (when convergence inactive) | 30–94¢ on likely winner | Directional fills |

- **No sells** — `ctx.blockSells()`; PnL from redemption at resolution.
- **Winner inference** — CEX spot (`TICKER`) vs slot open price (price to beat).
- **FOK only** — immediate taker fills; fee-aware edge gate on convergence.

## Quick start

```bash
cp .env.example .env
# Edit .env with keys for production

# Simulation (single asset)
npx tsx index.ts --strategy gabigol --slot-offset 1 --rounds 20 --always-log

# Multi-asset fleet (btc + eth + sol + xrp)
npx tsx scripts/run-gabigol.ts

# Production (after simulation)
npx tsx scripts/run-gabigol.ts --prod
npx tsx scripts/redeem.ts   # periodic batch redeem backup
```

> **Runtime:** Each round is one full 5m (or 15m) market slot in real time. Twenty 5m rounds ≈ 100 minutes.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GABIGOL_CLIP_NOTIONAL` | `2.0` | Convergence clip size (USD) |
| `GABIGOL_MIN_SHARES` | `5` | Minimum shares per FOK order |
| `GABIGOL_MARKET_CAP` | `200` | Max spend per market (all legs) |
| `GABIGOL_LOTTERY_CAP` | `30` | Max lottery spend per market |
| `GABIGOL_MID_CAP` | `50` | Max mid-leg spend per market |
| `GABIGOL_LOTTERY_CLIP_NOTIONAL` | `1.5` | Lottery clip (USD) |
| `GABIGOL_MID_CLIP_NOTIONAL` | `1.5` | Mid clip (USD) |
| `GABIGOL_MIN_EDGE` | `0.005` | Min net edge per share for convergence |
| `GABIGOL_CONVERGENCE_MAX_SECS` | `120` | Endgame convergence window |
| `GABIGOL_LOTTERY_MIN_SECS` | `60` | Lottery window start |
| `GABIGOL_LOTTERY_MAX_SECS` | `280` | Lottery window end |
| `GABIGOL_BURST_PER_TICK` | `3` | Max FOK orders per tick (convergence) |
| `GABIGOL_MIN_GAP_USD` | `0` | Min \|spot − open\| for trading (0 = pure gabigol) |
| `GABIGOL_TICK_MS` | `100` | Strategy tick interval |

Also see engine vars: `TICKER`, `MARKET_ASSET`, `MARKET_WINDOW`, `MAX_SESSION_LOSS`, `PRIVATE_KEY`, `POLY_FUNDER_ADDRESS`, builder relayer creds.

## File layout

```
engine/strategy/gabigol.ts          # Main strategy
engine/strategy/lib/fees.ts         # Taker fee + edge math
engine/strategy/lib/gabigol-config.ts
engine/strategy/lib/inventory.ts    # Per-market spend caps
engine/strategy/lib/winner-inference.ts
scripts/run-gabigol.ts              # Multi-asset launcher
```

## Simulation checklist

After `--rounds 20 --always-log`, inspect `logs/early-bird-btc-updown-5m-*.log`:

- [ ] Buy orders at 94–99¢ in final ~120s (convergence)
- [ ] Buy orders at 3–30¢ mid-slot (lottery)
- [ ] **Zero** sell orders
- [ ] Per-market spend stays under `GABIGOL_MARKET_CAP`

```bash
npx tsx scripts/chart.ts logs/early-bird-btc-updown-5m-*.log --open
```

## Production checklist

- [ ] Fund proxy wallet with **pUSD** (`docs/MIGRATE_V2.md`)
- [ ] Set `PRIVATE_KEY`, `POLY_FUNDER_ADDRESS`, `BUILDER_*` in `.env`
- [ ] Run ≥10 simulation rounds with expected burst/lottery patterns
- [ ] Set `MAX_SESSION_LOSS` to your risk tolerance
- [ ] Use `npx tsx scripts/run-gabigol.ts --prod` for multi-asset
- [ ] Schedule `npx tsx scripts/redeem.ts` after sessions

## Risks

1. **Fee erosion** — 99¢ → $1 is ~1% gross; taker fees can consume most of that without rebates.
2. **Wrong-side 99¢** — Late slot flips cause near-total loss on convergence leg.
3. **Both-side exposure** — Lottery + convergence in same slot can net small win + total loss.
4. **Capital lock** — Thousands of overlapping positions need float for continuous bursting.
5. **Competition** — Edge may compress as more bots farm 5m books.

Tune `GABIGOL_MIN_GAP_USD` and `GABIGOL_MIN_EDGE` to reduce wrong-side convergence at the cost of fewer fills.
