import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { Bot, Send, Sparkles, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatStore, useAuthStore } from "@/store/useAppStore";
import { mockApi } from "@/lib/api";
import { cn, getErrMsg } from "@/lib/utils";

export function MentorChat() {
  const { messages, open, setOpen, push } = useChatStore();
  const { isLoggedIn } = useAuthStore();
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    setError(null);
    push({ role: "user", content: text });
    setInput("");
    setTyping(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      // mockApi.chat tries real backend first (auth or not), falls back to mock
      const reply = await mockApi.chat(text, history);
      push({ role: "assistant", content: reply });
    } catch (e: unknown) {
      const msg = getErrMsg(e);
      setError(msg);
      push({ role: "assistant", content: "Sorry, I ran into an issue. Please try again." });
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button onClick={() => setOpen(!open)}
        className="fixed bottom-20 lg:bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-primary shadow-glow grid place-items-center text-primary-foreground animate-pulse-glow"
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} aria-label="Open AI Mentor">
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} transition={{ duration: 0.25 }}
            className="fixed bottom-36 lg:bottom-24 right-6 z-40 w-[min(92vw,400px)] h-[min(70vh,560px)] glass-card flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-primary/10">
              <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-display font-semibold text-sm">AI Mentor</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  {isLoggedIn ? "Connected to your profile" : "Demo mode — log in for personalized answers"}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
              {messages.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed",
                    m.role === "user" ? "bg-gradient-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm")}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-foreground/60 animate-typing-dot" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              )}
              {error && (
                <div className="flex items-center gap-2 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3 w-3 shrink-0" />{error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-border flex gap-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={isLoggedIn ? "Ask about your plan, loans, visa…" : "Ask anything…"}
                className="flex-1" disabled={typing} />
              <Button type="submit" size="icon" className="bg-gradient-primary text-primary-foreground" disabled={typing || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
