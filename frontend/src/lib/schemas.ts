// src/lib/schemas.ts — Zod runtime validation for API responses
// These schemas validate what comes back from the backend so type errors
// surface clearly rather than causing mysterious undefined crashes.

import { z } from "zod";

// ─── Common ───────────────────────────────────────────────────────────────────

export const CareerSchema = z.object({
  title:     z.string(),
  match:     z.number().min(0).max(100),
  avgSalary: z.number(),
  growth:    z.number(),
  reason:    z.string().optional().default(""),
});

export const UniversitySchema = z.object({
  name:        z.string(),
  country:     z.string(),
  program:     z.string().optional().default(""),
  admitChance: z.number().min(0).max(100),
  tuition:     z.number(),
  roi:         z.number().optional().default(0),
  rank:        z.number().optional().default(999),
});

export const LoanEvalSchema = z.object({
  eligibleAmount: z.number(),
  rate:           z.number(),
  tenureYears:    z.number(),
  emi:            z.number(),
  riskScore:      z.number(),
  approval:       z.enum(["high", "medium", "low"]),
});

export const SalaryTimelineSchema = z.object({
  year:          z.number(),
  gross_usd:     z.number(),
  after_tax_usd: z.number(),
  emi_usd:       z.number().optional().default(0),
  savings_usd:   z.number().optional().default(0),
  net_usd:       z.number().optional().default(0),
  gross_inr:     z.number().optional(),
  after_tax_inr: z.number().optional(),
  emi_inr:       z.number().optional(),
  savings_inr:   z.number().optional(),
  net_inr:       z.number().optional(),
});

export const AnalyzeResultSchema = z.object({
  careers:     z.array(CareerSchema),
  universities: z.array(UniversitySchema),
  loan:        LoanEvalSchema.optional(),
  realityScore: z.number().optional().default(0),
  roiScore:    z.number().optional().default(0),
  riskScore:   z.number().optional().default(0),
  confidence:  z.number().optional().default(0),
  summary:     z.string().optional().default(""),
  finalDecision: z.object({
    verdict:         z.string(),
    color:           z.string(),
    confidence:      z.number(),
    headline:        z.string(),
    explanation:     z.string(),
    suggestedAction: z.string(),
    actionTimeline:  z.array(z.object({ week: z.number(), action: z.string() })).optional(),
    conditions:      z.array(z.string()).optional(),
    alternativePaths: z.array(z.object({
      path: z.string(), why_consider: z.string(),
      roi_difference: z.string(), risk_difference: z.string(),
    })).optional(),
    parentSummary:  z.string().optional(),
    studentMessage: z.string().optional(),
    keyReasons:     z.array(z.object({ reason: z.string(), impact: z.string(), weight: z.string() })).optional(),
  }).optional(),
  scores: z.object({
    overall: z.number(), career: z.number(), financial: z.number(),
    risk: z.number(), realityCheck: z.number(),
  }).optional(),
  finance: z.object({
    monthlyEmiInr:      z.number(),
    monthlyEmiUsd:      z.number(),
    loanAmountInr:      z.number(),
    roiMultiple:        z.number(),
    breakEvenMonths:    z.number(),
    paybackYears:       z.number(),
    stressLevel:        z.string(),
    stressScore:        z.number(),
    emiAsPctSalary:     z.number(),
    totalCostInr:       z.number(),
    totalRepaymentInr:  z.number(),
    netWorth5yrInr:     z.number(),
    salaryTimeline:     z.array(SalaryTimelineSchema),
  }).optional(),
  risk: z.object({
    compositeScore:       z.number(),
    category:             z.string(),
    dropoutProbability:   z.number(),
    redAlerts: z.array(z.object({
      alert: z.string(), severity: z.string(), description: z.string(), action: z.string(),
    })).optional(),
  }).optional(),
});

export const ProfileInputSchema = z.object({
  highest_education:       z.string().optional(),
  gpa:                     z.number().min(0).max(10).optional(),
  gpa_scale:               z.number().optional(),
  major:                   z.string().max(200).optional(),
  institution_name:        z.string().max(300).optional(),
  graduation_year:         z.number().int().min(1990).max(2035).optional(),
  technical_skills:        z.array(z.string()).max(30).optional(),
  soft_skills:             z.array(z.string()).max(20).optional(),
  interests:               z.array(z.string()).max(20).optional(),
  work_experience_months:  z.number().int().min(0).max(600).optional(),
  work_experience_summary: z.string().max(1000).optional(),
  annual_family_income:    z.number().min(0).optional(),
  income_currency:         z.enum(["INR", "USD", "EUR", "GBP", "AUD", "CAD"]).optional(),
  savings_available:       z.number().min(0).optional(),
  has_property:            z.boolean().optional(),
  has_cosigner:            z.boolean().optional(),
  target_degree:           z.enum(["master", "phd", "mba", "diploma", "bachelor", "certificate"]).optional(),
  target_fields:           z.array(z.string()).max(10).optional(),
  target_countries:        z.array(z.string()).max(10).optional(),
  target_start_year:       z.number().int().min(2024).max(2035).optional(),
  budget_min:              z.number().min(0).optional(),
  budget_max:              z.number().min(0).optional(),
  career_goals:            z.string().max(1000).optional(),
  motivation_text:         z.string().max(1000).optional(),
  risk_appetite:           z.enum(["conservative", "moderate", "aggressive"]).optional(),
});

export const RegisterSchema = z.object({
  email:          z.string().email("Invalid email address"),
  password:       z.string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  firstName:      z.string().min(1).max(100),
  lastName:       z.string().min(1).max(100),
  phone:          z.string().optional(),
  nationality:    z.string().optional(),
  currentCountry: z.string().optional(),
});

export const LoginSchema = z.object({
  email:    z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

// ─── Type exports (inferred from Zod schemas) ─────────────────────────────────
export type Career         = z.infer<typeof CareerSchema>;
export type University     = z.infer<typeof UniversitySchema>;
export type LoanEval       = z.infer<typeof LoanEvalSchema>;
export type AnalyzeResult  = z.infer<typeof AnalyzeResultSchema>;
export type ProfileInput   = z.infer<typeof ProfileInputSchema>;
export type RegisterInput  = z.infer<typeof RegisterSchema>;
export type LoginInput     = z.infer<typeof LoginSchema>;

// ─── Safe parse helper ────────────────────────────────────────────────────────
export function safeParse<T>(schema: z.ZodType<T>, data: unknown): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data, error: null };
  const messages = result.error.issues.map(i => i.message).join("; ");
  return { data: null, error: messages };
}
