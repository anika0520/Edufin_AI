import { useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, ListChecks, ShieldAlert, Sparkles, XCircle, TrendingUp, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/GlassCard";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/currency";

export default function Decision() {
  const { analysis, viewMode } = useAppStore();
  useEffect(() => { document.title = "Final Decision — EduFin_AI"; }, []);

  const fd = analysis?.finalDecision;
  const scores = analysis?.scores;
  const finance = analysis?.finance;
  const risk = analysis?.risk;

  // Determine verdict from finalDecision or fall back to realityScore
  const verdict = fd?.verdict
    ?? (!analysis ? "Recommended"
      : analysis.realityScore >= 70 ? "Recommended"
      : analysis.realityScore >= 50 ? "Risky but Viable"
      : "Not Advisable at This Time");

  const config = {
    "Recommended": {
      label: "Recommended",
      icon: CheckCircle2,
      color: "success",
      gradient: "from-success/20 to-primary/10",
      border: "border-success/40",
    },
    "Recommended with Conditions": {
      label: "Recommended with Conditions",
      icon: AlertCircle,
      color: "warning",
      gradient: "from-warning/20 to-accent/10",
      border: "border-warning/40",
    },
    "Risky but Viable": {
      label: "Risky but Viable",
      icon: ShieldAlert,
      color: "warning",
      gradient: "from-warning/20 to-accent/10",
      border: "border-warning/40",
    },
    "Not Advisable at This Time": {
      label: "Not Advisable at This Time",
      icon: XCircle,
      color: "danger",
      gradient: "from-danger/20 to-warning/10",
      border: "border-danger/40",
    },
  } as const;

  const c = config[verdict as keyof typeof config] ?? config["Recommended"];
  const Icon = c.icon;

  const reasons = fd?.keyReasons?.filter(r => r.impact === "positive").map(r => r.reason)
    ?? [
      "Strong skill-market fit — top 18% of similar profiles",
      "Loan EMI stays under 25% of expected starting salary",
      "Target country has 87% post-study work approval rate",
      "Family income covers 6-month emergency buffer",
    ];

  const risks = fd?.keyReasons?.filter(r => r.impact === "negative").map(r => r.reason)
    ?? [
      "Currency volatility could add 8–12% to EMI",
      "Job market timing is sensitive — avoid late application cycles",
      "Backup plan needed if primary admit doesn't land",
    ];

  const actions = fd?.actionTimeline?.map(a => a.action)
    ?? [
      "Apply to 5 schools across two cost tiers (high + medium)",
      "Secure a letter of recommendation from your current employer or professor",
      "Research scholarship options — 40% of admits receive partial funding",
      "Open a dedicated savings account for emergency EMI buffer (6 months)",
    ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <div className="text-sm text-primary font-medium">AI Verdict</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">
          Your <span className="gradient-text">final decision</span>
        </h1>
        <p className="text-muted-foreground mt-2">Based on career, finance, and risk analysis from our multi-agent system.</p>
      </div>

      {/* Main Verdict Card */}
      <GlassCard className={cn("relative overflow-hidden border-2", c.border)} delay={0.05}>
        <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", c.gradient)} />
        <div className="relative flex items-start gap-5">
          <div className={cn("h-16 w-16 rounded-2xl grid place-items-center shrink-0", {
            "bg-success/20": c.color === "success",
            "bg-warning/20": c.color === "warning",
            "bg-danger/20": c.color === "danger",
          })}>
            <Icon className={cn("h-8 w-8", {
              "text-success": c.color === "success",
              "text-warning": c.color === "warning",
              "text-danger": c.color === "danger",
            })} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-2xl">{c.label}</h2>
              {fd?.confidence && (
                <Badge variant="outline" className="text-xs">{fd.confidence}% AI Confidence</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              {fd?.explanation ?? (
                verdict === "Recommended"
                  ? "Your profile shows strong academic alignment, manageable financial risk, and favorable career market conditions. This is a calculated bet worth taking."
                  : verdict === "Risky but Viable"
                  ? "This plan is viable but carries meaningful risk. Proceed only with a clear backup plan and 6-month emergency buffer in place."
                  : "Current financial and risk indicators suggest significant challenges. Consider building savings or exploring lower-cost alternatives first."
              )}
            </p>
            {fd?.studentMessage && (
              <p className="mt-3 text-sm font-medium text-primary/90 italic">"{fd.studentMessage}"</p>
            )}
          </div>
        </div>

        {/* Scores bar */}
        {scores && (
          <div className="relative mt-5 grid grid-cols-3 gap-4">
            {[
              { label: "Career Fit", score: scores.career },
              { label: "Financial Health", score: scores.financial },
              { label: "Risk Safety", score: 100 - (analysis?.riskScore ?? 45) },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-medium">{s.score}</span>
                </div>
                <Progress value={s.score} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Financial Snapshot */}
      {finance && (
        <GlassCard delay={0.1}>
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Financial Snapshot
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Monthly EMI", value: formatINR(finance.monthlyEmiInr), warn: false },
              { label: "EMI of Salary", value: `${finance.emiAsPctSalary}%`, warn: finance.emiAsPctSalary > 35 },
              { label: "Break-even", value: `${finance.breakEvenMonths} months` },
              { label: "ROI Multiple", value: `${finance.roiMultiple}×` },
            ].map((item) => (
              <div key={item.label} className="bg-muted/40 rounded-xl p-3 text-center">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className={cn("font-bold text-lg mt-1", item.warn ? "text-warning" : "")}>{item.value}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Reasons For */}
        <GlassCard delay={0.15}>
          <h3 className="font-display font-semibold flex items-center gap-2 mb-4 text-success">
            <CheckCircle2 className="h-5 w-5" /> Why it works
          </h3>
          <ul className="space-y-2.5">
            {reasons.map((r, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06 }}
                className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                {r}
              </motion.li>
            ))}
          </ul>
        </GlassCard>

        {/* Risks */}
        <GlassCard delay={0.2}>
          <h3 className="font-display font-semibold flex items-center gap-2 mb-4 text-warning">
            <ShieldAlert className="h-5 w-5" /> Risks to manage
          </h3>
          <ul className="space-y-2.5">
            {risks.map((r, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.06 }}
                className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                {r}
              </motion.li>
            ))}
          </ul>
        </GlassCard>
      </div>

      {/* Action Timeline */}
      <GlassCard delay={0.25}>
        <h3 className="font-display font-semibold flex items-center gap-2 mb-5">
          <Clock className="h-5 w-5 text-accent" /> Your action plan
        </h3>
        <div className="relative">
          <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border" />
          <ul className="space-y-4">
            {(fd?.actionTimeline ?? actions.map((a, i) => ({ week: (i + 1) * 2, action: a }))).map((item, i) => (
              <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className="flex items-start gap-4 pl-10 relative">
                <div className="absolute left-0 top-1 h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-primary-foreground text-xs font-bold shadow-glow">
                  {typeof item === "string" ? i + 1 : `W${(item as {week: number; action: string}).week}`}
                </div>
                <div className="text-sm leading-relaxed">{typeof item === "string" ? item : (item as {week: number; action: string}).action}</div>
              </motion.li>
            ))}
          </ul>
        </div>
      </GlassCard>

      {/* Alternative Paths */}
      {fd?.alternativePaths && fd.alternativePaths.length > 0 && (
        <GlassCard delay={0.3}>
          <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Alternative paths to consider
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {fd.alternativePaths.map((path, i) => (
              <div key={i} className="bg-muted/40 rounded-xl p-4">
                <div className="font-medium text-sm">{path.path}</div>
                <div className="text-xs text-muted-foreground mt-1">{path.why_consider}</div>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">ROI: {path.roi_difference}</Badge>
                  <Badge variant="outline" className="text-xs">Risk: {path.risk_difference}</Badge>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Parent Summary */}
      {viewMode === "parent" && fd?.parentSummary && (
        <GlassCard delay={0.35} className="bg-accent/5 border-accent/20">
          <h3 className="font-display font-semibold mb-2 text-accent">For Parents</h3>
          <p className="text-sm leading-relaxed">{fd.parentSummary}</p>
        </GlassCard>
      )}

      {/* CTA */}
      <div className="flex gap-3 flex-wrap">
        <Button asChild className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Link to="/simulate">Simulate scenarios <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/compare">Compare countries</Link>
        </Button>
      </div>
    </div>
  );
}
