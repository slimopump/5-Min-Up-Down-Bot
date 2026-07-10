import { Env, type GabigolConfig } from "../../../utils/config.ts";

export type PriceBands = {
  convergence: { min: number; max: number };
  lottery: { min: number; max: number };
  mid: { min: number; max: number };
};

export const PRICE_BANDS: PriceBands = {
  convergence: { min: 0.94, max: 0.995 },
  lottery: { min: 0.03, max: 0.3 },
  mid: { min: 0.3, max: 0.94 },
};

export function loadGabigolConfig(): GabigolConfig {
  return Env.getGabigolConfig();
}

export function inBand(
  price: number,
  band: { min: number; max: number },
): boolean {
  return price >= band.min && price <= band.max;
}
