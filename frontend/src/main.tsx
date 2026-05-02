import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            5 * 60_000,   // 5 min default
      gcTime:               30 * 60_000,  // 30 min
      retry:                1,
      refetchOnWindowFocus: false,        // Don't blast AI endpoints on tab focus
    },
    mutations: {
      retry: 0,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
