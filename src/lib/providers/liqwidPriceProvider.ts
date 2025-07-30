import type { PriceInfo } from '../models/price.js';
import { BasePriceProvider } from './basePriceProvider.js';
import type { LiqwidClient } from '../clients/liqwidClient.js';

/**
 * Adapter that obtains prices from the Liqwid GraphQL API via `LiqwidClient`.
 */
export class LiqwidPriceProvider extends BasePriceProvider {
  constructor(private readonly client: LiqwidClient) {
    super('Liqwid Finance', 'https://liqwid.finance/');
  }

  async getPrices(symbols: string[]): Promise<Record<string, PriceInfo>> {
    if (!symbols.length) return {};

    try {
      // Directly pass the symbols to fetchMarketPrices
      const rawPrices = await this.client.fetchMarketPrices({ symbols });
      const mappedPrices: Record<string, PriceInfo> = {};
      let adaUsdPrice = 1;

      // Map the results to our PriceInfo format
      for (const [symbol, price] of Object.entries(rawPrices)) {
        if (symbol === 'ADA') {
            adaUsdPrice = price.priceADA;
        }

        mappedPrices[symbol] = {
          priceADA: price.priceADA,
          exchangeRate: price.exchangeRate,
          updatedAt: price.updatedAt,
          sourceUpdatedAt: price.priceUpdatedAt,
        };
      }

      for (const symbol in mappedPrices) {
        mappedPrices[symbol].priceADA = mappedPrices[symbol].priceADA / adaUsdPrice;
      }

      return mappedPrices;
    } catch (error) {
      console.error('Error fetching prices from Liqwid:', error);
      throw new Error('Failed to fetch prices from Liqwid');
    }
  }
}
