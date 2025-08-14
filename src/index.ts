/**
 * Health Factor Monitor - Cloudflare Worker
 * 
 * This worker monitors Liqwid Finance loans and sends alerts when health factors
 * drop below configured thresholds. It also updates a Notion database with price information.
 */

// Import local functionality
import { 
  createLiqwidClient,
  LiqwidPriceProvider,
  createNotionAdapter,
  sendAlert,
  AppConfig
} from './lib/index.js';
import { AlertManager } from './lib/alertManager.js';

// Import worker-specific utilities
import { createEnv } from './config.js';
import { rootLogger } from './logger.js';

/**
 * Worker environment interface - extends WorkerEnv with Cloudflare Worker specific properties
 */
export interface Env {
  // KV namespace for storing state
  HF_MONITOR_STATE?: KVNamespace;
  
  // Include all environment variables from WorkerEnv
  [key: string]: unknown;
}

// Handler that runs on the defined cron schedule and responds to HTTP requests
export default {
  // Required fetch handler for Cloudflare Workers
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Return a simple response for HTTP requests
    return new Response('Health Factor Monitor - Scheduled Worker', {
      headers: { 'Content-Type': 'text/plain' },
    });
  },
  
  // This is the main function that will be called by the Cloudflare Worker on schedule
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Create a logger for this execution
    const logger = rootLogger.withContext({
      executionId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    });
    
    logger.info('Health Factor Monitor started');

    try {
      // Create and validate environment variables once at the beginning
      const validatedEnv = createEnv(env);
      
      // Create a consolidated config object that can be passed to all services
      const appConfig: AppConfig = {
        ...validatedEnv,
        // Ensure we have a USER_AGENT if not provided in env
        USER_AGENT: validatedEnv.USER_AGENT || 'CardanoDefiHelper/1.0'
      };
      
      // Initialize Liqwid client with the consolidated config
      const liqwidClient = createLiqwidClient(appConfig);
      
      // Initialize price provider
      const priceProvider = new LiqwidPriceProvider(liqwidClient);
      
      // Step 1: Fetch loans snapshot for health factor monitoring
      logger.info('Fetching loans from Liqwid');
      const loansSnapshot = await liqwidClient.fetchLoansSnapshot({
        paymentAddress: validatedEnv.PAYMENT_ADDRESS
      });
      logger.info(`Fetched ${loansSnapshot.length} loans from Liqwid`);
      
      // Step 2: Process loans and check health factors
      const alertsSent = [];
      const hf_results = [];
      
      // Initialize alert manager for cooldown handling
      const alertManager = new AlertManager(env.HF_MONITOR_STATE);

      for (const loan of loansSnapshot) {
        const healthFactor = loan.healthFactor;
        const assetSymbol = loan.assetSymbol;

        hf_results.push({
          id: loan.id,
          healthFactor,
          assetSymbol
        });
        
        // Check if health factor is below critical threshold
        if (healthFactor < validatedEnv.HF_CRIT) {
          logger.warn(`Critical health factor detected: ${loan.id}`, { healthFactor, assetSymbol, threshold: validatedEnv.HF_CRIT });
          
          // Check if we should send alert based on cooldown rules
          if (await alertManager.shouldSendAlert(loan.id, 'critical', assetSymbol)) {
            await sendAlert('critical', `🚨 CRITICAL: ${assetSymbol} loan has health factor ${healthFactor.toFixed(2)}`, validatedEnv);
            await alertManager.recordAlert(loan.id, 'critical', assetSymbol);
            alertsSent.push({ assetSymbol, id: loan.id, hf: healthFactor, level: 'critical' });
          } else {
            logger.info(`Critical alert suppressed due to cooldown: ${loan.id}`, { healthFactor, assetSymbol });
          }
        } 
        // Check if health factor is below warning threshold
        else if (healthFactor < validatedEnv.HF_WARN) {
          logger.warn(`Warning health factor detected: ${loan.id}`, { healthFactor, assetSymbol, threshold: validatedEnv.HF_WARN });
          
          // Check if we should send alert based on cooldown rules
          if (await alertManager.shouldSendAlert(loan.id, 'warning', assetSymbol)) {
            await sendAlert('warning', `⚠️ WARNING: ${assetSymbol} loan has health factor ${healthFactor.toFixed(2)}`, validatedEnv);
            await alertManager.recordAlert(loan.id, 'warning', assetSymbol);
            alertsSent.push({ assetSymbol, id: loan.id, hf: healthFactor, level: 'warning' });
          } else {
            logger.info(`Warning alert suppressed due to cooldown: ${loan.id}`, { healthFactor, assetSymbol });
          }
        }
      }

      // Log summary
      logger.info('Health Factor Monitor completed', {
        hf_results,
        checked: loansSnapshot.length,
        alertsSent: alertsSent.length,
        alerts: alertsSent
      });
      
      // Step 3: Update Notion database with price information if configured
      if (validatedEnv.NOTION_PRICES_DB_ID) {
        try {
          // Check when the last price update was done
          const lastPriceUpdateTime = env.HF_MONITOR_STATE ? 
            await env.HF_MONITOR_STATE.get('lastPriceUpdateTime') : null;
          const currentTime = Date.now();
          
          // Only fetch prices and update Notion if no previous update or enough time has passed (1 hour)
          const PRICE_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
          
          if (!lastPriceUpdateTime || (currentTime - parseInt(lastPriceUpdateTime)) > PRICE_UPDATE_INTERVAL_MS) {
            // Check if we're in a Cloudflare Worker environment with NOTION_API_TOKEN available
            if (!appConfig.NOTION_API_TOKEN && 'NOTION_API_TOKEN' in env) {
              logger.info('Using NOTION_API_TOKEN from Cloudflare Worker secrets');
              appConfig.NOTION_API_TOKEN = env.NOTION_API_TOKEN as string;
            }
            
            // Initialize Notion adapter with the consolidated config
            const notionAdapter = createNotionAdapter(appConfig);
            
            // First, query Notion to get all asset symbols from the database
            logger.info('Querying Notion database for asset symbols');
            const assetSymbols = await notionAdapter.getAssetSymbols();
            logger.info(`Found ${assetSymbols.length} assets in Notion database`);
            
            if (assetSymbols.length > 0) {
              // Special case: convert 'ADA' to 'Ada' for Liqwid API compatibility
              const liqwidSymbols = assetSymbols.map(symbol => symbol === 'ADA' ? 'Ada' : symbol);
              
              // Fetch prices from Liqwid for all assets in the Notion database
              logger.info(`Fetching prices for ${liqwidSymbols.length} assets from Liqwid`);
              const prices = await priceProvider.getPrices(liqwidSymbols);
              logger.info(`Fetched prices for ${Object.keys(prices).length} assets`);
              
              // Update Notion database with the fetched prices
              logger.info('Updating Notion price database');
              const result = await notionAdapter.updatePriceDatabase(prices);
              
              // Log summary
              logger.info('Notion price database updated', result);
              
              // Update the last price update time
              if (env.HF_MONITOR_STATE) {
                await env.HF_MONITOR_STATE.put('lastPriceUpdateTime', currentTime.toString(), {
                  metadata: JSON.stringify({
                    updated: result.updated,
                    errors: result.errors.length
                  })
                });
              }
            } else {
              logger.info('No assets found in Notion database, skipping price update');
            }
          } else {
            // Log that we're skipping the price update due to throttling
            logger.info('Price update skipped due to throttling', { 
              lastUpdateTime: new Date(parseInt(lastPriceUpdateTime)).toISOString(),
              updateIntervalMs: PRICE_UPDATE_INTERVAL_MS
            });
          }
        } catch (notionError) {
          // Log the error but don't fail the entire job
          logger.error('Failed to update Notion database', { 
            error: notionError instanceof Error ? notionError.message : String(notionError)
          });
        }
      } else {
        logger.info('Skipping Notion update - NOTION_PRICES_DB_ID not configured');
      }
      
    } catch (error) {
      logger.error('Health Factor Monitor failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Send alert about the error, but rate limit to avoid spamming
      try {
        // Check when the last error alert was sent
        const lastErrorTime = env.HF_MONITOR_STATE ? 
          await env.HF_MONITOR_STATE.get('lastErrorAlertTime') : null;
        const currentTime = Date.now();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Only send a new alert if no previous alert or enough time has passed (12 hours)
        const ERROR_ALERT_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
        if (!lastErrorTime || (currentTime - parseInt(lastErrorTime)) > ERROR_ALERT_COOLDOWN_MS) {
          // Create a properly typed environment object for the alert
          // We need to validate the env here since we're not using the validatedEnv from the try block
          const validatedErrorEnv = createEnv(env);
          const errorAppConfig: AppConfig = {
            ...validatedErrorEnv,
            USER_AGENT: validatedErrorEnv.USER_AGENT || 'CardanoDefiHelper/1.0'
          };
          
          await sendAlert('error', `🔥 ERROR: Health Factor Monitor failed: ${errorMessage}`, errorAppConfig);
          
          // Update the last error time
          if (env.HF_MONITOR_STATE) {
            await env.HF_MONITOR_STATE.put('lastErrorAlertTime', currentTime.toString());
          }
          logger.info('Error alert sent and cooldown timer started');
        } else {
          // Log that we're skipping the alert due to rate limiting
          logger.info('Error alert skipped due to rate limiting', { 
            lastAlertTime: new Date(parseInt(lastErrorTime)).toISOString(),
            cooldownMs: ERROR_ALERT_COOLDOWN_MS
          });
        }
      } catch (alertError) {
        logger.error('Failed to send error alert', { 
          error: alertError instanceof Error ? alertError.message : String(alertError) 
        });
      }
    }
  }
};
