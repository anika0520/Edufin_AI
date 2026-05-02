import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AnalyzeResult, ProfileInput, SimulationResult } from "@/lib/api";

type Theme = "light" | "dark";
type ViewMode = "student" | "parent";

interface AppState {
  theme: Theme;
  viewMode: ViewMode;
  profile: Partial<ProfileInput>;
  analysis: AnalyzeResult | null;
  simulation: SimulationResult | null;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setViewMode: (m: ViewMode) => void;
  toggleViewMode: () => void;
  updateProfile: (p: Partial<ProfileInput>) => void;
  resetProfile: () => void;
  setAnalysis: (a: AnalyzeResult | null) => void;
  setSimulation: (s: SimulationResult | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      viewMode: "student",
      profile: {
        targetCountries: [],
        riskAppetite: "moderate",
        workExperienceMonths: 0,
        skills: [],
        interests: [],
      },
      analysis: null,
      simulation: null,
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        applyTheme(next);
      },
      setViewMode: (viewMode) => set({ viewMode }),
      toggleViewMode: () =>
        set({ viewMode: get().viewMode === "student" ? "parent" : "student" }),
      updateProfile: (p) => set({ profile: { ...get().profile, ...p } }),
      resetProfile: () => set({ profile: { targetCountries: [], skills: [], interests: [] } }),
      setAnalysis: (analysis) => set({ analysis }),
      setSimulation: (simulation) => set({ simulation }),
    }),
    {
      name: "edufin-store",
      partialize: (s) => ({ theme: s.theme, viewMode: s.viewMode, profile: s.profile }),
    }
  )
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

if (typeof window !== "undefined") {
  const stored = JSON.parse(localStorage.getItem("edufin-store") || "{}");
  applyTheme(stored?.state?.theme === "light" ? "light" : "dark");
}

// ─── Chat Store ───────────────────────────────────────────────────────────────
interface ChatState {
  messages: { id: string; role: "user" | "assistant"; content: string; ts: number }[];
  open: boolean;
  setOpen: (o: boolean) => void;
  push: (m: { role: "user" | "assistant"; content: string }) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: "welcome",
      role: "assistant",
      content: "Hi 👋 I'm your AI Mentor. Ask me anything about your study plan, loans, or career path.",
      ts: Date.now(),
    },
  ],
  open: false,
  setOpen: (open) => set({ open }),
  push: (m) =>
    set((s) => ({
      messages: [...s.messages, { ...m, id: crypto.randomUUID(), ts: Date.now() }],
    })),
  reset: () => set({ messages: [] }),
}));

// ─── Auth Store ───────────────────────────────────────────────────────────────
interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoggedIn: boolean;
  setUser: (u: AuthUser | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: !!localStorage.getItem("ff_token"),
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  logout: async () => {
    // Import dynamically to avoid circular deps
    const { authApi } = await import("@/lib/api");
    await authApi.logout();
    set({ user: null, isLoggedIn: false });
  },
}));
