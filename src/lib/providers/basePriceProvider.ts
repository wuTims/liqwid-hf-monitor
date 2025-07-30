import type { PriceInfo } from '../models/price.js';

/**
 * `PriceProvider` is the public contract that any price-source adapter must fulfil.
 * It purposely stays minimal to ease testing and future replacements.
 */
export interface PriceProvider {
  /**
   * Retrieve prices for the requested symbols.
   * @param symbols Asset symbols (e.g. `['ADA', 'DJED']`).
   */
  getPrices(symbols: string[]): Promise<Record<string, PriceInfo>>;
  /** Human-readable provider name */
  getName(): string;
  /** Canonical URL of the source (useful for links & debugging) */
  getSourceUrl(): string;
}

/**
 * Small helper base-class implementing the common boilerplate.
 */
export abstract class BasePriceProvider implements PriceProvider {
  constructor(private readonly name: string, private readonly sourceUrl: string) {}

  getName(): string {
    return this.name;
  }

  getSourceUrl(): string {
    return this.sourceUrl;
  }

  abstract getPrices(symbols: string[]): Promise<Record<string, PriceInfo>>;
}
