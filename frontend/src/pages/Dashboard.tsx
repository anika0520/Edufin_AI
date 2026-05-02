import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  GraduationCap,
  Info,
  Landmark,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { GlassCard } from "@/components/GlassCard";
import { MetricRing } from "@/components/MetricRing";
import { CardSkeleton } from "@/components/Skeleton";
import { useAppStore, useAuthStore } from "@/store/useAppStore";
import { mockApi, api } from "@/lib/api";
import { cn, getErrMsg } from "@/lib/utils";
import { formatINR, formatINRCompact } from "@/lib/currency";

export default function Dashboard() {
  const { analysis, setAnalysis, profile, viewMode } = useAppStore();
  const { isLoggedIn } = useAuthStore();
  const [loading, setLoading] = useState(!analysis);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = async (force = false) => {
    if (!force && analysis) return;
    setLoading(!force);
    setRefreshing(force);
    setError(null);
    try {
      // If logged in, try to fetch last stored decision first (fast, free)
      if (isLoggedIn && !force) {
        try {
          const { data } = await api.get("/decision");
          if (data?.data) {
            setAnalysis(data.data);
            setLoading(false);
            return;
          }
        } catch {
          /* no stored decision yet — run fresh analysis */
        }
      }
      // Run full analysis (real backend → mock fallback)
      const result = await mockApi.analyze({
        name: profile.name || "Student",
        age: profile.age || 22,
        education: profile.education || "Bachelor's",
        gpa: profile.gpa || 3.6,
        field: profile.field || "Computer Science",
        skills: profile.skills || [],
        interests: profile.interests || [],
        familyIncome: profile.familyIncome || 600000,
        savings: profile.savings || 120000,
        loanCapacity: profile.loanCapacity || 4000000,
        targetCountries: profile.targetCountries || [],
        riskAppetite: profile.riskAppetite || "moderate",
        workExperienceMonths: profile.workExperienceMonths || 0,
      });
      setAnalysis(result);
    } catch (e: unknown) {
      setError(getErrMsg(e, "Analysis failed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = "Dashboard — FutureFin AI";
    loadAnalysis();
  }, []);

  if (loading || !analysis) {
    return (
      <div className="space-y-6">
        {error ? (
          <div className="glass-card p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-warning mx-auto" />
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => loadAnalysis(true)}>Retry</Button>
              <Button asChild variant="outline">
                <Link to="/profile">Complete Profile</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <CardSkeleton />
            <div className="grid md:grid-cols-3 gap-5">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </>
        )}
      </div>
    );
  }

  const isParent = viewMode === "parent";
  const fd = analysis.finalDecision;
  const scores = analysis.scores;
  const finance = analysis.finance;
  const risk = analysis.risk;

  const verdictConfig = {
    Recommended: {
      icon: CheckCircle2,
      color: "text-success",
      badge: "bg-success/20 text-success border-success/30",
    },
    "Recommended with Conditions": {
      icon: AlertCircle,
      color: "text-warning",
      badge: "bg-warning/20 text-warning border-warning/30",
    },
    "Risky but Viable": {
      icon: AlertTriangle,
      color: "text-warning",
      badge: "bg-warning/20 text-warning border-warning/30",
    },
    "Not Advisable at This Time": {
      icon: XCircle,
      color: "text-danger",
      badge: "bg-danger/20 text-danger border-danger/30",
    },
  } as const;

  const verdict = fd?.verdict as keyof typeof verdictConfig;
  const VerdictIcon = (verdict && verdictConfig[verdict]?.icon) || Sparkles;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">
            {isParent ? "Parent overview" : "Welcome back"}
            {profile.name ? `, ${profile.name.split(" ")[0]}` : ""}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">
            {isParent
              ? "Your child's financial outlook"
              : "Your future, decoded"}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAnalysis(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")}
            />
            {refreshing ? "Refreshing…" : "Re-analyze"}
          </Button>
          <Button
            asChild
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Link to="/simulate">
              Run simulation <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Final Decision Banner */}
      {fd && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("glass-card p-5 border-2", {
            "border-success/40 bg-success/5": fd.color === "green",
            "border-warning/40 bg-warning/5":
              fd.color === "yellow" || fd.color === "orange",
            "border-danger/40 bg-danger/5": fd.color === "red",
          })}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "h-12 w-12 rounded-2xl grid place-items-center shrink-0",
                {
                  "bg-success/20": fd.color === "green",
                  "bg-warning/20":
                    fd.color === "yellow" || fd.color === "orange",
                  "bg-danger/20": fd.color === "red",
                },
              )}
            >
              <VerdictIcon
                className={cn(
                  "h-6 w-6",
                  verdictConfig[verdict]?.color || "text-primary",
                )}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-lg">
                  {fd.headline}
                </span>
                <Badge
                  className={cn(
                    "text-xs border",
                    verdictConfig[verdict]?.badge || "",
                  )}
                >
                  {fd.verdict}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {fd.confidence}% confidence
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {fd.explanation}
              </p>
              {fd.suggestedAction && (
                <div className="mt-2 text-sm font-medium text-primary">
                  → {fd.suggestedAction}
                </div>
              )}
            </div>
          </div>
          {fd.keyReasons?.length > 0 && (
            <div className="mt-4 grid sm:grid-cols-3 gap-2">
              {fd.keyReasons.slice(0, 3).map((kr, i) => (
                <div
                  key={i}
                  className={cn("rounded-lg px-3 py-2 text-xs border", {
                    "bg-success/10 border-success/20": kr.impact === "positive",
                    "bg-danger/10 border-danger/20": kr.impact === "negative",
                    "bg-muted border-border": kr.impact === "neutral",
                  })}
                >
                  <span className="mr-1">
                    {kr.impact === "positive"
                      ? "✅"
                      : kr.impact === "negative"
                        ? "⚠️"
                        : "ℹ️"}
                  </span>
                  {kr.reason}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* AI Summary fallback */}
      {!fd && (
        <GlassCard
          className="bg-gradient-card relative overflow-hidden"
          delay={0.05}
        >
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
          <div className="flex items-start gap-4 relative">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shrink-0 shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">
                AI Insight
              </div>
              <p className="text-lg leading-relaxed">
                {isParent
                  ? "Moderate financial commitment with manageable risk. Best balance: Germany or Canada. Repayment is realistic if employment lands within 8 months."
                  : analysis.summary}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Metric Rings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Overall Score",
            value: scores?.overall ?? analysis.confidence,
            color: "#a78bfa",
          },
          {
            label: "Reality Check",
            value: scores?.realityCheck ?? analysis.realityScore,
            color: "#34d399",
          },
          {
            label: "ROI Score",
            value: scores?.financial ?? analysis.roiScore,
            color: "#60a5fa",
          },
          {
            label: "Risk (lower=better)",
            value: 100 - analysis.riskScore,
            color: "#f87171",
            invert: true,
          },
        ].map((m, i) => (
          <GlassCard
            key={m.label}
            delay={i * 0.07}
            className="flex flex-col items-center gap-2 py-4"
          >
            <MetricRing value={m.value} color={m.color} size={80} />
            <div className="text-xs text-muted-foreground text-center">
              {m.label}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Finance Snapshot */}
      {finance && (
        <GlassCard delay={0.1}>
          <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" /> Financial Snapshot
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Monthly EMI", value: formatINR(finance.monthlyEmiInr) },
              {
                label: "EMI / Salary",
                value: `${finance.emiAsPctSalary}%`,
                warn: finance.emiAsPctSalary > 35,
              },
              { label: "ROI Multiple", value: `${finance.roiMultiple}×` },
              {
                label: "Break-even",
                value: `${finance.breakEvenMonths} months`,
              },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div
                  className={cn(
                    "font-display font-bold text-xl",
                    (item as { label: string; value: string; warn?: boolean })
                      .warn
                      ? "text-warning"
                      : "",
                  )}
                >
                  {item.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          {finance.stressLevel && (
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Financial Stress</span>
                <span
                  className={cn({
                    "text-success": finance.stressLevel === "low",
                    "text-warning": finance.stressLevel === "medium",
                    "text-danger":
                      finance.stressLevel === "high" ||
                      finance.stressLevel === "critical",
                  })}
                >
                  {finance.stressLevel.toUpperCase()}
                </span>
              </div>
              <Progress value={finance.stressScore} className="h-2" />
            </div>
          )}
        </GlassCard>
      )}

      {/* Career Matches */}
      <GlassCard delay={0.15}>
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" /> Top Career Matches
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              AI-matched based on skills, GPA, and market demand
            </TooltipContent>
          </Tooltip>
        </h2>
        <div className="space-y-3">
          {analysis.careers.slice(0, isParent ? 2 : 4).map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="h-9 w-9 rounded-lg bg-gradient-primary/20 grid place-items-center shrink-0">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {c.reason}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold">
                  {formatINRCompact(c.avgSalary)}/yr
                </div>
                <div className="text-xs text-success">+{c.growth}% growth</div>
              </div>
              <div className="w-14 text-right">
                <div className="text-xs font-semibold text-primary">
                  {c.match}%
                </div>
                <Progress value={c.match} className="h-1 mt-1" />
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Universities */}
      <GlassCard delay={0.2}>
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-accent" /> University
          Recommendations
        </h2>
        <div className="space-y-3">
          {analysis.universities.slice(0, isParent ? 3 : 5).map((u, i) => (
            <motion.div
              key={u.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{u.name}</div>
                <div className="text-xs text-muted-foreground">
                  {u.program} · {u.country} · Rank #{u.rank}
                </div>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <div className="text-xs font-medium">
                  Admit: <span className="text-primary">{u.admitChance}%</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatINRCompact(u.tuition)}
                </div>
                <div className="text-xs text-success">ROI {u.roi}×</div>
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>

      {/* Loan */}
      <GlassCard delay={0.25}>
        <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
          <Landmark className="h-5 w-5 text-warning" /> Loan Assessment
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Eligible Amount",
              value: formatINR(analysis.loan.eligibleAmount),
            },
            { label: "Interest Rate", value: `${analysis.loan.rate}% p.a.` },
            { label: "Tenure", value: `${analysis.loan.tenureYears} years` },
            { label: "Monthly EMI", value: formatINR(analysis.loan.emi) },
            { label: "Risk Score", value: `${analysis.loan.riskScore}/100` },
            {
              label: "Approval Chance",
              value: analysis.loan.approval.toUpperCase(),
            },
          ].map((item) => (
            <div key={item.label} className="bg-muted/40 rounded-xl p-3">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-bold mt-1">{item.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Risk Alerts */}
      {risk?.redAlerts && risk.redAlerts.length > 0 && (
        <GlassCard delay={0.3}>
          <h2 className="font-display font-semibold text-lg mb-4 flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" /> Risk Alerts
          </h2>
          <div className="space-y-2">
            {risk.redAlerts.map((alert, i) => (
              <div
                key={i}
                className={cn("rounded-lg p-3 border text-sm", {
                  "bg-danger/10 border-danger/20":
                    alert.severity === "critical",
                  "bg-warning/10 border-warning/20": alert.severity === "high",
                  "bg-muted border-border": alert.severity === "medium",
                })}
              >
                <div className="font-medium">{alert.alert}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  {alert.description}
                </div>
                {alert.action && (
                  <div className="text-xs font-medium text-primary mt-1">
                    → {alert.action}
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="flex gap-3 flex-wrap">
        <Button
          asChild
          className="bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Link to="/simulate">
            Simulate Scenarios <TrendingUp className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/decision">
            View Full Decision <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/compare">
            Compare Countries <GraduationCap className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
