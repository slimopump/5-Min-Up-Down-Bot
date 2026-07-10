export type Side = "UP" | "DOWN";

export type WinnerInference = {
  winner: Side;
  loser: Side;
  gap: number;
};

export function inferLikelyWinner(
  spot: number,
  openPrice: number,
  minGapUsd = 0,
): WinnerInference | null {
  const gap = spot - openPrice;
  if (Math.abs(gap) < minGapUsd) return null;

  const winner: Side = gap >= 0 ? "UP" : "DOWN";
  const loser: Side = winner === "UP" ? "DOWN" : "UP";
  return { winner, loser, gap };
}
