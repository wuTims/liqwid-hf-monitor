/**
 * Liqwid Finance service interface and implementation
 */
import { 
  Loan, 
  Collateral, 
  LiqwidBasicLoan, 
  LiqwidDetailedLoan, 
  LiqwidBasicLoansResponse, 
  LiqwidDetailedLoansResponse,
  Config,
  LoanFetchOptions
} from '../models.js';

// Extended fetch options with cache control
interface ExtendedLoanFetchOptions extends LoanFetchOptions {
  maxCacheAgeSeconds?: number;
  cacheTtlSeconds?: number;
}
import { SimpleCache } from '../cache/simpleCache.js';

/**
 * GraphQL queries for Liqwid Finance API
 * Optimized for different monitoring scenarios
 */
const LIQWID_QUERIES = {
  /**
   * Basic query for scheduled health factor checks
   * Returns only essential data: id, healthFactor, and asset symbol
   */
  BASIC_LOANS: `
    query GetBasicLoans($addresses: [String!]!) {
      liqwid {
        data {
          loans(input: { paymentKeys: $addresses }) {
            results {
              id
              healthFactor
              asset {
                symbol
              }
            }
          }
        }
      }
    }
  `,

  /**
   * Detailed query for comprehensive monitoring and dashboards
   * Returns full loan data including collaterals, amounts, and interest
   */
  DETAILED_LOANS: `
    query GetDetailedLoans($addresses: [String!]!) {
      liqwid {
        data {
          loans(input: { paymentKeys: $addresses }) {
            results {
              id
              healthFactor
              asset {
                symbol
              }
              amount
              collateral
              collaterals {
                asset {
                  symbol
                }
                qTokenName
                qTokenAmount
                healthFactor
                market {
                  exchangeRate
                }
                id
              }
              interest
              adjustedAmount
            }
          }
        }
      }
    }
  `,
} as const;

/**
 * Error classes for Liqwid service
 */
export class ProviderFailureError extends Error {
  constructor(provider: string, message: string, public originalError?: unknown) {
    super(`${provider} provider error: ${message}`);
    this.name = 'ProviderFailureError';
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(`Bad request: ${message}`);
    this.name = 'BadRequestError';
  }
}

/**
 * Liqwid Finance service interface
 */
export interface LiqwidService {
  /**
   * Get basic loan data for health factor monitoring
   * @param addresses - Array of Cardano payment addresses
   * @param options - Fetch options
   */
  getBasicLoans(addresses: string[], options?: LoanFetchOptions): Promise<Loan[]>;

  /**
   * Get detailed loan data for comprehensive monitoring
   * @param addresses - Array of Cardano payment addresses  
   * @param options - Fetch options
   */
  getDetailedLoans(addresses: string[], options?: LoanFetchOptions): Promise<Loan[]>;

  /**
   * Get loans for the monitored payment address (convenience method)
   * @param options - Fetch options
   */
  getMonitoredLoans(options?: LoanFetchOptions): Promise<Loan[]>;
}

/**
 * Liqwid Finance GraphQL service implementation
 */
export class LiqwidGraphQLService implements LiqwidService {
  private config: Config;
  private cache: SimpleCache<any>;

  constructor(config: Config) {
    this.config = config;
    this.cache = new SimpleCache<any>();
  }

  /**
   * Get basic loan data optimized for health factor monitoring
   */
  async getBasicLoans(addresses: string[], options: ExtendedLoanFetchOptions = {}): Promise<Loan[]> {
    this.validateAddresses(addresses);
    
    const cacheKey = `liqwid:basic:${addresses.join(',')}`;
    
    // Check cache first if not forced to refresh
    if (!options.forceRefresh) {
      const cachedData = this.cache.get(cacheKey) as LiqwidBasicLoansResponse;
      if (cachedData && this.isCacheValid(cachedData, options.maxCacheAgeSeconds)) {
        console.log('Using cached basic loans data');
        return this.transformBasicLoans(cachedData.liqwid.data.loans.results);
      }
    }
    
    // Fetch fresh data
    try {
      const data = await this.executeGraphQL<LiqwidBasicLoansResponse>(
        LIQWID_QUERIES.BASIC_LOANS,
        { addresses }
      );
      
      // Cache the results
      this.cache.set(cacheKey, data, options.cacheTtlSeconds || 60);
      
      return this.transformBasicLoans(data.liqwid.data.loans.results);
    } catch (error) {
      console.error('Failed to fetch basic loans:', error);
      throw new ProviderFailureError('Liqwid', 'Failed to fetch basic loans', error);
    }
  }

  /**
   * Get detailed loan data for comprehensive monitoring
   */
  async getDetailedLoans(addresses: string[], options: ExtendedLoanFetchOptions = {}): Promise<Loan[]> {
    this.validateAddresses(addresses);
    
    const cacheKey = `liqwid:detailed:${addresses.join(',')}`;
    
    // Check cache first if not forced to refresh
    if (!options.forceRefresh) {
      const cachedData = this.cache.get(cacheKey) as LiqwidDetailedLoansResponse;
      if (cachedData && this.isCacheValid(cachedData, options.maxCacheAgeSeconds)) {
        console.log('Using cached detailed loans data');
        return this.transformDetailedLoans(cachedData.liqwid.data.loans.results);
      }
    }
    
    // Fetch fresh data
    try {
      const data = await this.executeGraphQL<LiqwidDetailedLoansResponse>(
        LIQWID_QUERIES.DETAILED_LOANS,
        { addresses }
      );
      
      // Cache the results
      this.cache.set(cacheKey, data, options.cacheTtlSeconds || 60);
      
      return this.transformDetailedLoans(data.liqwid.data.loans.results);
    } catch (error) {
      console.error('Failed to fetch detailed loans:', error);
      throw new ProviderFailureError('Liqwid', 'Failed to fetch detailed loans', error);
    }
  }

  /**
   * Get loans for the monitored payment address
   */
  async getMonitoredLoans(options: ExtendedLoanFetchOptions = {}): Promise<Loan[]> {
    if (!this.config.PAYMENT_ADDRESS) {
      throw new BadRequestError('No monitored address configured');
    }
    
    // Use the detailed loans endpoint for the monitored address
    return this.getDetailedLoans([this.config.PAYMENT_ADDRESS], options);
  }

  /**
   * Execute a GraphQL query against the Liqwid API
   */
  private async executeGraphQL<T>(query: string, variables: Record<string, any>): Promise<T> {
    if (!this.config.LIQWID_GRAPHQL_URL) {
      throw new Error('Liqwid GraphQL URL not configured');
    }
    
    try {
      // Use native fetch directly instead of this.client.fetch
      console.log(`Fetching from ${this.config.LIQWID_GRAPHQL_URL} with variables:`, JSON.stringify(variables));
      
      const response = await fetch(this.config.LIQWID_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.config.USER_AGENT || 'CardanoDefiHelper/1.0',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GraphQL request failed: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { data: T, errors?: any[] };
      
      if (data.errors && data.errors.length > 0) {
        console.error(`GraphQL errors:`, JSON.stringify(data.errors));
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }
      
      if (!data.data) {
        console.error('GraphQL response missing data:', JSON.stringify(data));
        throw new Error('GraphQL response missing data');
      }
      
      return data.data as T;
    } catch (error) {
      console.error('Error executing GraphQL query:', error);
      if (error instanceof Error) {
        throw new ProviderFailureError('Liqwid GraphQL', error.message, error);
      }
      throw new ProviderFailureError('Liqwid GraphQL', 'Unknown error occurred', error);
    }
  }

  /**
   * Transform basic loan data from API response to domain model
   */
  private transformBasicLoans(loans: LiqwidBasicLoan[]): Loan[] {
    return loans.map(loan => ({
      id: loan.id,
      userAddress: '', // Not available in basic response
      borrowedAsset: loan.asset.symbol,
      borrowedAmount: 0, // Not available in basic response
      collaterals: [], // Not available in basic response
      collateralValue: 0, // Not available in basic response
      healthFactor: parseFloat(loan.healthFactor),
      lastUpdated: new Date().toISOString(),
    }));
  }

  /**
   * Transform detailed loan data from API response to domain model
   */
  private transformDetailedLoans(loans: LiqwidDetailedLoan[]): Loan[] {
    return loans.map(loan => {
      // Transform collaterals
      const collaterals: Collateral[] = loan.collaterals.map(col => ({
        id: col.id,
        assetSymbol: col.asset.symbol,
        qTokenName: col.qTokenName,
        qTokenAmount: parseFloat(col.qTokenAmount),
        collateralHealthFactor: parseFloat(col.healthFactor),
        exchangeRate: parseFloat(col.market.exchangeRate),
      }));
      
      // Calculate collateral value (simplified)
      const collateralValue = collaterals.reduce(
        (sum, col) => sum + col.qTokenAmount * col.exchangeRate, 
        0
      );
      
      return {
        id: loan.id,
        userAddress: '', // Not directly available
        borrowedAsset: loan.asset.symbol,
        borrowedAmount: parseFloat(loan.amount),
        collaterals,
        collateralValue,
        healthFactor: parseFloat(loan.healthFactor),
        lastUpdated: new Date().toISOString(),
      };
    });
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid<T>(data: T, maxAgeSeconds = 60): boolean {
    if (!data) return false;
    
    // Default cache TTL is 60 seconds
    return true;
  }

  /**
   * Validate addresses before making API calls
   */
  private validateAddresses(addresses: string[]): void {
    if (!addresses || addresses.length === 0) {
      throw new BadRequestError('No addresses provided');
    }
    
    // Basic validation that addresses look like Cardano addresses
    for (const address of addresses) {
      if (!address || address.length < 10) {
        throw new BadRequestError(`Invalid address format: ${address}`);
      }
    }
  }
}
