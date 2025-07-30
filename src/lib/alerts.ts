// Using native fetch available in Cloudflare Workers
import { AppConfig } from './models.js';

// Alert level type
export type AlertLevel = 'info' | 'warning' | 'critical' | 'error';

/**
 * Environment interface for alert functionality
 * @deprecated Use AppConfig instead
 */
export interface AlertEnv {
  TELEGRAM_TOKEN: string;
  CHATID: string;
}

/**
 * Sends an alert message to Telegram
 * 
 * @param level The alert level (info, warning, critical, error)
 * @param message The message to send
 * @param config Application configuration containing TELEGRAM_TOKEN and CHATID
 * @returns Promise resolving to success status
 */
export async function sendAlert(
  level: AlertLevel, 
  message: string, 
  config: AppConfig
): Promise<boolean> {
  // Validate required environment variables
  if (!config.TELEGRAM_TOKEN || !config.CHATID) {
    console.error('Missing required Telegram configuration');
    return false;
  }
  
  // Format message with timestamp and level indicator
  const formattedMessage = `[${new Date().toISOString()}] ${message}`;
  
  // Maximum retries for rate limiting
  const MAX_RETRIES = 3;
  let retries = 0;
  
  while (retries <= MAX_RETRIES) {
    try {
      // Construct Telegram Bot API URL
      const apiUrl = `https://api.telegram.org/bot${config.TELEGRAM_TOKEN}/sendMessage`;
      
      // Send message
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: config.CHATID,
          text: formattedMessage,
          parse_mode: 'Markdown',
        }),
      });
      
      // Check response
      if (response.ok) {
        return true;
      }
      
      // Handle rate limiting (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '30', 10);
        console.warn(`Rate limited by Telegram API. Retrying after ${retryAfter} seconds.`);
        
        // Wait for the specified time before retrying
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        retries++;
        continue;
      }
      
      // Other error
      const errorData = await response.json().catch(() => ({ description: 'Unknown error' })) as { description?: string };
      throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
      
    } catch (error) {
      console.error('Failed to send Telegram alert:', error);
      
      // Exponential backoff for other errors
      if (retries < MAX_RETRIES) {
        const backoffTime = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        retries++;
      } else {
        return false;
      }
    }
  }
  
  return false;
}
