export type MarketWindow = "5m" | "15m";
export type MarketAsset = "btc" | "eth" | "xrp" | "sol" | "doge" | "hype" | "bnb";

export type GabigolConfig = {
  CLIP_NOTIONAL: number;
  MIN_SHARES: number;
  MARKET_CAP: number;
  LOTTERY_CAP: number;
  MID_CAP: number;
  LOTTERY_CLIP_NOTIONAL: number;
  MID_CLIP_NOTIONAL: number;
  MIN_EDGE: number;
  CONVERGENCE_MAX_SECS: number;
  LOTTERY_MIN_SECS: number;
  LOTTERY_MAX_SECS: number;
  BURST_PER_TICK: number;
  MIN_GAP_USD: number;
  TICK_MS: number;
};

export type Config = {
  TICKER: ("polymarket" | "binance" | "coinbase" | "okx" | "bybit")[];
  MARKET_WINDOW: MarketWindow;
  MARKET_ASSET: MarketAsset;
  PROD: boolean;
  PRIVATE_KEY: string;
  POLY_FUNDER_ADDRESS: string;
  BUILDER_KEY: string;
  BUILDER_SECRET: string;
  BUILDER_PASSPHRASE: string;
};

const ASSET_TICKER_MAP: Record<
  MarketAsset,
  {
    slugPrefix: string;
    binanceStream: string;
    coinbaseProduct: string;
    polymarketSymbol: string;
    apiSymbol: string;
    okxInstId: string;
    bybitSymbol: string;
  }
> = {
  btc: {
    slugPrefix: "btc",
    binanceStream: "btcusdt",
    coinbaseProduct: "BTC-USD",
    polymarketSymbol: "btc/usd",
    apiSymbol: "BTC",
    okxInstId: "BTC-USD",
    bybitSymbol: "BTCUSDT",
  },
  eth: {
    slugPrefix: "eth",
    binanceStream: "ethusdt",
    coinbaseProduct: "ETH-USD",
    polymarketSymbol: "eth/usd",
    apiSymbol: "ETH",
    okxInstId: "ETH-USD",
    bybitSymbol: "ETHUSDT",
  },
  xrp: {
    slugPrefix: "xrp",
    binanceStream: "xrpusdt",
    coinbaseProduct: "XRP-USD",
    polymarketSymbol: "xrp/usd",
    apiSymbol: "XRP",
    okxInstId: "XRP-USD",
    bybitSymbol: "XRPUSDT",
  },
  sol: {
    slugPrefix: "sol",
    binanceStream: "solusdt",
    coinbaseProduct: "SOL-USD",
    polymarketSymbol: "sol/usd",
    apiSymbol: "SOL",
    okxInstId: "SOL-USD",
    bybitSymbol: "SOLUSDT",
  },
  doge: {
    slugPrefix: "doge",
    binanceStream: "dogeusdt",
    coinbaseProduct: "DOGE-USD",
    polymarketSymbol: "doge/usd",
    apiSymbol: "DOGE",
    okxInstId: "DOGE-USD",
    bybitSymbol: "DOGEUSDT",
  },
  hype: {
    slugPrefix: "hype",
    binanceStream: "hypeusdt",
    coinbaseProduct: "HYPE-USD",
    polymarketSymbol: "hype/usd",
    apiSymbol: "HYPE",
    okxInstId: "HYPE-USD",
    bybitSymbol: "HYPEUSDT",
  },
  bnb: {
    slugPrefix: "bnb",
    binanceStream: "bnbusdt",
    coinbaseProduct: "BNB-USD",
    polymarketSymbol: "bnb/usd",
    apiSymbol: "BNB",
    okxInstId: "BNB-USD",
    bybitSymbol: "BNBUSDT",
  },
};

export class Env {
  private static readonly defaults: Config = {
    TICKER: ["polymarket", "coinbase"],
    MARKET_WINDOW: "5m",
    MARKET_ASSET: "btc",
    PROD: false,
    PRIVATE_KEY: "",
    POLY_FUNDER_ADDRESS: "",
    BUILDER_KEY: "",
    BUILDER_SECRET: "",
    BUILDER_PASSPHRASE: "",
  };

  static get<T extends keyof Config>(key: T): Config[T] {
    const raw = process.env[key];
    const defaultVal = this.defaults[key];

    // No env var set, return default
    if (raw === undefined) return defaultVal;

    // Infer type from default value
    if (typeof defaultVal === "boolean") {
      return (raw === "true") as Config[T];
    }

    if (Array.isArray(defaultVal)) {
      return raw.split(",").map((s) => s.trim()) as Config[T];
    }

    return raw as Config[T];
  }

  static getAssetConfig() {
    const asset = Env.get("MARKET_ASSET");
    const config = ASSET_TICKER_MAP[asset];
    if (!config) {
      throw new Error(
        `Invalid MARKET_ASSET "${asset}". Must be one of: ${Object.keys(ASSET_TICKER_MAP).join(", ")}`,
      );
    }
    return config;
  }

  static getGabigolConfig(): GabigolConfig {
    return {
      CLIP_NOTIONAL: Env.getNumber("GABIGOL_CLIP_NOTIONAL", 2.0),
      MIN_SHARES: Env.getInt("GABIGOL_MIN_SHARES", 5),
      MARKET_CAP: Env.getNumber("GABIGOL_MARKET_CAP", 200),
      LOTTERY_CAP: Env.getNumber("GABIGOL_LOTTERY_CAP", 30),
      MID_CAP: Env.getNumber("GABIGOL_MID_CAP", 50),
      LOTTERY_CLIP_NOTIONAL: Env.getNumber("GABIGOL_LOTTERY_CLIP_NOTIONAL", 1.5),
      MID_CLIP_NOTIONAL: Env.getNumber("GABIGOL_MID_CLIP_NOTIONAL", 1.5),
      MIN_EDGE: Env.getNumber("GABIGOL_MIN_EDGE", 0.005),
      CONVERGENCE_MAX_SECS: Env.getInt("GABIGOL_CONVERGENCE_MAX_SECS", 120),
      LOTTERY_MIN_SECS: Env.getInt("GABIGOL_LOTTERY_MIN_SECS", 60),
      LOTTERY_MAX_SECS: Env.getInt("GABIGOL_LOTTERY_MAX_SECS", 280),
      BURST_PER_TICK: Env.getInt("GABIGOL_BURST_PER_TICK", 3),
      MIN_GAP_USD: Env.getNumber("GABIGOL_MIN_GAP_USD", 0),
      TICK_MS: Env.getInt("GABIGOL_TICK_MS", 100),
    };
  }

  private static getNumber(key: string, fallback: number): number {
    const raw = process.env[key];
    if (raw === undefined) return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  private static getInt(key: string, fallback: number): number {
    const raw = process.env[key];
    if (raw === undefined) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  }
}
