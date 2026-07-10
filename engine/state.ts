import { readFileSync, writeFileSync, renameSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { PendingOrderSnapshot, CompletedOrder } from "./market-lifecycle.ts";

export type MarketState = {
  slug: string;
  state: "RUNNING" | "STOPPING";
  strategyName: string;
  conditionId: string;
  clobTokenIds: [string, string];
  pendingOrders: PendingOrderSnapshot[];
  orderHistory: CompletedOrder[];
};

export type CompletedMarketState = {
  slug: string;
  strategyName: string;
  pnl: number;
  orderHistory: CompletedOrder[];
};

export type PersistentState = {
  sessionPnl: number;
  sessionLoss?: number;
  activeMarkets: MarketState[];
  completedMarkets: CompletedMarketState[];
};

export function loadState(path: string): PersistentState | null {
  try {
    const raw = readFileSync(path, "utf8");
    const state = JSON.parse(raw) as PersistentState;
    state.completedMarkets ??= [];
    return state;
  } catch {
    return null;
  }
}

export function saveState(path: string, state: PersistentState): void {
  const tmp = path + ".tmp";
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  renameSync(tmp, path);
}
