/**
 * Test environment utilities
 * 
 * This module provides utilities for setting up test environments
 * with mock environment variables and dependencies.
 */

/**
 * Create a mock environment with test values
 */
export function createMockEnv() {
  return {
    // Notion configuration
    NOTION_API_TOKEN: 'test-token',
    NOTION_PRICES_DB_ID: 'test-db-id',
    
    // Liqwid configuration
    LIQWID_GRAPHQL_URL: 'https://mock-api.liqwid.finance/graphql',
    
    // Health factor monitoring configuration
    PAYMENT_ADDRESS: 'test-address',
    HF_WARN: '1.5',
    HF_CRIT: '1.2',
    
    // Alert configuration (mocked for testing)
    TELEGRAM_TOKEN: 'test-telegram-token',
    CHATID: 'test-chat-id',
    
    // Worker environment
    HF_MONITOR_STATE: 'test-kv-namespace'
  };
}

/**
 * Mock the global environment for testing
 * This is useful for tests that need to access environment variables
 */
export function mockGlobalEnv(mockEnv = createMockEnv()) {
  const originalEnv = { ...process.env };
  
  // Set mock environment variables
  for (const [key, value] of Object.entries(mockEnv)) {
    process.env[key] = value;
  }
  
  // Return a function to restore the original environment
  return () => {
    // Restore original environment variables
    for (const key of Object.keys(mockEnv)) {
      if (key in originalEnv) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
  };
}

/**
 * Mock Cloudflare Workers environment
 * This is useful for tests that need to run in a Workers-like environment
 */
export function mockWorkersEnv(mockEnv = createMockEnv()) {
  // Create mock KV namespace
  const mockKV = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn()
  };
  
  // Create mock env object for Workers
  const env = {
    ...mockEnv,
    HF_MONITOR_STATE: mockKV
  };
  
  // Create mock context
  const ctx = {
    waitUntil: vi.fn()
  };
  
  return { env, ctx, mockKV };
}

/**
 * Import vi from Vitest if available, otherwise provide mock implementations
 * This allows the file to be used in both test and non-test environments
 */
import { vi } from 'vitest';


