/**
 * Unit tests for health factor calculations
 */
import { describe, it, expect } from 'vitest';
import { calculateHealthFactor, getRiskLevel } from '../../src/lib/healthFactor.js';
import { Loan } from '../../src/lib/models.js';

describe('Health Factor Calculations', () => {
  describe('calculateHealthFactor', () => {
    it('should return existing health factor if available', () => {
      const loan: Loan = {
        id: 'test-loan',
        healthFactor: 1.8,
        userAddress: 'test-address',
        borrowedAsset: 'ADA',
        borrowedAmount: 500,
        collaterals: [],
        collateralValue: 1000,
        lastUpdated: new Date().toISOString()
      };
      
      expect(calculateHealthFactor(loan)).toBe(1.8);
    });
    
    it('should calculate health factor from collateral value and borrowed amount', () => {
      const loan: Loan = {
        id: 'test-loan',
        userAddress: 'test-address',
        borrowedAsset: 'ADA',
        collateralValue: 1000,
        borrowedAmount: 500,
        collaterals: [],
        healthFactor: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Expected: (1000 * 0.825) / 500 = 1.65
      expect(calculateHealthFactor(loan)).toBe(1.65);
    });
    
    it('should handle custom liquidation threshold', () => {
      const loan: Loan = {
        id: 'test-loan',
        userAddress: 'test-address',
        borrowedAsset: 'ADA',
        collateralValue: 1000,
        borrowedAmount: 500,
        collaterals: [],
        healthFactor: 0,
        lastUpdated: new Date().toISOString()
      };
      
      // Expected: (1000 * 0.75) / 500 = 1.5
      expect(calculateHealthFactor(loan, 0.75)).toBe(1.5);
    });
    
    it('should return Infinity for zero borrowed amount', () => {
      const loan: Loan = {
        id: 'test-loan',
        userAddress: 'test-address',
        borrowedAsset: 'ADA',
        collateralValue: 1000,
        borrowedAmount: 0,
        collaterals: [],
        healthFactor: 0,
        lastUpdated: new Date().toISOString()
      };
      
      expect(calculateHealthFactor(loan)).toBe(Infinity);
    });
    
    it('should return 0 for insufficient loan data', () => {
      const loan: Loan = {
        id: 'test-loan',
        userAddress: 'test-address',
        borrowedAsset: 'ADA',
        borrowedAmount: 0,
        collaterals: [],
        collateralValue: 0,
        healthFactor: 0,
        lastUpdated: new Date().toISOString()
      };
      
      expect(calculateHealthFactor(loan)).toBe(0);
    });
  });
  
  describe('getRiskLevel', () => {
    it('should return safe for health factor above warn threshold', () => {
      expect(getRiskLevel(2.0, 1.7, 1.5)).toBe('safe');
    });
    
    it('should return warning for health factor between warn and critical thresholds', () => {
      expect(getRiskLevel(1.6, 1.7, 1.5)).toBe('warning');
    });
    
    it('should return critical for health factor below critical threshold', () => {
      expect(getRiskLevel(1.4, 1.7, 1.5)).toBe('critical');
    });
    
    it('should use default thresholds if not provided', () => {
      // Default thresholds are warn=1.7, critical=1.5
      expect(getRiskLevel(1.8)).toBe('safe');
      expect(getRiskLevel(1.6)).toBe('warning');
      expect(getRiskLevel(1.4)).toBe('critical');
    });
    
    it('should handle edge cases', () => {
      // Exactly at thresholds
      expect(getRiskLevel(1.7, 1.7, 1.5)).toBe('safe');
      expect(getRiskLevel(1.5, 1.7, 1.5)).toBe('warning');
      
      // Extreme values
      expect(getRiskLevel(0)).toBe('critical');
      expect(getRiskLevel(Infinity)).toBe('safe');
    });
  });
});
