import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Loader2, Ship, Anchor, FileText, Map, Users, Receipt,
  BarChart3, MessageSquare, Building2, Clock, Navigation,
  LayoutDashboard, Settings, Compass, MapPin, DollarSign,
  Search, X, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  vessel:          { label: "Vessels",   icon: Ship,          color: "text-sky-400" },
  voyage:          { label: "Voyages",   icon: Navigation,    color: "text-emerald-400" },
  proforma:        { label: "Proformas", icon: FileText,      color: "text-indigo-400" },
  fda:             { label: "FDA",       icon: BarChart3,     color: "text-orange-400" },
  invoice:         { label: "Invoices",  icon: Receipt,       color: "text-violet-400" },
  port:            { label: "Ports",     icon: MapPin,        color: "text-amber-400" },
  port_datalastic: { label: "Ports",     icon: Anchor,        color: "text-amber-400" },
  company:         { label: "Companies", icon: Building2,     color: "text-rose-400" },
  forum:           { label: "Forum",     icon: MessageSquare, color: "text-teal-400" },
  tender:          { label: "Tenders",   icon: Users,         color: "text-pink-400" },
};

const TYPE_ORDER = ["vessel", "voyage", "proforma", "fda", "invoice", "tender", "port", "port_datalastic", "company", "forum"];

const QUICK_NAV = [
  { name: "Dashboard",        url: "/dashboard",        icon: LayoutDashboard, color: "text-slate-400" },
  { name: "Voyages",          url: "/voyages",          icon: Ship,            color: "text-sky-400" },
  { name: "Vessels",          url: "/vessels",          icon: Anchor,          color: "text-sky-400" },
  { name: "Proformas",        url: "/proformas",        icon: FileText,        color: "text-emerald-400" },
  { name: "Vessel Tracking",  url: "/vessel-track",     icon: Navigation,      color: "text-indigo-400" },
  { name: "Crew Roster",      url: "/crew",             icon: Users,           color: "text-pink-400" },
  { name: "Passage Planning", url: "/passage-planning", icon: Compass,         color: "text-teal-400" },
  { name: "Invoices",         url: "/invoices",         icon: DollarSign,      color: "text-violet-400" },
  { name: "PMS",              url: "/pms",              icon: Settings,        color: "text-orange-400" },
  { name: "Port Info",        url: "/ports",            icon: MapPin,          color: "text-amber-400" },
];

const AI_SUGGESTIONS = [
  "What vessels are currently in port?",
  "Summarize active voyages",
  "Estimate port costs for Mersin",
  "Which crew certificates expire soon?",
];

const RECENT_KEY = "vpda-cmd-recent";
const MAX_RECENT = 6;

function loadRecent(): { title: string; subtitle: string; href: string; type: string }[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function saveRecent(item: { title: string; subtitle: string; href: string; type: string }) {
  try {
    const existing = loadRecent();
    const updated = [item, ...existing.filter(r => r.href !== item.href)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
}

interface FlatItem { url: string; title: string; subtitle: string; type: string; id?: number }
type AiMessage = { role: "user" | "assistant"; content: string };

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"search" | "ai">("search");
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<ReturnType<typeof loadRecent>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const aiBottomRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setMode("search");
      setAiMessages([]);
      if (abortRef.current) abortRef.current.abort();
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (query.startsWith("/") && mode === "search") {
      setMode("ai");
      setQuery(query.substring(1));
    }
  }, [query, mode]);

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, aiLoading]);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    latestRef.current = q;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`, {
        credentials: "include",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("search failed");
      const data = await res.json();
      if (latestRef.current !== q) return;
      setResults(data.results || []);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setResults([]);
    } finally {
      if (latestRef.current === q) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => fetchResults(query), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults, mode]);

  function handleSelect(url: string, result?: SearchResult) {
    if (result) saveRecent({ title: result.title, subtitle: result.subtitle, href: result.href, type: result.type });
    navigate(url);
    onOpenChange(false);
  }

  async function handleAiSubmit(text: string) {
    const userMsg = text.trim();
    if (!userMsg || aiLoading) return;
    const newMsg: AiMessage = { role: "user", content: userMsg };
    const updatedMessages = [...aiMessages, newMsg];
    setAiMessages(updatedMessages);
    setQuery("");
    setAiLoading(true);
    setTimeout(() => inputRef.current?.focus(), 50);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const reply = data.reply || data.response || data.content || data.message || "No response";
        setAiMessages(prev => [...prev, { role: "assistant", content: reply }]);
      } else {
        setAiMessages(prev => [...prev, { role: "assistant", content: "Yanıt alınamadı. Lütfen tekrar deneyin." }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Bağlantı hatası. Lütfen tekrar deneyin." }]);
    } finally {
      setAiLoading(false);
    }
  }

  const filteredNav = query.length > 0
    ? QUICK_NAV.filter(n => n.name.toLowerCase().includes(query.toLowerCase()))
    : QUICK_NAV;

  const groupedResults: { type: string; items: SearchResult[] }[] = TYPE_ORDER
    .map(t => ({ type: t, items: results.filter(r => r.type === t) }))
    .filter(g => g.items.length > 0);

  const showSearchResults = query.length >= 2 && (results.length > 0 || loading);
  const showEmpty = query.length >= 2 && !loading && results.length === 0 && filteredNav.length === 0;
  const showRecent = query.length < 2 && recent.length > 0;

  const allFlat: FlatItem[] = mode === "search" ? [
    ...(showRecent ? recent.map(r => ({ url: r.href, title: r.title, subtitle: r.subtitle, type: r.type })) : []),
    ...results.map(r => ({ url: r.href, title: r.title, subtitle: r.subtitle, type: r.type, id: r.id })),
    ...(query.length < 2 ? filteredNav.map(n => ({ url: n.url, title: n.name, subtitle: "", type: "nav" })) : []),
    ...(query.length >= 2 && results.length === 0 ? filteredNav.map(n => ({ url: n.url, title: n.name, subtitle: "", type: "nav" })) : []),
  ] : [];

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      setMode(prev => prev === "search" ? "ai" : "search");
      return;
    }

    if (mode === "ai") {
      if (e.key === "Enter" && query.trim() && !aiLoading) {
        e.preventDefault();
        handleAiSubmit(query);
      }
      if (e.key === "Escape") onOpenChange(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allFlat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allFlat[selectedIndex]) {
        const matched = results.find(r => r.href === allFlat[selectedIndex].url);
        handleSelect(allFlat[selectedIndex].url, matched);
      }
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }

  let flatIdx = 0;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      <div
        className={cn(
          "fixed z-50 left-1/2 -translate-x-1/2 top-16 w-full max-w-xl rounded-xl overflow-hidden shadow-2xl shadow-black/50",
          "animate-in fade-in slide-in-from-top-2 duration-200",
          mode === "ai"
            ? "border border-purple-500/30 bg-slate-900/95 backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.1)]"
            : "border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl"
        )}
        data-testid="command-search-dialog"
        style={{ animation: "cmdSlideIn 0.18s ease-out" }}
      >
        {/* Input row */}
        <div className="flex items-center px-4 py-3 border-b border-slate-700/50 overflow-hidden">
          {loading && mode === "search" ? (
            <Loader2 className={cn("w-4 h-4 mr-3 shrink-0 animate-spin", mode === "ai" ? "text-purple-400" : "text-slate-500")} />
          ) : (
            <Search className={cn("w-4 h-4 mr-3 shrink-0 transition-colors", mode === "ai" ? "text-purple-400" : "text-slate-500")} />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "ai" ? "Ask AI anything..." : "Search or ask AI..."}
            className={cn(
              "flex-1 min-w-0 bg-transparent text-sm outline-none transition-colors",
              mode === "ai" ? "text-purple-200 placeholder:text-purple-400/40" : "text-slate-200 placeholder:text-slate-500"
            )}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-form-type="other"
            data-testid="input-command-search"
          />

          {/* AI mode toggle */}
          <button
            onClick={() => setMode(prev => prev === "search" ? "ai" : "search")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ml-2 shrink-0",
              mode === "ai"
                ? "bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                : "bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:text-purple-400 hover:border-purple-500/30"
            )}
            data-testid="button-toggle-ai-mode"
          >
            <span>✨</span>
            <span className="hidden sm:inline">{mode === "ai" ? "AI Mode" : "Ask AI"}</span>
          </button>

          {query && (
            <button
              onClick={() => { setQuery(""); }}
              className="text-slate-500 hover:text-slate-300 ml-1.5 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[420px] overflow-y-auto">
          {mode === "search" ? (
            <>
              {showEmpty && (
                <div className="flex flex-col items-center py-8 text-slate-500">
                  <Search className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">No results for &quot;{query}&quot;</p>
                  <button
                    onClick={() => { setMode("ai"); setQuery(query); handleAiSubmit(query); }}
                    className="mt-3 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                  >
                    <span>✨</span> Ask AI instead
                  </button>
                </div>
              )}

              {showRecent && (
                <div>
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent</span>
                  </div>
                  {recent.map(item => {
                    const cfg = TYPE_CONFIG[item.type];
                    const IconComp = cfg?.icon;
                    const myIdx = flatIdx++;
                    return (
                      <button
                        key={`recent-${item.href}`}
                        onClick={() => handleSelect(item.href)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                          selectedIndex === myIdx ? "bg-blue-500/10 text-blue-400" : "hover:bg-slate-800/50 text-slate-300"
                        )}
                      >
                        <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{item.title}</div>
                          {item.subtitle && <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>}
                        </div>
                        {cfg && IconComp && <span className={cn("shrink-0", cfg.color)}><IconComp className="w-3.5 h-3.5" /></span>}
                        <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {showSearchResults && groupedResults.map((group, gi) => {
                const cfg = TYPE_CONFIG[group.type];
                const IconComp = cfg?.icon;
                return (
                  <div key={group.type}>
                    {(gi > 0 || showRecent) && <div className="border-t border-slate-700/30 my-1 mx-3" />}
                    <div className="px-4 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{cfg?.label ?? group.type}</span>
                    </div>
                    {group.items.map(item => {
                      const myIdx = flatIdx++;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleSelect(item.href, item)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                            selectedIndex === myIdx ? "bg-blue-500/10 text-blue-400" : "hover:bg-slate-800/50 text-slate-300"
                          )}
                          data-testid={`cmd-result-${item.type}-${item.id}`}
                        >
                          {IconComp ? <IconComp className={cn("w-4 h-4 shrink-0", cfg?.color)} /> : <FileText className="w-4 h-4 text-slate-500 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.title}</div>
                            {item.subtitle && <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>}
                          </div>
                          <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {(query.length < 2 || (query.length >= 2 && results.length === 0 && filteredNav.length > 0)) && (
                <div>
                  {(showRecent || showSearchResults) && <div className="border-t border-slate-700/30 my-1 mx-3" />}
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quick Navigation</span>
                  </div>
                  {filteredNav.map(item => {
                    const myIdx = flatIdx++;
                    return (
                      <button
                        key={item.url}
                        onClick={() => handleSelect(item.url)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                          selectedIndex === myIdx ? "bg-blue-500/10 text-blue-400" : "hover:bg-slate-800/50 text-slate-300"
                        )}
                        data-testid={`cmd-nav-${item.url.replace(/\//g, "-")}`}
                      >
                        <item.icon className={cn("w-4 h-4 shrink-0", item.color)} />
                        <span className="text-sm">{item.name}</span>
                        <ArrowRight className="w-3 h-3 text-slate-600 shrink-0 ml-auto" />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* AI Chat mode */
            <div className="flex flex-col">
              {aiMessages.length === 0 && !aiLoading && (
                <div className="flex flex-col items-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-3">
                    <span className="text-2xl">✨</span>
                  </div>
                  <p className="text-sm text-slate-300 font-medium mb-1">AI Operations Assistant</p>
                  <p className="text-xs text-slate-500 text-center max-w-[300px] mb-4">
                    Ask about your fleet, voyages, port costs, or get operational insights.
                  </p>
                  <div className="flex flex-col gap-1.5 w-full px-4">
                    {AI_SUGGESTIONS.map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => handleAiSubmit(suggestion)}
                        className="text-left text-xs text-slate-400 hover:text-purple-300 hover:bg-purple-500/5 px-3 py-2 rounded-lg transition-colors"
                        data-testid={`cmd-ai-suggestion`}
                      >
                        <span className="text-purple-500/50 mr-2">→</span>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {aiMessages.map((msg, i) => (
                <div key={i} className={cn("px-4 py-3", msg.role === "assistant" && "bg-slate-800/30")}>
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-semibold",
                      msg.role === "user" ? "bg-blue-500/15 text-blue-400" : "bg-purple-500/15 text-purple-400"
                    )}>
                      {msg.role === "user" ? "You" : "✨"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}

              {aiLoading && (
                <div className="px-4 py-3 bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center">
                      <span className="text-xs animate-pulse">✨</span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={aiBottomRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
              <kbd className="border border-slate-700 rounded px-1 py-0.5">Tab</kbd>
              <span>{mode === "ai" ? "Search mode" : "AI mode"}</span>
            </div>
            {mode === "search" && (
              <>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <kbd className="border border-slate-700 rounded px-1 py-0.5">↑↓</kbd>
                  <span>navigate</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <kbd className="border border-slate-700 rounded px-1 py-0.5">↵</kbd>
                  <span>open</span>
                </div>
              </>
            )}
            {mode === "ai" && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <kbd className="border border-slate-700 rounded px-1 py-0.5">↵</kbd>
                <span>send</span>
              </div>
            )}
          </div>
          <div className={cn(
            "flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors",
            mode === "ai" ? "bg-purple-500/10 text-purple-400" : "bg-slate-800 text-slate-500"
          )}>
            <span>{mode === "ai" ? "✨ AI" : "🔍 Search"}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cmdSlideIn {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </>
  );
}

export default CommandSearch;
