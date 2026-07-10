export type Leg = "convergence" | "lottery" | "mid";

export class MarketInventory {
  spentConvergence = 0;
  spentLottery = 0;
  spentMid = 0;

  constructor(
    readonly marketCap: number,
    readonly lotteryCap: number,
    readonly midCap: number,
  ) {}

  get totalSpent(): number {
    return this.spentConvergence + this.spentLottery + this.spentMid;
  }

  record(leg: Leg, notional: number): void {
    if (leg === "convergence") this.spentConvergence += notional;
    else if (leg === "lottery") this.spentLottery += notional;
    else this.spentMid += notional;
  }

  canSpend(leg: Leg, amount: number): boolean {
    if (this.totalSpent + amount > this.marketCap) return false;
    if (leg === "convergence") return true;
    if (leg === "lottery")
      return this.spentLottery + amount <= this.lotteryCap;
    return this.spentMid + amount <= this.midCap;
  }

  remainingForLeg(leg: Leg): number {
    const global = this.marketCap - this.totalSpent;
    if (leg === "convergence") return global;
    if (leg === "lottery")
      return Math.min(global, this.lotteryCap - this.spentLottery);
    return Math.min(global, this.midCap - this.spentMid);
  }
}
