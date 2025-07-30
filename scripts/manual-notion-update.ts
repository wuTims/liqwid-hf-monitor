/**
 * Manual Notion Update Script
 * 
 * This script allows for manually triggering a Notion database update
 * with either mock data or live data from Liqwid.
 * 
 * Usage:
 *   npx tsx scripts/manual-notion-update.ts --mock    # Use mock data
 *   npx tsx scripts/manual-notion-update.ts --live    # Use live data from Liqwid
 */

import { createNotionAdapter } from '../src/lib/adapters/notionAdapter.js';
import { LiqwidPriceProvider } from '../src/lib/providers/liqwidPriceProvider.js';
import { createLiqwidClient } from '../src/lib/clients/liqwidClient.js';
import { PriceInfo } from '../src/lib/models/price.js';

// Get environment variables
const NOTION_API_TOKEN = process.env.NOTION_API_TOKEN;
const NOTION_PRICES_DB_ID = process.env.NOTION_PRICES_DB_ID || '';
const LIQWID_GRAPHQL_URL = process.env.LIQWID_GRAPHQL_URL || 'https://v2.api.liqwid.finance/graphql';

// Parse command line arguments
const useMockData = process.argv.includes('--mock');
const useLiveData = process.argv.includes('--live');

if (!useMockData && !useLiveData) {
  console.error('Please specify either --mock or --live');
  process.exit(1);
}

if (!NOTION_API_TOKEN) {
  console.error('NOTION_API_TOKEN environment variable is required');
  process.exit(1);
}

if (!NOTION_PRICES_DB_ID) {
  console.error('NOTION_PRICES_DB_ID environment variable is required');
  process.exit(1);
}

/**
 * Main function to update Notion database
 */
async function main() {
  console.log('Starting manual Notion update...');
  
  // Create Notion adapter
  const notionAdapter = createNotionAdapter({
    NOTION_PRICES_DB_ID,
    NOTION_API_TOKEN
  });
  
  let prices: Record<string, PriceInfo>;
  
  if (useMockData) {
    console.log('Using mock data...');
    // Create mock prices
    const now = new Date().toISOString();
    prices = {
      'ADA': {
        priceADA: 1.0,
        exchangeRate: 0.98,
        updatedAt: now,
        sourceUpdatedAt: now
      },
      'SNEK': {
        priceADA: 0.003,
        exchangeRate: 0.95,
        updatedAt: now,
        sourceUpdatedAt: now
      },
      'LQ': {
        priceADA: 3.5,
        exchangeRate: 0.92,
        updatedAt: now,
        sourceUpdatedAt: now
      },
      'MIN': {
        priceADA: 0.025,
        exchangeRate: 0.97,
        updatedAt: now,
        sourceUpdatedAt: now
      }
    };
  } else {
    console.log('Using live data from Liqwid...');
    // Create Liqwid client and price provider
    const liqwidClient = createLiqwidClient({
      LIQWID_GRAPHQL_URL,
      PAYMENT_ADDRESS: process.env.PAYMENT_ADDRESS || 'dummy-address-for-price-fetch',
      USER_AGENT: 'CardanoDefiHelper/1.0'
    });
    const priceProvider = new LiqwidPriceProvider(liqwidClient);
    
    // Get prices from Liqwid
    // Note: Liqwid API returns symbols in uppercase format
    // The LiqwidPriceProvider will handle the mapping internally
    const symbols = ['Ada', 'SNEK', 'LQ', 'MIN', 'IUSD', 'IAG'];
    console.log(`Fetching prices for: ${symbols.join(', ')}`);
    
    try {
      prices = await priceProvider.getPrices(symbols);
    } catch (error) {
      console.error('Failed to fetch prices from Liqwid:', error);
      
      // Fallback to mock data if live data fetch fails
      console.log('Falling back to mock data...');
      const now = new Date().toISOString();
      prices = {
        'Ada': {
          priceADA: 1.0,
          exchangeRate: 0.98,
          updatedAt: now,
          sourceUpdatedAt: now
        },
        'SNEK': {
          priceADA: 0.003,
          exchangeRate: 0.95,
          updatedAt: now,
          sourceUpdatedAt: now
        },
        'LQ': {
          priceADA: 3.5,
          exchangeRate: 0.92,
          updatedAt: now,
          sourceUpdatedAt: now
        },
        'MIN': {
          priceADA: 0.025,
          exchangeRate: 0.97,
          updatedAt: now,
          sourceUpdatedAt: now
        },
        'IUSD': {
          priceADA: 0.5,
          exchangeRate: 0.99,
          updatedAt: now,
          sourceUpdatedAt: now
        },
        'IAG': {
          priceADA: 0.8,
          exchangeRate: 0.96,
          updatedAt: now,
          sourceUpdatedAt: now
        }
      };
    }
  }
  
  console.log('Prices to update:', prices);
  
  // Update Notion database
  console.log('Updating Notion database...');
  try {
    const result = await notionAdapter.updatePriceDatabase(prices);
    
    console.log('Update complete!');
    console.log('Updated prices:', result);
  } catch (error) {
    console.error('Failed to update Notion database:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
