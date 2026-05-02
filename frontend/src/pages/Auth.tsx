import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/useAppStore";
import { toast } from "sonner";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "", password: "", firstName: "", lastName: "", phone: "",
  });
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await authApi.login(form.email, form.password);
        setUser(result.user);
        toast.success(`Welcome back, ${result.user.firstName}!`);
      } else {
        if (!form.firstName || !form.lastName) {
          toast.error("First and last name are required");
          return;
        }
        if (form.password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }
        const result = await authApi.register(form);
        setUser(result.user);
        toast.success(`Account created! Welcome, ${result.user.firstName}!`);
      }
      navigate("/profile");
    } catch (err: unknown) {
      const msg = (err as {response?: {data?: {message?: string}}, message?: string})?.response?.data?.message || (err as Error)?.message || "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">
            EduFin<span className="gradient-text">_AI</span>
          </span>
        </div>

        <div className="glass-card p-8">
          <h1 className="font-display text-2xl font-bold mb-1">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === "login"
              ? "Welcome back — your future awaits."
              : "Start simulating your future in minutes."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName" className="text-xs">First name</Label>
                  <Input id="firstName" value={form.firstName} onChange={(e) => update("firstName", e.target.value)}
                    placeholder="Arjun" className="mt-1" required />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-xs">Last name</Label>
                  <Input id="lastName" value={form.lastName} onChange={(e) => update("lastName", e.target.value)}
                    placeholder="Sharma" className="mt-1" required />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                placeholder="you@example.com" className="mt-1" required />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs">Password</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)}
                placeholder={mode === "register" ? "Min 8 chars, 1 uppercase, 1 number" : "••••••••"} className="mt-1" required />
            </div>

            {mode === "register" && (
              <div>
                <Label htmlFor="phone" className="text-xs">Phone (optional)</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
                  placeholder="+91 98765 43210" className="mt-1" />
              </div>
            )}

            <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground shadow-glow mt-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}
            {" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary font-medium hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-center text-xs text-muted-foreground">
              No account needed to explore —{" "}
              <button type="button" onClick={() => navigate("/profile")} className="text-primary hover:underline">
                try it without signing in
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
