import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassCard } from "@/components/GlassCard";
import { useAppStore } from "@/store/useAppStore";
import { mockApi } from "@/lib/api";
import { cn, getErrMsg } from "@/lib/utils";
import { formatINR, formatINRCompact } from "@/lib/currency";

export default function Simulate() {
  const { simulation, setSimulation, profile } = useAppStore();
  const [country, setCountry] = useState("Canada");
  const [delay, setDelay] = useState(3);
  const [variance, setVariance] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.title = "Simulate Your Future — FutureFin AI";
    if (!simulation) run();
  }, []);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await mockApi.simulateFuture({
        country,
        jobDelayMonths: delay,
        salaryVariance: variance,
      });
      setSimulation(r);
    } catch (e: unknown) {
      setError(getErrMsg(e, "Simulation failed"));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-primary font-medium">Hero feature</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">
          Simulate your <span className="gradient-text">future</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Move the sliders. Watch your life recalculate in real time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
        {/* Controls */}
        <GlassCard className="lg:sticky lg:top-6 h-fit">
          <h2 className="font-display font-semibold text-lg mb-5">
            Scenario builder
          </h2>
          <div className="space-y-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Country
              </Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Canada",
                    "Germany",
                    "USA",
                    "Singapore",
                    "India",
                    "UK",
                    "Australia",
                    "Netherlands",
                  ].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Job delay
                </Label>
                <span className="text-sm font-semibold">
                  {delay} {delay === 1 ? "month" : "months"}
                </span>
              </div>
              <Slider
                value={[delay]}
                onValueChange={([v]) => setDelay(v)}
                min={0}
                max={12}
                step={1}
                className="mt-3"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Instant</span>
                <span>12 months</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Salary variance
                </Label>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    variance >= 0 ? "text-success" : "text-danger",
                  )}
                >
                  {variance > 0 ? "+" : ""}
                  {variance}%
                </span>
              </div>
              <Slider
                value={[variance]}
                onValueChange={([v]) => setVariance(v)}
                min={-30}
                max={30}
                step={5}
                className="mt-3"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>-30%</span>
                <span>+30%</span>
              </div>
            </div>

            {profile.targetCountries && profile.targetCountries.length > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
                💡 Your profile targets: {profile.targetCountries.join(", ")}.
                Comparing with {country}.
              </div>
            )}

            <Button
              onClick={run}
              disabled={running}
              className="w-full bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {running ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" /> Simulating…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" /> Run simulation
                </>
              )}
            </Button>

            {error && (
              <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Results */}
        <div className="space-y-5">
          {simulation && (
            <>
              <motion.div
                key={simulation.verdict}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "glass-card p-6 border-2 relative overflow-hidden",
                  simulation.verdict === "strong" && "border-success/40",
                  simulation.verdict === "moderate" && "border-warning/40",
                  simulation.verdict === "risky" && "border-danger/40",
                )}
              >
                <div
                  className={cn(
                    "absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-30",
                    simulation.verdict === "strong" && "bg-success",
                    simulation.verdict === "moderate" && "bg-warning",
                    simulation.verdict === "risky" && "bg-danger",
                  )}
                />
                <div className="relative flex items-start gap-3">
                  {simulation.verdict === "risky" ? (
                    <AlertTriangle className="h-6 w-6 text-danger mt-1" />
                  ) : (
                    <Activity className="h-6 w-6 text-primary mt-1" />
                  )}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Verdict for {country}
                    </div>
                    <div className="font-display text-xl sm:text-2xl font-bold mt-0.5">
                      {simulation.message}
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <GlassCard>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    5-yr net worth
                  </div>
                  <div className="font-display text-3xl font-bold mt-1 gradient-text">
                    {formatINRCompact(simulation.netWorthIn5Years)}
                  </div>
                </GlassCard>
                <GlassCard>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Stress index
                  </div>
                  <div
                    className={cn(
                      "font-display text-3xl font-bold mt-1",
                      simulation.stressIndex < 45
                        ? "text-success"
                        : simulation.stressIndex < 70
                          ? "text-warning"
                          : "text-danger",
                    )}
                  >
                    {Math.round(simulation.stressIndex)}
                  </div>
                </GlassCard>
                <GlassCard>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Verdict
                  </div>
                  <div
                    className={cn(
                      "font-display text-3xl font-bold mt-1 capitalize",
                      simulation.verdict === "strong" && "text-success",
                      simulation.verdict === "moderate" && "text-warning",
                      simulation.verdict === "risky" && "text-danger",
                    )}
                  >
                    {simulation.verdict}
                  </div>
                </GlassCard>
              </div>

              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-lg">
                      Salary growth
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Projection in {country}
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={simulation.salaryGrowth}>
                      <defs>
                        <linearGradient
                          id="salaryFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0.5}
                          />
                          <stop
                            offset="100%"
                            stopColor="hsl(var(--primary))"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="year"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => `Y${v}`}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => formatINRCompact(v)}
                      />
                      <ReTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                        }}
                        formatter={(v: number) => [formatINR(v), "Salary"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="salary"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        fill="url(#salaryFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-lg">
                      EMI burden
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Monthly outflow over 24 months
                    </p>
                  </div>
                </div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={simulation.emiTimeline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="month"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickFormatter={(v) => formatINRCompact(v)}
                      />
                      <ReTooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 12,
                        }}
                        formatter={(v: number) => [formatINR(v), "EMI"]}
                      />
                      <Bar
                        dataKey="emi"
                        fill="hsl(var(--accent))"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
