import { Loan } from './models.js';

/**
 * Calculates the health factor for a loan
 * Health Factor = (Collateral Value in USD * Liquidation Threshold) / Debt Value in USD
 * 
 * @param loan The loan data from Liqwid
 * @param liquidationThreshold Optional liquidation threshold, defaults to 0.825 (82.5%)
 * @returns The calculated health factor as a number
 */
export function calculateHealthFactor(loan: Loan, liquidationThreshold = 0.825): number {
  // If the loan already has a health factor calculated, return it
  if (loan.healthFactor) {
    return loan.healthFactor;
  }
  
  // If we have collateral value and borrowed amount, we can calculate
  if (loan.collateralValue && loan.borrowedAmount !== undefined) {
    // Avoid division by zero
    if (loan.borrowedAmount === 0) {
      return Infinity; // No debt means infinite health factor
    }
    
    // Calculate health factor
    return (loan.collateralValue * liquidationThreshold) / loan.borrowedAmount;
  }
  
  // If we don't have enough information, return a default value
  console.warn('Insufficient loan data to calculate health factor');
  return 0;
}

/**
 * Determines the risk level based on health factor
 * 
 * @param healthFactor The calculated health factor
 * @param warnThreshold The warning threshold (default: 1.5)
 * @param criticalThreshold The critical threshold (default: 1.2)
 * @returns Risk level as 'safe', 'warning', or 'critical'
 */
export function getRiskLevel(
  healthFactor: number, 
  warnThreshold = 1.7, 
  criticalThreshold = 1.5
): 'safe' | 'warning' | 'critical' {
  if (healthFactor < criticalThreshold) {
    return 'critical';
  } else if (healthFactor < warnThreshold) {
    return 'warning';
  } else {
    return 'safe';
  }
}
