/**
 * Domain models for Liqwid Finance loans and collaterals
 */

// Core domain models
export interface Loan {
  id: string;
  userAddress: string;
  borrowedAsset: string;
  borrowedAmount: number;
  collaterals: Collateral[];
  collateralValue: number;
  healthFactor: number;
  lastUpdated: string;
}

export interface Collateral {
  id: string;
  assetSymbol: string;
  qTokenName: string;
  qTokenAmount: number;
  collateralHealthFactor: number;
  exchangeRate: number;
}

// Liqwid API response types
export interface LiqwidBasicLoan {
  id: string;
  healthFactor: string;
  asset: {
    symbol: string;
  };
}

export interface LiqwidDetailedLoan {
  id: string;
  healthFactor: string;
  asset: {
    symbol: string;
  };
  amount: string;
  collateral: string;
  collaterals: {
    asset: {
      symbol: string;
    };
    qTokenName: string;
    qTokenAmount: string;
    healthFactor: string;
    market: {
      exchangeRate: string;
    };
    id: string;
  }[];
  interest: string;
  adjustedAmount: string;
}

export interface LiqwidBasicLoansResponse {
  liqwid: {
    data: {
      loans: {
        results: LiqwidBasicLoan[];
      };
    };
  };
}

export interface LiqwidDetailedLoansResponse {
  liqwid: {
    data: {
      loans: {
        results: LiqwidDetailedLoan[];
      };
    };
  };
}

/**
 * Consolidated application configuration
 * All configuration values should be defined here
 */
export interface AppConfig {
  // Liqwid configuration
  LIQWID_GRAPHQL_URL: string;
  PAYMENT_ADDRESS: string;
  USER_AGENT: string;
  
  // Notion configuration
  NOTION_PRICES_DB_ID?: string;
  NOTION_API_TOKEN?: string;
  
  // Health Factor thresholds
  HF_WARN: number;
  HF_CRIT: number;
  
  // Telegram notification settings
  TELEGRAM_TOKEN: string;
  CHATID: string;
  
  // Any other configuration values
  [key: string]: unknown;
}

// Legacy config interface for backward compatibility
// TODO: Remove this once all code is migrated to AppConfig
export interface Config {
  LIQWID_GRAPHQL_URL: string;
  PAYMENT_ADDRESS: string;
  USER_AGENT: string;
}

// Options for fetching loan data
export interface LoanFetchOptions {
  /** Force refresh from source, bypassing cache */
  forceRefresh?: boolean;
  /** Use detailed query instead of basic */
  detailed?: boolean;
  /** Maximum age of cached data to accept (in seconds) */
  maxCacheAge?: number;
}
