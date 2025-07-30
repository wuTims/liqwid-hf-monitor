/**
 * Price-related domain models.
 *
 * Keeping these simple interfaces isolated from implementation files makes the
 * codebase easier to navigate and avoids circular dependencies when several
 * providers or services need access to the same model.
 */

/**
 * Asset price information returned by any `PriceProvider` implementation.
 */
export interface PriceInfo {
  /** Price in ADA */
  priceADA: number;
  /** qToken to underlying ratio – optional because it does not apply to all assets/providers */
  exchangeRate?: number;
  /** ISO timestamp when this price data was fetched/updated */
  updatedAt: string;
  /** ISO timestamp from the price source (if available) */
  sourceUpdatedAt?: string;
}
