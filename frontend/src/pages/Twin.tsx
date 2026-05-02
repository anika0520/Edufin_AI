import { useEffect } from "react";
import { motion } from "framer-motion";
import { Briefcase, Heart, Home, TrendingUp, Wallet, GraduationCap } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useAppStore } from "@/store/useAppStore";

const timeline = [
  { year: "Year 0", icon: GraduationCap, title: "Enrolled", desc: "Started program. Loan disbursed.", financial: "−₹48L", color: "accent" },
  { year: "Year 1", icon: Briefcase, title: "Internship secured", desc: "Summer role at top tier company. ₹7L saved.", financial: "+₹7L", color: "primary" },
  { year: "Year 2", icon: TrendingUp, title: "Graduated · First job", desc: "Joined as Data Scientist. Started repayment.", financial: "₹22L/yr", color: "primary" },
  { year: "Year 4", icon: Wallet, title: "Loan halfway repaid", desc: "Aggressive prepayment. Stress drops 40%.", financial: "−₹25L left", color: "warning" },
  { year: "Year 5", icon: Home, title: "Net positive", desc: "First investment. Healthy buffer. Promotion.", financial: "+₹35L net", color: "primary" },
];

export default function Twin() {
  const { profile } = useAppStore();
  useEffect(() => { document.title = "Digital Twin — EduFin_AI"; }, []);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-sm text-accent font-medium">Digital Twin</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight mt-1">
          Meet your <span className="gradient-text-accent">future self</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          A 5-year projection of how your decisions compound. Living, breathing, recalculated daily.
        </p>
      </div>

      {/* Twin card */}
      <GlassCard className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-accent opacity-10" />
        <div className="relative grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-6 items-center">
          <div className="relative h-28 w-28 rounded-3xl bg-gradient-accent grid place-items-center mx-auto sm:mx-0 shadow-accent-glow">
            <span className="font-display font-bold text-4xl text-accent-foreground">
              {(profile.name || "Y T").split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </span>
            <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-success border-4 border-background" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-accent font-semibold">Year 5 projection</div>
            <h2 className="font-display text-2xl font-bold mt-1">
              {profile.name || "You"}, age {(profile.age || 22) + 5}
            </h2>
            <p className="text-muted-foreground mt-1">
              Senior Data Scientist · ₹32L/yr · Loan-free in 18 months · Healthy savings
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Stat icon={<Wallet className="h-3.5 w-3.5" />} label="Net worth" value="₹65L" />
              <Stat icon={<Heart className="h-3.5 w-3.5" />} label="Stress" value="Low" tone="success" />
              <Stat icon={<TrendingUp className="h-3.5 w-3.5" />} label="Career" value="Growing" tone="primary" />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Timeline */}
      <div>
        <h3 className="font-display font-semibold text-lg mb-5">Your projected path</h3>
        <div className="relative">
          <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />
          <div className="space-y-4">
            {timeline.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="relative pl-14"
              >
                <div className={`absolute left-0 top-1 h-10 w-10 rounded-xl grid place-items-center bg-${t.color === "primary" ? "primary" : t.color === "warning" ? "warning" : "accent"}/15`}>
                  <t.icon className={`h-5 w-5 text-${t.color}`} />
                </div>
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.year}</div>
                      <div className="font-display font-semibold text-lg mt-0.5">{t.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
                    </div>
                    <div className="font-display font-bold text-lg gradient-text shrink-0">{t.financial}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "success" | "primary" }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs">
      <span className={tone === "success" ? "text-success" : tone === "primary" ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
