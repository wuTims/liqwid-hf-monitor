/**
 * Alert Manager - Handles cooldown logic for telegram alerts
 * 
 * This module manages alert cooldowns to prevent spam notifications.
 * It tracks sent alerts in KV storage with automatic expiration.
 */

import { AlertLevel } from './alerts.js';

/**
 * Record of a sent alert stored in KV
 */
export interface AlertRecord {
  level: 'warning' | 'critical';
  timestamp: number;
  assetSymbol: string;
}

/**
 * Alert Manager for handling cooldown logic
 */
export class AlertManager {
  private static readonly COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
  private static readonly KV_TTL_SECONDS = 3600; // 1 hour expiration
  
  constructor(private kv: KVNamespace | undefined) {}
  
  /**
   * Check if an alert should be sent based on cooldown rules
   * 
   * @param loanId - The loan identifier
   * @param currentLevel - The current alert level to send
   * @param assetSymbol - The asset symbol for the loan
   * @returns true if alert should be sent, false if cooldown active
   */
  async shouldSendAlert(
    loanId: string, 
    currentLevel: AlertLevel, 
    _assetSymbol: string
  ): Promise<boolean> {
    // If no KV storage available, always send (fallback behavior)
    if (!this.kv) {
      return true;
    }
    
    // Skip non-critical alert levels
    if (currentLevel !== 'warning' && currentLevel !== 'critical') {
      return true;
    }
    
    try {
      // Fetch the last alert for this loan
      const key = `alert:${loanId}`;
      const storedData = await this.kv.get(key);
      
      // No previous alert, send immediately
      if (!storedData) {
        return true;
      }
      
      // Parse the stored alert record
      const lastAlert: AlertRecord = JSON.parse(storedData);
      const timeSinceLastAlert = Date.now() - lastAlert.timestamp;
      
      // Check for tier escalation (warning → critical)
      if (currentLevel === 'critical' && lastAlert.level === 'warning') {
        // Alert has escalated, send immediately
        return true;
      }
      
      // Check if cooldown period has passed for same tier
      if (timeSinceLastAlert >= AlertManager.COOLDOWN_MS) {
        return true;
      }
      
      // Still in cooldown period for same tier
      return false;
      
    } catch (error) {
      // On any error, default to sending the alert
      console.error('Error checking alert cooldown:', error);
      return true;
    }
  }
  
  /**
   * Record that an alert was sent
   * 
   * @param loanId - The loan identifier
   * @param level - The alert level that was sent
   * @param assetSymbol - The asset symbol for the loan
   */
  async recordAlert(
    loanId: string, 
    level: AlertLevel, 
    assetSymbol: string
  ): Promise<void> {
    // If no KV storage available, skip recording
    if (!this.kv) {
      return;
    }
    
    // Only record warning and critical alerts
    if (level !== 'warning' && level !== 'critical') {
      return;
    }
    
    try {
      const key = `alert:${loanId}`;
      const record: AlertRecord = {
        level: level as 'warning' | 'critical',
        timestamp: Date.now(),
        assetSymbol
      };
      
      // Store with automatic expiration after 1 hour
      await this.kv.put(key, JSON.stringify(record), {
        expirationTtl: AlertManager.KV_TTL_SECONDS,
        metadata: JSON.stringify({
          assetSymbol,
          level,
          createdAt: new Date().toISOString()
        })
      });
      
    } catch (error) {
      // Log error but don't fail the operation
      console.error('Error recording alert:', error);
    }
  }
  
  /**
   * Get the last alert record for a loan (for debugging/monitoring)
   * 
   * @param loanId - The loan identifier
   * @returns The last alert record or null if none exists
   */
  async getLastAlert(loanId: string): Promise<AlertRecord | null> {
    if (!this.kv) {
      return null;
    }
    
    try {
      const key = `alert:${loanId}`;
      const storedData = await this.kv.get(key);
      
      if (!storedData) {
        return null;
      }
      
      return JSON.parse(storedData) as AlertRecord;
    } catch (error) {
      console.error('Error fetching last alert:', error);
      return null;
    }
  }
}