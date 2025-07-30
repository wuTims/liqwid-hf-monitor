/**
 * Notion Client for updating price database
 * 
 * This module provides functionality to update a Notion database with price information
 * using the Notion MCP.
 */

import { PriceInfo } from '../models/price.js';
import { AppConfig } from '../models.js';

// Using the consolidated AppConfig instead of a separate NotionClientConfig
// For backward compatibility, we'll keep the interface but mark it as deprecated
/**
 * @deprecated Use AppConfig instead
 */
export interface NotionClientConfig {
  NOTION_PRICES_DB_ID: string;
  NOTION_API_TOKEN: string;
}

/**
 * Client for updating Notion database with price information
 */
export class NotionClient {
  private config: AppConfig;
  
  /**
   * Create a new Notion client
   * 
   * @param config Application configuration
   */
  constructor(config: AppConfig) {
    // Validate required config properties
    if (!config.NOTION_PRICES_DB_ID) {
      throw new Error('NOTION_PRICES_DB_ID is required for NotionClient');
    }
    if (!config.NOTION_API_TOKEN) {
      throw new Error('NOTION_API_TOKEN is required for NotionClient');
    }
    
    this.config = config;
  }
  
  /**
   * Get all asset symbols from the Notion prices database
   * 
   * @returns Array of asset symbols
   */
  async getAssetSymbols(): Promise<string[]> {
    const rows = await this.queryPricesDatabase();
    const symbols = rows.map(row => {
      // Get the symbol from the title field (Asset column)
      const titleField = row.properties?.Asset?.title || [];
      if (titleField.length > 0 && titleField[0]?.plain_text) {
        return titleField[0].plain_text;
      }
      return null;
    })
    .filter((symbol): symbol is string => symbol !== null);
    
    return symbols;
  }

  /**
   * Update the Notion prices database with the latest price information
   * 
   * @param prices The price information to update in Notion
   * @returns A summary of the update operation
   */
  async updatePriceDatabase(prices: Record<string, PriceInfo>): Promise<{
    updated: number;
    errors: Array<{ symbol: string; error: string }>;
  }> {
    const results = {
      updated: 0,
      errors: [] as Array<{ symbol: string; error: string }>
    };
    
    // Get all existing rows from the database
    const existingRows = await this.queryPricesDatabase();
    
    // Process each price
    for (const [symbol, priceInfo] of Object.entries(prices)) {
      try {
        // Find existing row for this symbol if it exists
        const existingRow = existingRows.find(row => 
          row.properties?.Asset?.title?.[0]?.plain_text === symbol
        );
        
        if (existingRow) {
          // Update existing row
          await this.updatePriceRow(existingRow.id, symbol, priceInfo);
        } else {
          // Create new row
          await this.createPriceRow(symbol, priceInfo);
        }
        
        results.updated++;
      } catch (error) {
        results.errors.push({
          symbol,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }
  
  /**
   * Query the Notion prices database to get all existing rows
   * 
   * @returns Array of database rows
   */
  async queryPricesDatabase(): Promise<any[]> {
    try {
      const response = await fetch('https://api.notion.com/v1/databases/' + this.config.NOTION_PRICES_DB_ID + '/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
          'Authorization': `Bearer ${this.config.NOTION_API_TOKEN}`,
        },
        body: JSON.stringify({
          page_size: 100, // Assuming we won't have more than 100 assets
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to query Notion database: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as { results?: any[] };
      return data.results || [];
    } catch (error) {
      console.error('Error querying Notion database:', error);
      throw error;
    }
  }
  
  /**
   * Create a new row in the Notion prices database
   * 
   * @param symbol The asset symbol
   * @param priceInfo The price information
   */
  private async createPriceRow(symbol: string, priceInfo: PriceInfo): Promise<void> {
    try {
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
          'Authorization': `Bearer ${this.config.NOTION_API_TOKEN}`,
        },
        body: JSON.stringify({
          parent: { database_id: this.config.NOTION_PRICES_DB_ID },
          properties: this.createPropertiesPayload(symbol, priceInfo)
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create Notion row: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error creating price row for ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Update an existing row in the Notion prices database
   * 
   * @param pageId The ID of the page to update
   * @param symbol The asset symbol
   * @param priceInfo The price information
   */
  private async updatePriceRow(pageId: string, symbol: string, priceInfo: PriceInfo): Promise<void> {
    try {
      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
          'Authorization': `Bearer ${this.config.NOTION_API_TOKEN}`,
        },
        body: JSON.stringify({
          properties: this.createPropertiesPayload(symbol, priceInfo)
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update Notion row: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Error updating price row for ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Create the properties payload for a Notion database row
   * 
   * @param symbol The asset symbol
   * @param priceInfo The price information
   * @returns The properties payload for the Notion API
   */
  private createPropertiesPayload(symbol: string, priceInfo: PriceInfo): Record<string, any> {
    return {
      // The 'Asset' field is the title field in the database
      "Asset": {
        title: [
          {
            text: {
              content: symbol
            }
          }
        ]
      },
      // The 'ADA Price' field is a number field
      "ADA Price": {
        number: priceInfo.priceADA
      },
      // The 'Exchange Rate (qToken)' field is a number field for the qToken exchange rate
      "Exchange Rate (qToken)": {
        number: priceInfo.exchangeRate || null
      }
      // Note: Last Updated is automatically managed by Notion as a last_edited_time field
      // Note: Token relation field is not set here as it requires a relation lookup
    };
  }
}

/**
 * Create a new Notion client with the provided configuration
 * 
 * @param config Application configuration or subset with Notion properties
 * @returns A new Notion client instance
 */
export function createNotionClient(config: Partial<AppConfig>): NotionClient {
  // Convert partial config to full AppConfig with defaults
  const fullConfig: AppConfig = {
    // Default values for required AppConfig properties
    LIQWID_GRAPHQL_URL: '',
    PAYMENT_ADDRESS: '',
    USER_AGENT: 'CardanoDefiHelper/1.0',
    HF_WARN: 1.5,
    HF_CRIT: 1.2,
    TELEGRAM_TOKEN: '',
    CHATID: '',
    // Override with provided values
    ...config
  };
  
  return new NotionClient(fullConfig);
}
