import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Brain,
  TrendingUp,
  GraduationCap,
  LineChart,
  Users,
  Zap,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const features = [
  { icon: Brain, title: "AI-Powered Simulation", desc: "Stress-test your future across 10,000 economic scenarios in seconds." },
  { icon: TrendingUp, title: "Real-Time ROI Insights", desc: "See exactly when your education pays for itself, country by country." },
  { icon: ShieldCheck, title: "Risk-First Loan Analysis", desc: "Know your repayment stress before you sign anything." },
  { icon: Users, title: "Parent Mode", desc: "A simpler view tuned for the people funding your future." },
  { icon: LineChart, title: "Digital Twin", desc: "Watch a 5-year version of yourself evolve based on every choice." },
  { icon: Zap, title: "Career Probability", desc: "Match scores grounded in 1.2M real outcome data points." },
];

const steps = [
  { n: "01", title: "Tell us about you", desc: "Academics, skills, finances, dreams — five minutes, fully private." },
  { n: "02", title: "We simulate your future", desc: "Our model runs thousands of life paths to find your edge." },
  { n: "03", title: "Decide with confidence", desc: "A clear verdict, the why behind it, and what to do next." },
];

const trust = [
  "Bank-grade encryption",
  "GDPR compliant",
  "No data resale",
  "Trusted by 12,000+ students",
];

export default function Landing() {
  useEffect(() => {
    document.title = "EduFin_AI — Don't Choose Your Future. Simulate It.";
    const meta = document.querySelector('meta[name="description"]') || document.createElement("meta");
    meta.setAttribute("name", "description");
    meta.setAttribute("content", "EduFin_AI is the AI financial co-pilot for students. Simulate careers, universities, loans and risk before you commit.");
    document.head.appendChild(meta);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="container max-w-7xl flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">
              EduFin<span className="gradient-text">_AI</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#trust" className="hover:text-foreground transition-colors">Trust</a>
            <Link to="/auth" className="text-sm font-medium hover:text-foreground transition-colors">Sign In</Link>
          </nav>
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow">
            <Link to="/auth">Start Free</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="container max-w-7xl px-6 pt-20 pb-32 lg:pt-32 lg:pb-40 relative">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium mb-6"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Powered by behavioral finance + LLMs</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl text-balance leading-[1.05]"
          >
            Don't just choose your future.{" "}
            <span className="gradient-text">Simulate it.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl text-balance"
          >
            EduFin_AI runs thousands of versions of your life — across countries, careers, and loans —
            so you can see exactly which path pays off, and which one ruins your weekends.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-10 flex flex-wrap gap-4 items-center"
          >
            <Button
              asChild
              size="lg"
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 h-12 px-7 text-base"
            >
              <Link to="/profile">
                Start Your Analysis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 px-6 text-base">
              <Link to="/dashboard">See live demo</Link>
            </Button>
          </motion.div>

          {/* Floating preview card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="absolute -inset-6 bg-gradient-primary opacity-20 blur-3xl rounded-3xl" />
            <div className="relative glass-card p-2 sm:p-4 shadow-elevated overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-5">
                {[
                  { label: "ROI Score", value: "78", color: "text-primary" },
                  { label: "Risk", value: "41", color: "text-warning" },
                  { label: "Confidence", value: "86%", color: "text-accent" },
                  { label: "Verdict", value: "Strong", color: "text-success" },
                ].map((m, i) => (
                  <div key={i} className="rounded-xl bg-surface-2 p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
                    <div className={`font-display text-3xl font-bold mt-1 ${m.color}`}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-5">
                <div className="rounded-xl bg-gradient-primary/10 border border-primary/20 p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm">
                    <span className="font-semibold">Recommendation:</span> Germany delivers the best risk-adjusted return.
                    Your loan EMI stays under 22% of expected starting salary.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 border-t border-border">
        <div className="container max-w-7xl px-6">
          <div className="max-w-2xl">
            <div className="text-sm font-medium text-primary mb-3">Features</div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-balance">
              The clarity layer between you and a life-defining decision.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="glass-card p-6 hover-lift group"
              >
                <div className="h-11 w-11 rounded-xl bg-gradient-primary/10 grid place-items-center mb-5 group-hover:bg-gradient-primary group-hover:shadow-glow transition-all">
                  <f.icon className="h-5 w-5 text-primary group-hover:text-primary-foreground transition-colors" />
                </div>
                <div className="font-display font-semibold text-lg mb-1.5">{f.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 border-t border-border bg-gradient-card">
        <div className="container max-w-7xl px-6">
          <div className="text-sm font-medium text-accent mb-3">How it works</div>
          <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight max-w-2xl text-balance">
            Three steps. One unmistakably clear answer.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative glass-card p-7"
              >
                <div className="font-display text-5xl font-bold gradient-text-accent mb-4">{s.n}</div>
                <div className="font-display font-semibold text-xl mb-2">{s.title}</div>
                <div className="text-muted-foreground">{s.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="py-24 border-t border-border">
        <div className="container max-w-7xl px-6 text-center">
          <Lock className="h-8 w-8 text-primary mx-auto mb-4" />
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl mx-auto text-balance">
            Built on the kind of trust your bank wishes it had.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {trust.map((t) => (
              <div key={t} className="px-4 py-2 rounded-full glass text-sm">
                <CheckCircle2 className="inline h-4 w-4 text-success mr-2" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border">
        <div className="container max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-card p-12 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-primary opacity-10" />
            <div className="relative">
              <h2 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-balance">
                Your future is one decision away.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Run your first simulation in under 90 seconds. Free, forever.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-8 bg-gradient-primary text-primary-foreground shadow-glow h-12 px-8 text-base"
              >
                <Link to="/profile">
                  Start Your Analysis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border py-10">
        <div className="container max-w-7xl px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-primary grid place-items-center">
              <GraduationCap className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span>© 2025 EduFin_AI. All decisions, simulated.</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
