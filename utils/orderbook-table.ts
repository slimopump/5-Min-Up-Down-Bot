const P = 6; // price column width
const S = 8; // size column width
const GAP = "   ";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

export type BookDepth = {
  bids: [number, number][];
  asks: [number, number][];
};

// Pad first, then colorize — ANSI codes must not affect padding width
function _fmtP(v?: number): string {
  return (v !== undefined ? v.toString() : "").padStart(P);
}

function _fmtS(v?: number): string {
  return (v !== undefined ? Math.round(v).toString() : "").padStart(S);
}

function _bid(price?: number, size?: number): string {
  return GREEN + _fmtP(price) + _fmtS(size) + RESET;
}

function _ask(price?: number, size?: number): string {
  return RED + _fmtP(price) + _fmtS(size) + RESET;
}

export function renderOrderBookTable(
  up: BookDepth,
  down: BookDepth,
  fees?: { upFee?: number; downFee?: number },
): string[] {
  const colW = P + S + P + S;
  const upLabel =
    fees?.upFee != null ? `── UP (fee: ${fees.upFee}bps)` : "── UP";
  const downLabel =
    fees?.downFee != null ? `── DOWN (fee: ${fees.downFee}bps)` : "── DOWN";
  const header = `${upLabel.padEnd(colW)}${GAP}${downLabel.padEnd(colW)}`;
  const colHdr =
    `${GREEN}${"BID".padStart(P)}${"SIZE".padStart(S)}${RESET}` +
    `${RED}${"ASK".padStart(P)}${"SIZE".padStart(S)}${RESET}` +
    GAP +
    `${GREEN}${"BID".padStart(P)}${"SIZE".padStart(S)}${RESET}` +
    `${RED}${"ASK".padStart(P)}${"SIZE".padStart(S)}${RESET}`;

  const depth = Math.max(
    up.bids.length,
    up.asks.length,
    down.bids.length,
    down.asks.length,
  );
  const rows = Array.from({ length: depth }, (_, i) => {
    const [upBid, upBidSz] = up.bids[i] ?? [];
    const [upAsk, upAskSz] = up.asks[i] ?? [];
    const [downBid, downBidSz] = down.bids[i] ?? [];
    const [downAsk, downAskSz] = down.asks[i] ?? [];
    return (
      _bid(upBid, upBidSz) +
      _ask(upAsk, upAskSz) +
      GAP +
      _bid(downBid, downBidSz) +
      _ask(downAsk, downAskSz)
    );
  });

  return [header, colHdr, ...rows];
}
