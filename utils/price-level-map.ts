import { OrderedMap } from "@js-sdsl/ordered-map";

/**
 * Sorted price-level map backed by a Red-Black Tree (@js-sdsl/ordered-map).
 * - "asc"  order: best = lowest price (use for asks)
 * - "desc" order: best = highest price (use for bids)
 *
 * set/delete/get are O(log n). best and entries() are O(1)/O(n) via the tree's
 * front() which reads header.left directly — no manual caching needed.
 */
export class PriceLevelMap {
  private map: OrderedMap<number, number>;
  private _totalLiquidity = 0;

  constructor(order: "asc" | "desc") {
    const cmp =
      order === "asc"
        ? (a: number, b: number) => a - b
        : (a: number, b: number) => b - a;
    this.map = new OrderedMap<number, number>([], cmp);
  }

  set(price: number, size: number): void {
    const prev = this.map.getElementByKey(price);
    if (prev !== undefined) this._totalLiquidity -= prev * price;
    this._totalLiquidity += size * price;
    this.map.setElement(price, size);
  }

  delete(price: number): void {
    const prev = this.map.getElementByKey(price);
    if (prev !== undefined) this._totalLiquidity -= prev * price;
    this.map.eraseElementByKey(price);
  }

  get(price: number): number | undefined {
    return this.map.getElementByKey(price);
  }

  clear(): void {
    this._totalLiquidity = 0;
    this.map.clear();
  }

  get totalLiquidity(): number {
    return this._totalLiquidity;
  }

  get size(): number {
    return this.map.size();
  }

  get best(): number | null {
    return this.map.front()?.[0] ?? null;
  }

  entries(): Iterable<[number, number]> {
    return this.map;
  }

  /** First n levels in sorted order */
  top(n: number): [number, number][] {
    const result: [number, number][] = [];
    for (const entry of this.map) {
      if (result.length >= n) break;
      result.push(entry as [number, number]);
    }
    return result;
  }
}
