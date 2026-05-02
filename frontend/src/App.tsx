import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { MentorChat } from "@/components/MentorChat";
import Index from "./pages/Index.tsx";
import Landing from "./pages/Landing.tsx";
import Auth from "./pages/Auth.tsx";
import Profile from "./pages/Profile.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Simulate from "./pages/Simulate.tsx";
import Twin from "./pages/Twin.tsx";
import Decision from "./pages/Decision.tsx";
import Compare from "./pages/Compare.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/simulate" element={<Simulate />} />
            <Route path="/twin" element={<Twin />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/decision" element={<Decision />} />
            <Route path="/index" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppShell>
        <MentorChat />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
