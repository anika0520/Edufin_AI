// src/utils/financeMath.js — Deterministic Financial Calculations
// ALL numeric finance computations live here — LLM is ONLY used for
// synthesis and personalization, not arithmetic.

/**
 * EMI = [P × r × (1+r)^n] / [(1+r)^n - 1]
 * @param {number} principal  Loan amount
 * @param {number} annualRate Annual interest rate (percent, e.g. 9.5)
 * @param {number} months     Loan tenure in months
 */
function calcEMI(principal, annualRate, months) {
  if (!principal || !months) return 0;
  const r = annualRate / 100 / 12;
  const n = months;
  if (!annualRate || r === 0) return Math.round((principal / n) * 100) / 100;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(emi * 100) / 100;
}

/**
 * Total interest paid over loan tenure.
 */
function calcTotalInterest(principal, emi, months) {
  return Math.round((emi * months - principal) * 100) / 100;
}

/**
 * Break-even months = Total cost / (Monthly salary − Monthly living expenses)
 */
function calcBreakEvenMonths(totalCost, monthlySalary, monthlyLivingExpenses) {
  const monthlySurplus = monthlySalary - monthlyLivingExpenses;
  if (monthlySurplus <= 0) return 9999; // Never breaks even
  return Math.ceil(totalCost / monthlySurplus);
}

/**
 * Debt-to-income ratio = Annual EMI / Annual gross salary
 */
function calcDTI(annualEMI, annualSalary) {
  if (!annualSalary) return 100;
  return Math.round((annualEMI / annualSalary) * 10000) / 100; // percentage
}

/**
 * ROI multiple = (Cumulative 5yr earnings − Total cost) / Total cost
 */
function calcROIMultiple(annualSalary, salaryGrowthRate, totalCost, years = 5) {
  let cumulative = 0;
  let salary = annualSalary;
  for (let i = 0; i < years; i++) {
    cumulative += salary;
    salary *= 1 + salaryGrowthRate / 100;
  }
  if (!totalCost) return 0;
  return Math.round(((cumulative - totalCost) / totalCost) * 100) / 100;
}

/**
 * Net Present Value of a stream of future salaries, discounted at given rate.
 * @param {number} annualSalary     Entry salary
 * @param {number} growthRate       Annual growth % (e.g. 8)
 * @param {number} discountRate     Discount rate % (e.g. 10)
 * @param {number} years            Projection years
 * @param {number} totalInvestment  Up-front cost
 */
function calcNPV(annualSalary, growthRate, discountRate, years = 10, totalInvestment = 0) {
  let npv = -totalInvestment;
  let salary = annualSalary;
  const d = discountRate / 100;
  for (let t = 1; t <= years; t++) {
    npv += salary / Math.pow(1 + d, t);
    salary *= 1 + growthRate / 100;
  }
  return Math.round(npv);
}

/**
 * Payback period = Total loan / (Annual salary × 0.30)
 * Assumes 30% of salary allocated to repayment.
 */
function calcPaybackYears(totalLoan, annualSalary, allocationPct = 30) {
  const annualPayment = annualSalary * (allocationPct / 100);
  if (!annualPayment) return 99;
  return Math.round((totalLoan / annualPayment) * 10) / 10;
}

/**
 * Build full salary timeline with taxes, EMI, and savings for N years.
 */
function buildSalaryTimeline(entrySalary, growthRate, emi, taxRate, years = 10) {
  const timeline = [];
  let salary = entrySalary;
  const monthlyLiving = salary * 0.30 / 12; // 30% living cost estimate

  for (const year of [1, 2, 3, 5, 7, 10].filter(y => y <= years)) {
    // Compound salary to this year
    let yearSalary = entrySalary;
    for (let y = 1; y < year; y++) yearSalary *= 1 + growthRate / 100;

    const afterTax = yearSalary * (1 - taxRate / 100);
    const monthlyAfterTax = afterTax / 12;
    const monthlyEMI = emi;
    const monthlySavings = monthlyAfterTax - monthlyEMI - monthlyLiving;

    timeline.push({
      year,
      gross_usd:     Math.round(yearSalary),
      after_tax_usd: Math.round(afterTax),
      emi_usd:       Math.round(monthlyEMI * 12),
      savings_usd:   Math.round(monthlySavings * 12),
      net_usd:       Math.round(monthlySavings * 12),
    });
  }
  return timeline;
}

/**
 * Determine financial stress level from EMI-to-salary ratio.
 */
function calcStressLevel(emiAsPctSalary) {
  if (emiAsPctSalary < 20) return { level: 'low',      score: Math.round(emiAsPctSalary * 1.5) };
  if (emiAsPctSalary < 35) return { level: 'medium',   score: Math.round(30 + (emiAsPctSalary - 20) * 2) };
  if (emiAsPctSalary < 50) return { level: 'high',     score: Math.round(60 + (emiAsPctSalary - 35) * 2) };
  return                           { level: 'critical', score: Math.min(99, Math.round(90 + emiAsPctSalary - 50)) };
}

/**
 * Max safe loan based on 30% of annual entry salary, 10-year tenure.
 */
function calcSafeLoanMax(annualEntrySalary, annualInterestRate = 9.5, years = 10) {
  const annualBudget = annualEntrySalary * 0.30;
  const r = annualInterestRate / 100 / 12;
  const n = years * 12;
  // Inverse EMI formula: P = EMI × [(1+r)^n − 1] / [r × (1+r)^n]
  const monthlyBudget = annualBudget / 12;
  const maxLoan = monthlyBudget * ((Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)));
  return Math.round(maxLoan);
}

/**
 * Estimate Indian tax for a given income (simplified FY2024-25 new regime).
 */
function estimateTaxRateIndia(annualIncomeInr) {
  if (annualIncomeInr <= 300000)  return 0;
  if (annualIncomeInr <= 600000)  return 5;
  if (annualIncomeInr <= 900000)  return 10;
  if (annualIncomeInr <= 1200000) return 15;
  if (annualIncomeInr <= 1500000) return 20;
  return 30;
}

/**
 * Estimate US federal tax rate (simplified 2024 brackets, single filer).
 */
function estimateTaxRateUS(annualIncomeUsd) {
  if (annualIncomeUsd <= 11600)  return 10;
  if (annualIncomeUsd <= 47150)  return 12;
  if (annualIncomeUsd <= 100525) return 22;
  if (annualIncomeUsd <= 191950) return 24;
  return 32;
}

/**
 * Estimate German tax rate (simplified, includes solidarity surcharge).
 */
function estimateTaxRateGermany(annualIncomeEur) {
  if (annualIncomeEur <= 11604) return 0;
  if (annualIncomeEur <= 17005) return 14;
  if (annualIncomeEur <= 66760) return 24;
  if (annualIncomeEur <= 277825) return 42;
  return 45;
}

function estimateTaxRate(country, income) {
  const c = (country || '').toLowerCase();
  if (c.includes('india'))   return estimateTaxRateIndia(income);
  if (c.includes('germany')) return estimateTaxRateGermany(income);
  if (c.includes('canada'))  return 26; // Simplified Canadian rate
  if (c.includes('uk') || c.includes('britain')) return 20;
  if (c.includes('australia')) return 22;
  return estimateTaxRateUS(income); // Default to US
}

/**
 * Validate and fix LLM-produced finance output by overwriting with
 * deterministic calculations where possible.
 */
function validateAndOverwriteFinanceOutput(llmOutput, profile, loanData, careerData) {
  const usdInr = parseInt(process.env.USD_TO_INR_RATE || 83);
  const annualRate = llmOutput.interest_rate_percent || 9.5;
  const months     = llmOutput.loan_tenure_months    || 120;
  const loanUsd    = loanData?.requestedAmount || profile.max_loan_comfort || 40000;
  const salaryUsd  = careerData?.top_career_entry_salary_usd || llmOutput.salary_timeline_usd?.[0]?.gross_usd || 60000;
  const country    = profile.target_countries?.[0] || 'USA';

  // Deterministic overwrites
  const emi           = calcEMI(loanUsd, annualRate, months);
  const totalInterest = calcTotalInterest(loanUsd, emi, months);
  const taxRate       = estimateTaxRate(country, salaryUsd);
  const annualEMI     = emi * 12;
  const dti           = calcDTI(annualEMI, salaryUsd);
  const emiPctSalary  = Math.round((annualEMI / salaryUsd) * 100);
  const stress        = calcStressLevel(emiPctSalary);
  const payback       = calcPaybackYears(loanUsd, salaryUsd);
  const roiMultiple   = calcROIMultiple(salaryUsd, 8, llmOutput.total_education_cost_usd || loanUsd * 1.2);
  const breakEven     = calcBreakEvenMonths(llmOutput.total_education_cost_usd || loanUsd * 1.2, salaryUsd / 12, salaryUsd * 0.35 / 12);
  const safeLoanMax   = calcSafeLoanMax(salaryUsd, annualRate);
  const npv           = calcNPV(salaryUsd, 8, 10, 10, llmOutput.total_education_cost_usd || loanUsd * 1.2);
  const timeline      = buildSalaryTimeline(salaryUsd, 8, emi, taxRate);

  return {
    ...llmOutput,
    // Overwrite with deterministic values
    monthly_emi_usd:         Math.round(emi),
    annual_emi_usd:          Math.round(annualEMI),
    total_interest_paid_usd: Math.round(totalInterest),
    total_repayment_usd:     Math.round(loanUsd + totalInterest),
    debt_to_income_ratio:    dti,
    emi_as_percent_of_salary: emiPctSalary,
    financial_stress_level:  stress.level,
    financial_stress_score:  stress.score,
    payback_years:           payback,
    roi_multiple:            roiMultiple,
    break_even_months:       breakEven,
    safe_loan_max_usd:       safeLoanMax,
    net_present_value_usd:   npv,
    tax_rate_assumed_percent: taxRate,
    salary_timeline_usd:     timeline,
    loan_safety_verdict:     loanUsd <= safeLoanMax * 0.8 ? 'safe' :
                             loanUsd <= safeLoanMax       ? 'borderline' :
                             loanUsd <= safeLoanMax * 1.3 ? 'risky' : 'dangerous',
    _math_validated: true,
    _deterministic:  true,
  };
}

module.exports = {
  calcEMI, calcTotalInterest, calcBreakEvenMonths, calcDTI,
  calcROIMultiple, calcNPV, calcPaybackYears, buildSalaryTimeline,
  calcStressLevel, calcSafeLoanMax, estimateTaxRate,
  validateAndOverwriteFinanceOutput,
};
