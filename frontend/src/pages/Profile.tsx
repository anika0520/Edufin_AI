import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAppStore, useAuthStore } from "@/store/useAppStore";
import { api, mockApi } from "@/lib/api";
import { toast } from "sonner";
import { cn, getErrMsg } from "@/lib/utils";

const skillsList = [
  "Python",
  "JavaScript",
  "Data Analysis",
  "Machine Learning",
  "Design",
  "Product",
  "Marketing",
  "Finance",
  "Java",
  "React",
  "SQL",
  "DevOps",
];
const interestsList = [
  "AI/ML",
  "Web3",
  "Climate",
  "Healthcare",
  "Fintech",
  "EdTech",
  "Robotics",
  "Gaming",
  "Biotech",
  "Sustainability",
  "Space",
  "Cybersecurity",
];
const countries = [
  "USA",
  "Canada",
  "UK",
  "Germany",
  "Singapore",
  "Australia",
  "Switzerland",
  "India",
  "Netherlands",
  "Ireland",
  "New Zealand",
  "France",
];

const steps = ["Academics", "Skills", "Interests", "Finances", "Goals"];

type ExtProfile = typeof import("@/store/useAppStore").useAppStore extends (
  ...a: unknown[]
) => infer R
  ? R
  : never;
type ProfileExtras = { institution?: string; careerGoals?: string };

export default function Profile() {
  const { profile, updateProfile, setAnalysis } = useAppStore();
  const { isLoggedIn } = useAuthStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Your Profile — FutureFin AI";
  }, []);

  const toggleArr = (
    key: "skills" | "interests" | "targetCountries",
    v: string,
  ) => {
    const arr = (profile[key] as string[]) || [];
    updateProfile({
      [key]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v],
    } as Parameters<typeof updateProfile>[0]);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Build normalized profile payload for backend
      const profilePayload = {
        highest_education: profile.education || "Bachelor's",
        major: profile.field || "Computer Science",
        gpa: profile.gpa || 3.5,
        technical_skills: profile.skills || [],
        interests: profile.interests || [],
        annual_family_income: profile.familyIncome || 600000,
        savings_available: profile.savings || 120000,
        target_countries: profile.targetCountries || [],
        risk_appetite: profile.riskAppetite || "moderate",
        work_experience_months: profile.workExperienceMonths || 0,
        career_goals: profile.careerGoals || "",
        budget_max: profile.loanCapacity || 4000000,
      };

      // Save profile to backend if logged in
      if (isLoggedIn) {
        try {
          await api.put("/profile", profilePayload);
        } catch (profileErr: unknown) {
          console.warn(
            "Profile save failed (non-fatal):",
            (profileErr as Error)?.message,
          );
          // Continue — analysis will use quick-analyze with inline data
        }
      }

      // Run analysis — real backend (authenticated or quick)
      const result = await mockApi.analyze({
        name: profile.name || "Student",
        age: profile.age || 22,
        education: profile.education || "Bachelor's",
        gpa: profile.gpa || 3.5,
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
      toast.success("Analysis complete 🎓", {
        description: "Your AI dashboard is ready.",
      });
      navigate("/dashboard");
    } catch (e: unknown) {
      console.error("Analysis error:", e);
      const msg = getErrMsg(e, "Something went wrong");
      setError(msg);
      toast.error("Analysis failed", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => (step < steps.length - 1 ? setStep(step + 1) : submit());
  const back = () => setStep(Math.max(0, step - 1));

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground mb-2">
          Step {step + 1} of {steps.length}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
          Let's build your <span className="gradient-text">financial twin</span>
        </h1>
        <p className="text-muted-foreground mt-2">
          Answer honestly — better inputs make smarter simulations.
        </p>
        {!isLoggedIn && (
          <div className="mt-3 flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              You're not logged in.{" "}
              <a href="/auth" className="underline font-medium">
                Sign in
              </a>{" "}
              to save your analysis permanently.
            </span>
          </div>
        )}
      </motion.div>

      {/* Progress */}
      <div className="mt-8 flex gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all",
                i <= step ? "bg-gradient-primary" : "bg-muted",
              )}
            />
            <div
              className={cn(
                "text-[10px] mt-2 uppercase tracking-wider",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 sm:p-8 mt-8 min-h-[360px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            {step === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full name">
                  <Input
                    value={profile.name || ""}
                    onChange={(e) => updateProfile({ name: e.target.value })}
                    placeholder="Aarav Sharma"
                  />
                </Field>
                <Field label="Age">
                  <Input
                    type="number"
                    value={profile.age || ""}
                    onChange={(e) => updateProfile({ age: +e.target.value })}
                    placeholder="22"
                  />
                </Field>
                <Field label="Current education">
                  <Input
                    value={profile.education || ""}
                    onChange={(e) =>
                      updateProfile({ education: e.target.value })
                    }
                    placeholder="Bachelor's in CS"
                  />
                </Field>
                <Field label="GPA / % (out of 10)">
                  <Input
                    type="number"
                    step="0.1"
                    value={profile.gpa || ""}
                    onChange={(e) => updateProfile({ gpa: +e.target.value })}
                    placeholder="8.2"
                  />
                </Field>
                <Field label="Field of study" className="sm:col-span-2">
                  <Input
                    value={profile.field || ""}
                    onChange={(e) => updateProfile({ field: e.target.value })}
                    placeholder="Computer Science"
                  />
                </Field>
                <Field label="Work experience (months)">
                  <Input
                    type="number"
                    value={profile.workExperienceMonths || ""}
                    onChange={(e) =>
                      updateProfile({ workExperienceMonths: +e.target.value })
                    }
                    placeholder="0"
                  />
                </Field>
                <Field label="Institution name">
                  <Input
                    value={
                      (profile as unknown as ProfileExtras).institution || ""
                    }
                    onChange={(e) =>
                      updateProfile({
                        institution: e.target.value,
                      } as Parameters<typeof updateProfile>[0])
                    }
                    placeholder="IIT Bombay"
                  />
                </Field>
              </div>
            )}
            {step === 1 && (
              <ChipPicker
                title="Pick your top skills"
                options={skillsList}
                selected={profile.skills || []}
                onToggle={(v) => toggleArr("skills", v)}
              />
            )}
            {step === 2 && (
              <ChipPicker
                title="What excites you?"
                options={interestsList}
                selected={profile.interests || []}
                onToggle={(v) => toggleArr("interests", v)}
              />
            )}
            {step === 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Family annual income (₹)">
                  <Input
                    type="number"
                    value={profile.familyIncome || ""}
                    onChange={(e) =>
                      updateProfile({ familyIncome: +e.target.value })
                    }
                    placeholder="800000"
                  />
                </Field>
                <Field label="Current savings (₹)">
                  <Input
                    type="number"
                    value={profile.savings || ""}
                    onChange={(e) =>
                      updateProfile({ savings: +e.target.value })
                    }
                    placeholder="200000"
                  />
                </Field>
                <Field
                  label="Loan budget you can handle (₹)"
                  className="sm:col-span-2"
                >
                  <Input
                    type="number"
                    value={profile.loanCapacity || ""}
                    onChange={(e) =>
                      updateProfile({ loanCapacity: +e.target.value })
                    }
                    placeholder="3500000"
                  />
                </Field>
                <Field label="Risk appetite" className="sm:col-span-2">
                  <div className="flex gap-2 mt-1">
                    {(["conservative", "moderate", "aggressive"] as const).map(
                      (r) => (
                        <button
                          key={r}
                          onClick={() => updateProfile({ riskAppetite: r })}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-all",
                            profile.riskAppetite === r
                              ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                              : "border-border hover:border-primary/40",
                          )}
                        >
                          {r}
                        </button>
                      ),
                    )}
                  </div>
                </Field>
              </div>
            )}
            {step === 4 && (
              <>
                <ChipPicker
                  title="Target countries"
                  options={countries}
                  selected={profile.targetCountries || []}
                  onToggle={(v) => toggleArr("targetCountries", v)}
                />
                <Field label="Career goals (optional)" className="mt-4">
                  <textarea
                    value={
                      (profile as unknown as ProfileExtras).careerGoals || ""
                    }
                    onChange={(e) =>
                      updateProfile({
                        careerGoals: e.target.value,
                      } as Parameters<typeof updateProfile>[0])
                    }
                    placeholder="I want to become a data scientist at a top tech company..."
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="ghost" onClick={back} disabled={step === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={next}
          disabled={submitting}
          className="bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {submitting ? (
            <>
              <Sparkles className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
            </>
          ) : step === steps.length - 1 ? (
            <>
              Run AI Analysis <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ChipPicker({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <h3 className="font-display font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5">
        Select all that apply.
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o);
          return (
            <button
              key={o}
              onClick={() => onToggle(o)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                active
                  ? "bg-gradient-primary text-primary-foreground border-transparent shadow-glow"
                  : "border-border hover:border-primary/40 hover:bg-muted",
              )}
            >
              {active && <Check className="inline h-3.5 w-3.5 mr-1" />}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
