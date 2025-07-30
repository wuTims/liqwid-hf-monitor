import { z } from 'zod';
import { AppConfig } from './lib/models.js';

/**
 * Environment variable schema for the Health Factor Worker
 * Ensures compatibility with CloudflareEnv from @cardano-defi-helper/core
 */
export const envSchema = z.object({
  // Liqwid GraphQL API URL
  LIQWID_GRAPHQL_URL: z.string().url(),
  
  // Health Factor thresholds
  HF_WARN: z.coerce.number().positive(),
  HF_CRIT: z.coerce.number().positive(),
  
  // Telegram notification settings (must be strings for CloudflareEnv compatibility)
  TELEGRAM_TOKEN: z.string().min(1),
  CHATID: z.string().min(1),
  
  // Cardano payment address to monitor
  PAYMENT_ADDRESS: z.string().default(''),
  
  // Optional KV namespace for storing monitor state
  HF_MONITOR_STATE: z.any().optional(),
  
  // Optional Notion configuration
  NOTION_PRICES_DB_ID: z.string().optional(),
  NOTION_API_TOKEN: z.string().optional(),
  
  // User agent for API requests
  USER_AGENT: z.string().default('CardanoDefiHelper/1.0'),
});

/**
 * Type definition for the environment variables
 * This extends AppConfig to ensure consistency across the application
 */
export type WorkerEnv = z.infer<typeof envSchema> & AppConfig;

/**
 * Validates the environment variables
 * @param env The raw environment variables
 * @returns The validated environment variables
 * @throws Error if validation fails
 */
export function validateEnv(env: Record<string, unknown>): WorkerEnv {
  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      ).join(', ');
      throw new Error(`Environment validation failed: ${issues}`);
    }
    throw new Error(`Environment validation failed: ${String(error)}`);
  }
}

/**
 * Create a validated environment object that can be used throughout the application
 * @param env The raw environment variables
 * @returns The validated environment variables
 */
export function createEnv(env: Record<string, unknown>): WorkerEnv {
  const validatedEnv = validateEnv(env);
  return validatedEnv;
}
