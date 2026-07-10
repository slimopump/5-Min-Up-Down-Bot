export type OrderType = "GTC" | "FOK" | "GTD" | "FAK";

export type OrderSide = "BUY" | "SELL";

export type OrderStatus = "LIVE" | "MATCHED" | "DELAYED" | "CANCELLED";

export type Order = {
  id: string;
  tokenId: string;
  action: "buy" | "sell";
  orderType?: OrderType;
  price: number;
  shares: number;
  actualShares: number;
  status: "filled" | "live" | "delayed" | "cancelled";
};

export type PostOrderResponse = {
  success: boolean;
  errorMsg: string;
  orderID: string;
  takingAmount: string;
  makingAmount: string;
  status: string;
  transactionsHashes?: string[];
  tradeIDs?: string[];
};

export type OpenOrder = {
  id: string;
  status: OrderStatus;
  owner: string;
  maker_address: string;
  market: string;
  asset_id: string;
  side: OrderSide;
  original_size: string;
  size_matched: string;
  price: string;
  outcome: string;
  expiration: string;
  order_type: OrderType;
  associate_trades: string[];
  created_at: number;
};

export type CancelOrderResponse = {
  canceled: string[];
  not_canceled: Record<string, string>;
};
