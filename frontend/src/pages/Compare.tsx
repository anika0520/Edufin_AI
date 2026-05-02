import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, RefreshCw, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/GlassCard";
import { mockApi, type ComparisonResult } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import { cn, getErrMsg } from "@/lib/utils";
import { formatINRCompact } from "@/lib/currency";
import { CardSkeleton } from "@/components/Skeleton";

export default function Compare() {
  const { profile } = useAppStore();
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await mockApi.compare();
      setData(result);
    } catch (e: unknown) {
      setError(getErrMsg(e, "Failed to load comparison"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = "Compare Scenarios — FutureFin AI";
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm text-accent font-medium">
            Scenario comparison
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">
            Three futures, side by{" "}
            <span className="gradient-text-accent">side</span>
          </h1>
          {profile.targetCountries && profile.targetCountries.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Based on your target countries:{" "}
              {profile.targetCountries.join(", ")}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw
            className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {loading && !data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {error && (
        <div className="glass-card p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-warning mx-auto" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={load}>Try again</Button>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {data.options.map((o, i) => {
              const winner = i === data.winnerIndex;
              return (
                <motion.div
                  key={o.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "glass-card p-6 relative",
                    winner && "border-2 border-primary shadow-glow",
                  )}
                >
                  {winner && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-glow flex items-center gap-1.5">
                      <Crown className="h-3 w-3" /> Best option
                    </div>
                  )}
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {o.country}
                  </div>
                  <div className="font-display font-bold text-xl mt-1">
                    {o.label}
                  </div>
                  <div className="mt-5 space-y-3">
                    <Row
                      label="ROI multiple"
                      value={`${o.roi}×`}
                      highlight={winner}
                    />
                    <Row
                      label="Risk score"
                      value={`${o.risk}/100`}
                      good={o.risk < 30}
                    />
                    <Row
                      label="Expected salary"
                      value={formatINRCompact(o.salary)}
                    />
                    <Row label="Total cost" value={formatINRCompact(o.cost)} />
                    <Row
                      label="Payback"
                      value={`${o.paybackYears} yrs`}
                      highlight={winner}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          <GlassCard delay={0.4} className="bg-gradient-card">
            <div className="flex items-start gap-4">
              <Sparkles className="h-5 w-5 text-primary mt-1 shrink-0" />
              <div>
                <div className="text-xs uppercase tracking-wider text-primary font-semibold">
                  Why this winner
                </div>
                <p className="text-lg mt-1">{data.rationale}</p>
              </div>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  good,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  good?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "font-display font-bold",
          highlight && "gradient-text text-lg",
          good && "text-success",
        )}
      >
        {value}
      </span>
    </div>
  );
}
