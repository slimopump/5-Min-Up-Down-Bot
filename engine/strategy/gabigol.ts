import type { Strategy, StrategyContext } from "./types.ts";
import { clipShares, netEdgePerShare } from "./lib/fees.ts";
import { inBand, loadGabigolConfig, PRICE_BANDS } from "./lib/gabigol-config.ts";
import { MarketInventory, type Leg } from "./lib/inventory.ts";
import { inferLikelyWinner, type Side } from "./lib/winner-inference.ts";

function tokenForSide(ctx: StrategyContext, side: Side): string {
  return side === "UP" ? ctx.clobTokenIds[0] : ctx.clobTokenIds[1];
}

function placeFokBuy(
  ctx: StrategyContext,
  leg: Leg,
  side: Side,
  price: number,
  shares: number,
  inventory: MarketInventory,
  label: string,
  inFlight: { notional: number },
): boolean {
  const notional = price * shares;
  if (inFlight.notional + inventory.totalSpent + notional > inventory.marketCap) {
    return false;
  }
  if (!inventory.canSpend(leg, notional)) return false;

  inFlight.notional += notional;
  const tokenId = tokenForSide(ctx, side);
  ctx.postOrders([
    {
      req: {
        tokenId,
        action: "buy",
        price,
        shares,
        orderType: "FOK",
      },
      expireAtMs: ctx.slotEndMs,
      onFilled(filledShares) {
        const filledNotional = price * filledShares;
        inFlight.notional = Math.max(0, inFlight.notional - notional);
        inventory.record(leg, filledNotional);
        ctx.log(
          `[${ctx.slug}] gabigol ${label}: BUY ${side} FOK @ ${price.toFixed(3)} (${filledShares} sh, $${filledNotional.toFixed(2)})`,
          "green",
        );
      },
      onFailed() {
        inFlight.notional = Math.max(0, inFlight.notional - notional);
      },
    },
  ]);
  return true;
}

export const gabigol: Strategy = async (ctx) => {
  const cfg = loadGabigolConfig();
  const inventory = new MarketInventory(
    cfg.MARKET_CAP,
    cfg.LOTTERY_CAP,
    cfg.MID_CAP,
  );

  ctx.blockSells();
  const releaseLock = ctx.hold();
  const inFlight = { notional: 0 };

  const tickInterval = setInterval(() => {
    const remaining = Math.floor((ctx.slotEndMs - Date.now()) / 1000);

    if (remaining <= 0) {
      clearInterval(tickInterval);
      releaseLock();
      return;
    }

    const openPrice = ctx.getMarketResult()?.openPrice;
    if (openPrice === undefined) return;

    const spot = ctx.ticker.price ?? ctx.ticker.binancePrice;
    if (spot === undefined) return;

    const inference = inferLikelyWinner(spot, openPrice, cfg.MIN_GAP_USD);
    if (!inference) return;

    const { winner, loser } = inference;
    const winnerAsk = ctx.orderBook.bestAskInfo(winner);
    const loserAsk = ctx.orderBook.bestAskInfo(loser);

    // --- Scanner B: Lottery (cheaper / likely-losing side) ---
    if (
      remaining >= cfg.LOTTERY_MIN_SECS &&
      remaining <= cfg.LOTTERY_MAX_SECS &&
      loserAsk &&
      inBand(loserAsk.price, PRICE_BANDS.lottery) &&
      loserAsk.liquidity >= cfg.MIN_SHARES
    ) {
      const shares = clipShares(
        cfg.LOTTERY_CLIP_NOTIONAL,
        loserAsk.price,
        cfg.MIN_SHARES,
      );
      placeFokBuy(
        ctx,
        "lottery",
        loser,
        loserAsk.price,
        shares,
        inventory,
        "lottery",
        inFlight,
      );
    }

    // --- Scanner A: Convergence (likely winner, endgame) ---
    const inConvergenceWindow = remaining <= cfg.CONVERGENCE_MAX_SECS;
    let convergenceActive = false;

    if (
      inConvergenceWindow &&
      winnerAsk &&
      inBand(winnerAsk.price, PRICE_BANDS.convergence) &&
      netEdgePerShare(winnerAsk.price) >= cfg.MIN_EDGE &&
      winnerAsk.liquidity >= cfg.MIN_SHARES
    ) {
      convergenceActive = true;
      const shares = clipShares(
        cfg.CLIP_NOTIONAL,
        winnerAsk.price,
        cfg.MIN_SHARES,
      );
      const clipNotional = winnerAsk.price * shares;

      let burst = 0;
      while (
        burst < cfg.BURST_PER_TICK &&
        inventory.canSpend("convergence", clipNotional)
      ) {
        const placed = placeFokBuy(
          ctx,
          "convergence",
          winner,
          winnerAsk.price,
          shares,
          inventory,
          "convergence",
          inFlight,
        );
        if (!placed) break;
        burst++;
      }
    }

    // --- Scanner C: Mid conviction (directional, lower priority) ---
    if (
      !convergenceActive &&
      winnerAsk &&
      inBand(winnerAsk.price, PRICE_BANDS.mid) &&
      winnerAsk.liquidity >= cfg.MIN_SHARES
    ) {
      const shares = clipShares(
        cfg.MID_CLIP_NOTIONAL,
        winnerAsk.price,
        cfg.MIN_SHARES,
      );
      placeFokBuy(
        ctx,
        "mid",
        winner,
        winnerAsk.price,
        shares,
        inventory,
        "mid",
        inFlight,
      );
    }
  }, cfg.TICK_MS);

  return () => {
    clearInterval(tickInterval);
    releaseLock();
  };
};
