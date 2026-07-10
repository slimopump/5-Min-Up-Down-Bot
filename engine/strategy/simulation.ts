import type { Strategy } from "./types.ts";
import { Env } from "../../utils/config.ts";

// ---------------------------------------------------------------------------
// Simulation Strategy
//
// This strategy is intentionally kept simple and is designed purely for
// simulation / paper-trading. It walks through the core ctx API so you can
// understand how to build your own strategy.
//
// Flow:
//   1. Immediately place a buy order at 0.49 on the UP side.
//   2. When the buy fills, place a take-profit sell at 0.70 with expireAtMs
//      set to 30 s before slot end.
//   3. If the sell hasn't filled by then, onExpired fires and triggers an
//      emergency sell to exit at the best available bid.
// ---------------------------------------------------------------------------

export const simulationStrategy: Strategy = async (ctx) => {
  // ── Prod guard ────────────────────────────────────────────────────────────
  // This strategy is specially designed for simulation only. If you still
  // want to run it in production, remove this block and make the necessary
  // changes to the strategy logic as per your needs.
  if (Env.get("PROD")) {
    ctx.log(
      "[simulation] This strategy is specially designed for simulation only. " +
        "If you still want to run it in production, remove this guard and make " +
        "the necessary changes to the strategy logic as per your needs.",
      "red",
    );
    process.exit(1);
  }

  // clobTokenIds[0] = UP side token, clobTokenIds[1] = DOWN side token.
  // We trade the UP side throughout this example.
  const upTokenId = ctx.clobTokenIds[0];

  // The strategy is invoked before the market window opens — we are always
  // running ahead of time (slot offset >= 1). The actual market window opens
  // at slotEndMs - 300_000 (i.e. 5 minutes before slot end).
  // Schedule a log for when that moment arrives.
  const marketOpenMs = ctx.slotEndMs - 300_000;
  const msUntilOpen = marketOpenMs - Date.now();

  // ── Cleanup ───────────────────────────────────────────────────────────────
  //
  // The Strategy type optionally returns a cleanup function, similar to the
  // return value of React's useEffect. The lifecycle calls it when the market
  // is destroyed — whether it resolved normally, was force-stopped, or the
  // session exited early due to a loss limit.
  //
  // Use this to clear any timers or intervals your strategy created so they
  // don't fire after the market is gone (stale ctx references, phantom logs).
  //
  // Collect timer handles here so the cleanup function can cancel them all.
  const timers: NodeJS.Timeout[] = [];

  timers.push(
    setTimeout(() => {
      ctx.log(
        `[simulation] market window open — slot ends at ${new Date(ctx.slotEndMs).toISOString()}`,
        "cyan",
      );
    }, msUntilOpen),
  );

  // ── Step 1 — place a buy order immediately ───────────────────────────────
  //
  // postOrders() is fire-and-forget — it returns immediately.
  // Never use its return value to confirm placement; use the callbacks below.
  // Buys are silently dropped if the engine has blocked buys (e.g. too close
  // to slot end), so always handle onExpired / onFailed defensively.
  ctx.postOrders([
    {
      req: {
        tokenId: upTokenId,
        action: "buy",
        price: 0.49,
        shares: 5,
      },

      // The order is automatically cancelled if it hasn't filled when 100s is remaining for market end.
      expireAtMs: ctx.slotEndMs - 100_000,

      // ── Step 2 — buy filled: place a take-profit sell ──────────────────
      //
      // filledShares may differ from the requested amount when the order is
      // partially filled, so always use the value provided here rather than
      // the original shares constant.
      onFilled(filledShares) {
        ctx.log(
          `[simulation] BUY filled — ${filledShares} shares @ 0.49`,
          "green",
        );

        // ── Step 3 — place a take-profit sell, expiring 30 s before close ──
        //
        // Setting expireAtMs to slotEndMs - 30_000 means the engine will
        // automatically cancel this order if it hasn't filled with 30 seconds
        // still on the clock. That triggers onExpired while there is still
        // time to exit cleanly via an emergency sell.
        ctx.postOrders([
          {
            req: {
              tokenId: upTokenId,
              action: "sell",
              price: 0.7,
              shares: filledShares,
            },
            expireAtMs: ctx.slotEndMs,

            onFilled() {
              ctx.log(
                "[simulation] SELL filled @ 0.70 — trade complete",
                "green",
              );
            },

            onFailed(reason) {
              ctx.log(`[simulation] sell failed (${reason})`, "red");
            },
          },
        ]);

        // Emergency sell 30s before slot end — the order is still pending
        // at this point so emergencySells() can cancel-and-replace it.
        const msUntilEmergency = ctx.slotEndMs - 30_000 - Date.now();
        if (msUntilEmergency > 0) {
          // Track this timer so cleanup can cancel it if the market is
          // destroyed before it fires (e.g. session loss limit hit).
          timers.push(
            setTimeout(() => {
              const pendingSellIds = ctx.pendingOrders
                .filter((o) => o.action === "sell")
                .map((o) => o.orderId);

              if (pendingSellIds.length > 0) {
                ctx.log(
                  "[simulation] sell not filled — 30 s remaining, triggering emergency sell",
                  "red",
                );
                ctx.emergencySells(pendingSellIds);
              }
            }, msUntilEmergency),
          );
        }
      },

      onExpired() {
        ctx.log("[simulation] buy expired without fill", "yellow");
      },

      onFailed(reason) {
        ctx.log(`[simulation] buy failed (${reason})`, "red");
      },
    },
  ]);

  // Return the cleanup function. The lifecycle calls this on destroy(),
  // cancelling any timers that haven't fired yet.
  return () => {
    for (const t of timers) clearTimeout(t);
  };
};

