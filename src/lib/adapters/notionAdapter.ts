/**
 * Notion Adapter - Provides an interface for updating Notion databases
 * 
 * This adapter uses direct Notion API calls to update price information.
 */

import { PriceInfo } from '../models/price.js';
import { AppConfig } from '../models.js';
import { NotionClient } from '../clients/notionClient.js';

/**
 * Result of a database update operation
 */
export interface UpdateResult {
  updated: number;
  errors: Array<{ symbol: string; error: string }>;
  [key: string]: unknown;
}

/**
 * Adapter for updating Notion database with price information
 */
export class NotionAdapter {
  private config: AppConfig;
  private client: NotionClient | null = null;
  
  /**
   * Create a new Notion adapter
   * 
   * @param config Application configuration
   */
  constructor(config: AppConfig) {
    this.config = config;
  }
  
  /**
   * Set the client directly (for testing purposes)
   * 
   * @param client The NotionClient instance to use
   */
  setClient(client: NotionClient): void {
    this.client = client;
  }
  
  /**
   * Get all asset symbols from the Notion prices database
   * 
   * @returns Array of asset symbols
   */
  async getAssetSymbols(): Promise<string[]> {
    // Initialize client if needed
    if (!this.ensureClient()) {
      return [];
    }
    
    return this.client!.getAssetSymbols();
  }

  /**
   * Update the Notion prices database with the latest price information
   * 
   * @param prices The price information to update in Notion
   * @returns A summary of the update operation
   */
  async updatePriceDatabase(prices: Record<string, PriceInfo>): Promise<UpdateResult> {
    // Ensure client is initialized
    if (!this.ensureClient()) {
      return {
        updated: 0,
        errors: [{ symbol: 'all', error: 'NOTION_API_TOKEN not provided' }]
      };
    }
    
    return this.client!.updatePriceDatabase(prices);
  }
  
  /**
   * Create the properties payload for a Notion database row
   * 
   * @param symbol The asset symbol
   * @param priceInfo The price information for the asset
   * @returns A properties object for Notion API
   */
  createPropertiesPayload(symbol: string, priceInfo: PriceInfo): Record<string, any> {
    return {
      "Asset": {
        title: [
          {
            text: {
              content: symbol
            }
          }
        ]
      },
      "Price (ADA)": {
        number: priceInfo.priceADA
      },
      "Exchange Rate": {
        number: priceInfo.exchangeRate
      },
      "Last Updated": {
        date: {
          start: priceInfo.updatedAt
        }
      },
      "Source Updated At": {
        date: {
          start: priceInfo.sourceUpdatedAt
        }
      }
    };
  }
  
  /**
   * Helper method to ensure the client is initialized
   * 
   * @returns true if client is initialized, false otherwise
   */
  private ensureClient(): boolean {
    // Check if we have the required token
    if (!this.config.NOTION_API_TOKEN) {
      console.warn('NOTION_API_TOKEN not provided, skipping Notion operation');
      return false;
    }
    
    // Initialize client if needed
    if (!this.client) {
      // Ensure we have the required values
      if (!this.config.NOTION_PRICES_DB_ID) {
        throw new Error('NOTION_PRICES_DB_ID is required for Notion API calls');
      }
      if (!this.config.NOTION_API_TOKEN) {
        throw new Error('NOTION_API_TOKEN is required for Notion API calls');
      }
      
      this.client = new NotionClient({
        ...this.config,
        // Explicitly cast to string since we've checked they're not undefined
        NOTION_PRICES_DB_ID: this.config.NOTION_PRICES_DB_ID,
        NOTION_API_TOKEN: this.config.NOTION_API_TOKEN
      });
    }
    
    return true;
  }
}

/**
 * Create a new Notion adapter with the provided configuration
 * 
 * @param config Application configuration or subset with Notion properties
 * @returns A new Notion adapter instance
 */
export function createNotionAdapter(config: Partial<AppConfig>): NotionAdapter {
  // Convert partial config to full AppConfig with defaults
  const fullConfig: AppConfig = {
    // Default values for required AppConfig properties
    LIQWID_GRAPHQL_URL: '',
    PAYMENT_ADDRESS: '',
    USER_AGENT: 'CardanoDefiHelper/1.0',
    HF_WARN: 1.7,
    HF_CRIT: 1.5,
    TELEGRAM_TOKEN: '',
    CHATID: '',
    // Override with provided values
    ...config
  };
  
  return new NotionAdapter(fullConfig);
}
