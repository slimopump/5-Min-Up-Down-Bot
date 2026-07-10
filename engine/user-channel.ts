import type { OrderRequest } from "./strategy/types.ts";
import type { EarlyBirdClient, BookSnapshot } from "./client.ts";
import { isSimFilled } from "./client.ts";

export type ApiCreds = { key: string; secret: string; passphrase: string };

export interface UserChannel {
  /** Start connecting (prod: opens WS + sends auth; sim: starts poll interval). */
  subscribe(conditionId: string): void;
  /** Resolves when the channel is ready to receive events (auth confirmed). */
  waitForReady(): Promise<void>;
  /** Track a placed order. Channel calls request.onFilled / request.onFailed. */
  trackOrder(orderId: string, request: OrderRequest): void;
  /**
   * Stop tracking. Subsequent events for this order are silently ignored.
   * Skips matched-but-not-mined orders so an in-flight settlement can still fire onFilled.
   */
  untrackOrder(orderId: string): void;
  /** Sum of matched_amount across MINED trades seen so far (0 if untracked). */
  getMatchedSoFar(orderId: string): number;
  /** True if MATCHED has been received but final MINED settlement is still pending. */
  isMatched(orderId: string): boolean;
  destroy(): void;
}

type Tracked = {
  request: OrderRequest;
  matched: boolean;
  associatedTrades: Set<string>;
  minedAmounts: Map<string, number>; // tradeId → amount credited to this order
};

type OrderEvent = {
  id: string;
  type: string;
  status: string;
  associate_trades?: string[];
};

type TradeEvent = {
  id: string;
  status: string;
  size: string;
  taker_order_id: string;
  maker_orders?: { order_id: string; matched_amount: string }[];
};

abstract class UserChannelBase implements UserChannel {
  protected tracked = new Map<string, Tracked>();
  /** Buffer for MINED trade amounts that arrive before trackOrder or before order MATCHED. */
  private _pendingTradeAmounts = new Map<string, Map<string, number>>();
  /** Buffer for trade IDs that MATCHED before trackOrder. Required for taker
   *  orders, which never receive an order UPDATE MATCHED event — the trade
   *  event is the only signal that the order is filled. */
  private _pendingMatchedTrades = new Map<string, Set<string>>();

  trackOrder(orderId: string, request: OrderRequest): void {
    const bufferedMined = this._pendingTradeAmounts.get(orderId);
    const bufferedMatched = this._pendingMatchedTrades.get(orderId);
    this.tracked.set(orderId, {
      request,
      matched: (bufferedMatched?.size ?? 0) > 0,
      associatedTrades: bufferedMatched ?? new Set(),
      minedAmounts: bufferedMined ?? new Map(),
    });
    this._pendingTradeAmounts.delete(orderId);
    this._pendingMatchedTrades.delete(orderId);
    this._trySettle(orderId);
  }

  untrackOrder(orderId: string): void {
    const t = this.tracked.get(orderId);
    // Preserve matched orders so the in-flight MINED event can still fire onFilled.
    // Without this guard, a lifecycle-initiated cancel that races against MATCHED
    // would drop the trade and the order would never settle.
    if (t?.matched) return;
    this.tracked.delete(orderId);
    this._pendingTradeAmounts.delete(orderId);
    this._pendingMatchedTrades.delete(orderId);
  }

  getMatchedSoFar(orderId: string): number {
    const t = this.tracked.get(orderId);
    if (!t) return 0;
    let sum = 0;
    for (const v of t.minedAmounts.values()) sum += v;
    return sum;
  }

  isMatched(orderId: string): boolean {
    return this.tracked.get(orderId)?.matched ?? false;
  }

  protected processOrderEvent(evt: OrderEvent): void {
    const t = this.tracked.get(evt.id);
    if (!t) return;

    if (evt.type === "UPDATE" && evt.status === "MATCHED") {
      t.matched = true;
      // Merge rather than replace — a TRADE MATCHED event may have already
      // populated associatedTrades for this order before the order UPDATE arrived.
      for (const tradeId of evt.associate_trades ?? []) {
        t.associatedTrades.add(tradeId);
      }
      this._trySettle(evt.id);
    } else if (evt.type === "CANCELLATION") {
      // CLOB-side cancellation not initiated by the lifecycle.
      // Lifecycle-initiated cancels call untrackOrder first, so we never reach here for those.
      this.tracked.delete(evt.id);
      t.request.onFailed?.("cancelled");
    }
  }

  protected processTradeEvent(evt: TradeEvent): void {
    // TRADE MATCHED is the only "matched" signal a taker order receives — the
    // CLOB does not emit an order UPDATE MATCHED event for orders that fill
    // immediately on placement. Handle it for makers too as a safety net in
    // case the order event is delayed or missed.
    if (evt.status === "MATCHED") {
      if (evt.taker_order_id) this._markMatched(evt.taker_order_id, evt.id);
      for (const m of evt.maker_orders ?? []) {
        this._markMatched(m.order_id, evt.id);
      }
      return;
    }

    if (evt.status !== "MINED") return;

    // orderId -> amount map
    const contributions: Array<[string, number]> = [];

    // for TAKER orders
    if (
      evt.taker_order_id &&
      (this.tracked.has(evt.taker_order_id) ||
        this._pendingTradeAmounts.has(evt.taker_order_id) ||
        this._pendingMatchedTrades.has(evt.taker_order_id))
    ) {
      contributions.push([evt.taker_order_id, parseFloat(evt.size)]);
    }

    // for MAKER orders
    for (const m of evt.maker_orders ?? []) {
      if (
        this.tracked.has(m.order_id) ||
        this._pendingTradeAmounts.has(m.order_id) ||
        this._pendingMatchedTrades.has(m.order_id)
      ) {
        contributions.push([m.order_id, parseFloat(m.matched_amount)]);
      }
    }

    for (const [orderId, amount] of contributions) {
      const t = this.tracked.get(orderId);
      if (t) {
        t.minedAmounts.set(evt.id, amount);
        this._trySettle(orderId);
      } else {
        // Trade arrived before trackOrder — buffer it
        let buf = this._pendingTradeAmounts.get(orderId);
        if (!buf) {
          buf = new Map();
          this._pendingTradeAmounts.set(orderId, buf);
        }
        buf.set(evt.id, amount);
      }
    }
  }

  /** Mark an order as matched and add the trade to its associated set.
   *  Buffers state if the order isn't yet tracked (race with trackOrder). */
  private _markMatched(orderId: string, tradeId: string): void {
    const t = this.tracked.get(orderId);
    if (t) {
      t.matched = true;
      t.associatedTrades.add(tradeId);
      this._trySettle(orderId);
      return;
    }
    let buf = this._pendingMatchedTrades.get(orderId);
    if (!buf) {
      buf = new Set();
      this._pendingMatchedTrades.set(orderId, buf);
    }
    buf.add(tradeId);
  }

  // 1. if order event comes before trade event, then eg (0 < 2) return guard will trigger.
  // 2. if trade event comes before order event, then t.matched return guard will trigger.
  private _trySettle(orderId: string): void {
    const t = this.tracked.get(orderId);
    if (!t || !t.matched) return;
    if (t.minedAmounts.size < t.associatedTrades.size) return;
    let total = 0;
    for (const v of t.minedAmounts.values()) total += v;
    this.tracked.delete(orderId);
    t.request.onFilled?.(total);
  }

  abstract subscribe(conditionId: string): void;
  abstract waitForReady(): Promise<void>;
  abstract destroy(): void;
}

// ---------------------------------------------------------------------------
// Production WebSocket channel
// ---------------------------------------------------------------------------

const USER_WS_URL =
  "wss://ws-subscriptions-frontend-clob.polymarket.com/ws/user";

export class PolymarketUserChannel extends UserChannelBase {
  private _ws: WebSocket | null = null;
  private _destroyed = false;
  private _conditionId: string | null = null;
  private _pingInterval: ReturnType<typeof setInterval> | null = null;
  private _readyResolve: (() => void) | null = null;
  private _ready = new Promise<void>((resolve) => {
    this._readyResolve = resolve;
  });
  private readonly _creds: ApiCreds;
  private readonly _client: EarlyBirdClient;

  constructor(opts: { creds: ApiCreds; client: EarlyBirdClient }) {
    super();
    this._creds = opts.creds;
    this._client = opts.client;
  }

  subscribe(conditionId: string): void {
    this._conditionId = conditionId;
    this._connect();
  }

  waitForReady(): Promise<void> {
    return this._ready;
  }

  private _connect(): void {
    if (this._destroyed) return;
    const ws = new WebSocket(USER_WS_URL);
    this._ws = ws;

    ws.onopen = () => {
      this._clearPing();
      ws.send(
        JSON.stringify({
          auth: {
            apiKey: this._creds.key,
            secret: this._creds.secret,
            passphrase: this._creds.passphrase,
          },
          markets: [this._conditionId!],
          type: "user",
        }),
      );
      this._pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("PING");
      }, 9_000);
      this._readyResolve?.();
      this._readyResolve = null;
    };

    ws.onmessage = (event) => {
      const raw = event.data as string;
      if (raw === "PONG") return;
      try {
        const msg = JSON.parse(raw);
        if (msg.event_type === "order")
          this.processOrderEvent(msg as OrderEvent);
        else if (msg.event_type === "trade")
          this.processTradeEvent(msg as TradeEvent);
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      this._clearPing();
      if (this._destroyed) return;
      this._reconnect();
    };
  }

  private _clearPing(): void {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  private _reconnect(): void {
    if (this._destroyed) return;
    this._connect();

    const reconcile = async (orderIds: string[]) => {
      for (const orderId of orderIds) {
        if (!this.tracked.has(orderId)) continue; // already settled by WS
        try {
          const order = await this._client.getOrderById(orderId);
          if (!order) continue;
          const t = this.tracked.get(orderId);
          if (!t) continue; // settled during this sweep
          if (order.status === "filled") {
            this.tracked.delete(orderId);
            const gross =
              order.actualShares > 0 ? order.actualShares : order.shares;
            t.request.onFilled?.(gross);
          } else if (order.status === "cancelled") {
            this.tracked.delete(orderId);
            t.request.onFailed?.("cancelled");
          }
        } catch {}
      }
    };

    // One-shot REST reconciliation: catch any events missed during disconnect
    const orderIds = [...this.tracked.keys()];
    reconcile(orderIds);
  }

  destroy(): void {
    this._destroyed = true;
    this._clearPing();
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Simulation channel (no network — polls the sim order book)
// ---------------------------------------------------------------------------

export class SimUserChannel extends UserChannelBase {
  private _interval: ReturnType<typeof setInterval> | null = null;
  private readonly _getBook: (tokenId: string) => BookSnapshot;
  private readonly _cancelCallbacks: Map<string, () => void> | null;

  constructor(opts: {
    getBook: (tokenId: string) => BookSnapshot;
    /** Shared map from EarlyBirdSimClient.cancelCallbacks. When provided, the channel
     *  registers a CANCELLATION-synthesizing callback per tracked order so that tests
     *  can verify untrackOrder suppresses onFailed for lifecycle-initiated cancels. */
    cancelCallbacks?: Map<string, () => void>;
  }) {
    super();
    this._getBook = opts.getBook;
    this._cancelCallbacks = opts.cancelCallbacks ?? null;
  }

  subscribe(_conditionId: string): void {
    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(() => this._check(), 100);
  }

  waitForReady(): Promise<void> {
    return Promise.resolve();
  }

  override trackOrder(orderId: string, request: OrderRequest): void {
    super.trackOrder(orderId, request);
    this._cancelCallbacks?.set(orderId, () => {
      this.processOrderEvent({
        id: orderId,
        type: "CANCELLATION",
        status: "CANCELED",
      });
    });
  }

  override untrackOrder(orderId: string): void {
    // If super skipped (matched-not-mined), keep the cancel callback too —
    // the order is still tracked and a stray CANCELLATION must stay routable.
    const wasMatched = this.isMatched(orderId);
    super.untrackOrder(orderId);
    if (!wasMatched) this._cancelCallbacks?.delete(orderId);
  }

  private _check(): void {
    for (const [orderId, t] of this.tracked) {
      if (t.matched) continue; // already synthesized MATCHED, waiting for MINED
      const { req } = t.request;
      const book = this._getBook(req.tokenId);
      if (!isSimFilled(req, book)) continue;

      // Synthesize an order MATCHED event with one synthetic trade
      const tradeId = crypto.randomUUID();
      this.processOrderEvent({
        id: orderId,
        type: "UPDATE",
        status: "MATCHED",
        associate_trades: [tradeId],
      });

      // Schedule trade MINED after the simulated on-chain settlement delay.
      // Read at call time so tests can control it via process.env.SIM_BALANCE_DELAY_MS.
      const delay = parseInt(process.env.SIM_BALANCE_DELAY_MS ?? "4000", 10);
      setTimeout(() => {
        this.processTradeEvent({
          id: tradeId,
          status: "MINED",
          size: String(req.shares),
          taker_order_id: "",
          maker_orders: [
            { order_id: orderId, matched_amount: String(req.shares) },
          ],
        });
      }, delay);
    }
  }

  destroy(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}
