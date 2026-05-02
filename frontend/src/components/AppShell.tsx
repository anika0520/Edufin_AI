import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  UserCog,
  Sparkles,
  Brain,
  GitCompare,
  CheckCircle2,
  Moon,
  Sun,
  Users,
  GraduationCap,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAppStore, useAuthStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const nav = [
  { to: "/profile", label: "Profile", icon: UserCog },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/simulate", label: "Simulate", icon: Sparkles },
  { to: "/twin", label: "Digital Twin", icon: Brain },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/decision", label: "Decision", icon: CheckCircle2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme, viewMode, toggleViewMode } = useAppStore();
  const { isLoggedIn, user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/" || location.pathname === "/auth";

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    navigate("/");
  };

  if (isLanding) return <>{children}</>;

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/60 backdrop-blur-xl sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            EduFin<span className="gradient-text">_AI</span>
          </span>
        </Link>

        <nav className="flex-1 px-3 py-6 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-gradient-primary"
                    />
                  )}
                  <Icon className="h-4 w-4" />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          {/* Auth status */}
          {isLoggedIn && user ? (
            <div className="glass-card p-3">
              <div className="text-xs font-semibold truncate">{user.firstName} {user.lastName}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
              <Button variant="ghost" size="sm" className="w-full mt-2 justify-start gap-2 text-xs" onClick={handleLogout}>
                <LogOut className="h-3 w-3" /> Sign out
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => navigate("/auth")}>
              <LogIn className="h-4 w-4" /> Sign in / Register
            </Button>
          )}

          <div className="glass-card p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              <div>
                <div className="text-xs font-semibold">Parent View</div>
                <div className="text-[10px] text-muted-foreground">
                  {viewMode === "parent" ? "On" : "Off"}
                </div>
              </div>
            </div>
            <Switch checked={viewMode === "parent"} onCheckedChange={toggleViewMode} />
          </div>
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Topbar mobile */}
        <header className="lg:hidden sticky top-0 z-30 glass border-b border-border h-14 flex items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary grid place-items-center">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">EduFin<span className="gradient-text">_AI</span></span>
          </Link>
          <div className="flex items-center gap-2">
            {!isLoggedIn && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/auth")}>
                <LogIn className="h-4 w-4 mr-1" /> Sign in
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-border flex justify-around py-2">
          {nav.slice(0, 5).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="container max-w-7xl py-8 px-4 lg:px-8 pb-24 lg:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
