/** Crypto 5m/15m taker fee rate (Polymarket docs). */
export const CRYPTO_FEE_RATE = 0.072;

/** Taker fee in shares: fee = shares × feeRate × price × (1 - price). */
export function takerFeeShares(
  shares: number,
  price: number,
  feeRate = CRYPTO_FEE_RATE,
): number {
  return shares * feeRate * price * (1 - price);
}

/** Net edge per share if redeemed at $1: 1 - price - feePerShare. */
export function netEdgePerShare(
  price: number,
  feeRate = CRYPTO_FEE_RATE,
): number {
  const feePerShare = feeRate * price * (1 - price);
  return 1 - price - feePerShare;
}

/** Shares for a target notional at a given ask, respecting minimum. */
export function clipShares(
  notionalUsd: number,
  price: number,
  minShares: number,
): number {
  const fromNotional = Math.ceil(notionalUsd / price);
  return Math.max(minShares, fromNotional);
}
