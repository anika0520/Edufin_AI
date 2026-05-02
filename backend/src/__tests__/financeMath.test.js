// src/__tests__/financeMath.test.js
const {
  calcEMI, calcTotalInterest, calcBreakEvenMonths, calcDTI,
  calcROIMultiple, calcNPV, calcPaybackYears, calcStressLevel,
  calcSafeLoanMax, estimateTaxRate, validateAndOverwriteFinanceOutput,
} = require('../utils/financeMath');

describe('financeMath — deterministic calculations', () => {

  describe('calcEMI', () => {
    test('standard 10yr loan at 9.5%', () => {
      const emi = calcEMI(4000000, 9.5, 120);
      // Exact EMI formula: P*r*(1+r)^n / ((1+r)^n - 1) at 9.5%/12 → ~₹51,759/month
      expect(emi).toBeCloseTo(51759, -2);
    });
    test('zero interest → principal / months', () => {
      expect(calcEMI(120000, 0, 12)).toBeCloseTo(10000, 0);
    });
    test('returns 0 for missing args', () => {
      expect(calcEMI(0, 9.5, 120)).toBe(0);
      expect(calcEMI(100000, 0, 0)).toBe(0);
    });
  });

  describe('calcTotalInterest', () => {
    test('interest = (EMI × months) − principal', () => {
      const principal = 4000000;
      const emi       = calcEMI(principal, 9.5, 120);
      const interest  = calcTotalInterest(principal, emi, 120);
      expect(interest).toBeGreaterThan(0);
      expect(interest + principal).toBeCloseTo(emi * 120, -2);
    });
  });

  describe('calcBreakEvenMonths', () => {
    test('breaks even in reasonable time with positive surplus', () => {
      const months = calcBreakEvenMonths(5000000, 100000, 40000);
      expect(months).toBeCloseTo(84, 0); // 5M / 60K = ~83 months
    });
    test('returns 9999 when no surplus', () => {
      expect(calcBreakEvenMonths(1000000, 40000, 40000)).toBe(9999);
    });
  });

  describe('calcDTI', () => {
    test('40% DTI for equal EMI and salary', () => {
      expect(calcDTI(480000, 1200000)).toBeCloseTo(40, 0);
    });
    test('handles zero salary', () => {
      expect(calcDTI(100000, 0)).toBe(100);
    });
  });

  describe('calcStressLevel', () => {
    test('low stress < 20%', () => {
      expect(calcStressLevel(15).level).toBe('low');
    });
    test('medium stress 20-35%', () => {
      expect(calcStressLevel(28).level).toBe('medium');
    });
    test('high stress 35-50%', () => {
      expect(calcStressLevel(42).level).toBe('high');
    });
    test('critical stress > 50%', () => {
      expect(calcStressLevel(55).level).toBe('critical');
    });
    test('score is always 0-100', () => {
      for (const pct of [5, 20, 35, 50, 70]) {
        const { score } = calcStressLevel(pct);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('estimateTaxRate', () => {
    test('India — low income is 0%', () => {
      expect(estimateTaxRate('India', 250000)).toBe(0);
    });
    test('India — high income is 30%', () => {
      expect(estimateTaxRate('India', 2000000)).toBe(30);
    });
    test('Germany — high bracket', () => {
      expect(estimateTaxRate('Germany', 100000)).toBe(42);
    });
    test('USA — mid bracket', () => {
      expect(estimateTaxRate('USA', 80000)).toBe(22);
    });
  });

  describe('validateAndOverwriteFinanceOutput', () => {
    const mockProfile = { max_loan_comfort: 50000, target_countries: ['USA'] };
    const mockCareer  = { top_career_entry_salary_usd: 80000 };
    const mockLoan    = { requestedAmount: 50000 };

    test('overwrites LLM EMI with correct calculated value', () => {
      const llmOutput = {
        monthly_emi_usd: 9999, // Wrong LLM value
        interest_rate_percent: 9.5,
        loan_tenure_months: 120,
        total_education_cost_usd: 60000,
      };
      const result = validateAndOverwriteFinanceOutput(llmOutput, mockProfile, mockLoan, mockCareer);
      const expectedEmi = calcEMI(50000, 9.5, 120);
      expect(result.monthly_emi_usd).toBeCloseTo(expectedEmi, 0);
      expect(result._deterministic).toBe(true);
    });

    test('produces salary timeline with 6 entries', () => {
      const result = validateAndOverwriteFinanceOutput({}, mockProfile, mockLoan, mockCareer);
      expect(result.salary_timeline_usd).toHaveLength(6);
    });

    test('salary grows over time in timeline', () => {
      const result = validateAndOverwriteFinanceOutput({}, mockProfile, mockLoan, mockCareer);
      const t = result.salary_timeline_usd;
      expect(t[t.length - 1].gross_usd).toBeGreaterThan(t[0].gross_usd);
    });
  });
});
