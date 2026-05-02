// src/hooks/useApi.ts — TanStack Query hooks for all API endpoints
// Replaces ad-hoc mockApi calls with proper server-state management:
// caching, background refetch, optimistic updates, typed responses.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, authApi, mockApi } from "@/lib/api";
import type { AnalyzeResult, SimulationInput, SimulationResult } from "@/lib/api";
import { useAuthStore } from "@/store/useAppStore";
import { toast } from "@/hooks/use-toast";

// ─── Query keys (centralized, type-safe) ─────────────────────────────────────
export const QK = {
  profile:       () => ["profile"]                    as const,
  completeness:  () => ["profile", "completeness"]    as const,
  analysis:      () => ["analysis"]                   as const,
  careers:       () => ["careers"]                    as const,
  universities:  () => ["universities"]               as const,
  simulation:    (id: string) => ["simulation", id]  as const,
  loanAssess:    (amt: number) => ["loan", amt]       as const,
  twin:          () => ["twin"]                       as const,
  dropout:       () => ["dropout"]                    as const,
  realityCheck:  () => ["reality-check"]              as const,
  regret:        () => ["regret"]                     as const,
  parentReport:  () => ["parent-report"]              as const,
  mentorSession: () => ["mentor-session"]             as const,
} as const;

// ─── Helper ───────────────────────────────────────────────────────────────────
const isLoggedIn = () => !!localStorage.getItem("ff_token");

async function apiFetch<T>(fn: () => Promise<{ data: { data: T } }>, fallback?: () => Promise<T>): Promise<T> {
  if (isLoggedIn()) {
    try {
      const res = await fn();
      return res.data.data;
    } catch (e: unknown) {
      if (e?.response?.status === 401) {
        useAuthStore.getState().logout();
        throw e;
      }
      // Fall through to mock if backend unavailable in dev
      if (fallback && process.env.NODE_ENV !== "production") {
        console.warn("[API] Falling back to mock:", e.message);
        return fallback();
      }
      throw e;
    }
  }
  if (fallback) return fallback();
  throw new Error("Not authenticated");
}

// ─── Profile hooks ────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: QK.profile(),
    queryFn:  () => apiFetch(() => api.get("/profile")),
    staleTime: 5 * 60_000,
    enabled:   isLoggedIn(),
  });
}

export function useProfileCompleteness() {
  return useQuery({
    queryKey: QK.completeness(),
    queryFn:  () => apiFetch(() => api.get("/profile/completeness")),
    staleTime: 60_000,
    enabled:   isLoggedIn(),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch(() => api.put("/profile", data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.profile() });
      qc.invalidateQueries({ queryKey: QK.completeness() });
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    },
    onError: (e: Error) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
}

// ─── Analysis (main pipeline) ─────────────────────────────────────────────────

export function useAnalysis(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: QK.analysis(),
    queryFn: async (): Promise<AnalyzeResult> => {
      return apiFetch(
        () => api.post("/analyze", {}),
        () => mockApi.analyze({
          name: "Student", age: 22, education: "Bachelor's", gpa: 3.6,
          field: "Computer Science", skills: [], interests: [],
          familyIncome: 600000, savings: 120000, loanCapacity: 4000000,
          targetCountries: [], riskAppetite: "moderate",
        })
      );
    },
    staleTime: 30 * 60_000,          // 30 min — expensive, don't refetch often
    gcTime:    60 * 60_000,           // Keep 1 hour in cache
    enabled:   options?.enabled ?? isLoggedIn(),
    retry:     1,
  });
}

export function useRunAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload?: Record<string, unknown>) =>
      apiFetch(() => api.post("/analyze", { ...payload, forceRefresh: true })),
    onSuccess: (data) => {
      qc.setQueryData(QK.analysis(), data);
      toast({ title: "✅ Analysis complete", description: "Your AI verdict is ready." });
    },
    onError: (e: Error) => toast({ title: "Analysis failed", description: e.message, variant: "destructive" }),
  });
}

// ─── Career ───────────────────────────────────────────────────────────────────

export function useCareers(forceRefresh = false) {
  return useQuery({
    queryKey: QK.careers(),
    queryFn: () => apiFetch(() => api.get(`/career/recommendations${forceRefresh ? "?refresh=true" : ""}`)),
    staleTime: 60 * 60_000,
    enabled:   isLoggedIn(),
  });
}

// ─── Universities ─────────────────────────────────────────────────────────────

export function useUniversities() {
  return useQuery({
    queryKey: QK.universities(),
    queryFn:  () => apiFetch(() => api.get("/universities/recommendations")),
    staleTime: 60 * 60_000,
    enabled:   isLoggedIn(),
  });
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export function useRunSimulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SimulationInput): Promise<SimulationResult> => {
      return apiFetch(
        () => api.post("/simulation/run", input),
        () => mockApi.simulateFuture(input)
      );
    },
    onSuccess: (data, variables) => {
      qc.setQueryData(QK.simulation(JSON.stringify(variables)), data);
    },
    onError: (e: Error) => toast({ title: "Simulation failed", description: e.message, variant: "destructive" }),
  });
}

// ─── Loan ─────────────────────────────────────────────────────────────────────

export function useLoanAssessment(amountInr: number) {
  return useQuery({
    queryKey: QK.loanAssess(amountInr),
    queryFn:  () => apiFetch(
      () => api.post("/loan/assess", { requestedAmount: amountInr, currency: "INR" }),
      () => mockApi.loanEvaluate(amountInr)
    ),
    staleTime: 15 * 60_000,
    enabled:   amountInr > 0,
  });
}

// ─── Digital Twin ─────────────────────────────────────────────────────────────

export function useTwin() {
  return useQuery({
    queryKey: QK.twin(),
    queryFn:  () => apiFetch(() => api.get("/digital-twin")),
    staleTime: 10 * 60_000,
    enabled:   isLoggedIn(),
  });
}

// ─── Dropout Risk ─────────────────────────────────────────────────────────────

export function useDropoutRisk() {
  return useQuery({
    queryKey: QK.dropout(),
    queryFn:  () => apiFetch(() => api.get("/dropout-risk")),
    staleTime: 30 * 60_000,
    enabled:   isLoggedIn(),
  });
}

// ─── Reality Check ────────────────────────────────────────────────────────────

export function useRealityCheck() {
  return useQuery({
    queryKey: QK.realityCheck(),
    queryFn:  () => apiFetch(() => api.get("/reality-check")),
    staleTime: 20 * 60_000,
    enabled:   isLoggedIn(),
  });
}

// ─── Regret Engine ────────────────────────────────────────────────────────────

export function useRegretAnalysis() {
  return useQuery({
    queryKey: QK.regret(),
    queryFn:  () => apiFetch(() => api.get("/regret-analysis")),
    staleTime: 30 * 60_000,
    enabled:   isLoggedIn(),
  });
}

// ─── Parent Report ────────────────────────────────────────────────────────────

export function useParentReport() {
  return useQuery({
    queryKey: QK.parentReport(),
    queryFn:  () => apiFetch(() => api.get("/parent-report")),
    staleTime: 30 * 60_000,
    enabled:   isLoggedIn(),
  });
}

// ─── Mentor Chat ──────────────────────────────────────────────────────────────

export function useSendMentorMessage() {
  return useMutation({
    mutationFn: async ({ message, history }: { message: string; history: { role: string; content: string }[] }) =>
      apiFetch(
        async () => {
          let sid = localStorage.getItem("ff_mentor_session");
          if (!sid) {
            const s = await api.post("/mentor/sessions", { topic: "general" });
            sid = s.data?.data?.session?.id;
            if (sid) localStorage.setItem("ff_mentor_session", sid);
          }
          return api.post(`/mentor/sessions/${sid}/chat`, { message, context: { history: history.slice(-6) } });
        },
        () => mockApi.chat(message, history).then(r => ({ response: r }))
      ),
  });
}

// ─── Auth mutations ───────────────────────────────────────────────────────────

export function useLogin() {
  const qc      = useQueryClient();
  const setUser = useAuthStore(s => s.setUser);
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (data) => {
      setUser(data.user);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast({ title: "Login failed", description: e.message, variant: "destructive" }),
  });
}

export function useRegister() {
  const setUser = useAuthStore(s => s.setUser);
  return useMutation({
    mutationFn: (payload: Parameters<typeof authApi.register>[0]) => authApi.register(payload),
    onSuccess: (data) => setUser(data.user),
    onError: (e: Error) => toast({ title: "Registration failed", description: e.message, variant: "destructive" }),
  });
}

export function useLogout() {
  const qc     = useQueryClient();
  const logout = useAuthStore(s => s.logout);
  return useMutation({
    mutationFn: logout,
    onSuccess:  () => { qc.clear(); },
  });
}
