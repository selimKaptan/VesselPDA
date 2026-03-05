import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Clock, X, Loader2 } from "lucide-react";

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RECENT_KEY = "vpda-recent-searches";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const existing = loadRecent();
    const updated = [query, ...existing.filter(q => q !== query)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
}

const TYPE_ORDER = ["vessel", "port", "proforma", "tender", "voyage", "company", "forum"];
const TYPE_LABELS: Record<string, string> = {
  vessel: "Vessels",
  port: "Ports",
  proforma: "Proformas",
  tender: "Tenders",
  voyage: "Voyages",
  company: "Companies",
  forum: "Forum Topics",
};

function groupResults(results: SearchResult[]): Array<{ type: string; items: SearchResult[] }> {
  const map = new Map<string, SearchResult[]>();
  for (const r of results) {
    if (!map.has(r.type)) map.set(r.type, []);
    map.get(r.type)!.push(r);
  }
  return TYPE_ORDER.filter(t => map.has(t)).map(t => ({ type: t, items: map.get(t)! }));
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setRecentSearches(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => fetchResults(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults]);

  const handleNavigate = useCallback((href: string, q?: string) => {
    if (q) saveRecent(q);
    onOpenChange(false);
    navigate(href);
  }, [navigate, onOpenChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { onOpenChange(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && results.length > 0) {
      const item = results[selectedIndex];
      if (item) handleNavigate(item.href, query);
    }
  };

  useEffect(() => { setSelectedIndex(0); }, [results]);

  if (!open) return null;

  const groups = groupResults(results);
  const flatResults = groups.flatMap(g => g.items);
  let flatIndex = 0;

  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showEmpty = query.length >= 2 && !loading && results.length === 0;

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex flex-col items-center"
      data-testid="global-search-overlay"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="mt-[12vh] w-full max-w-xl mx-4 bg-background border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search vessels, ports, proformas..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            data-testid="global-search-input"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {query && !loading && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="text-[10px] bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground hidden sm:block">ESC</kbd>
          </div>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto" data-testid="global-search-results">
          {/* Loading skeleton */}
          {loading && query.length >= 2 && results.length === 0 && (
            <div className="py-3 space-y-2 px-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted/60" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted/60 rounded w-2/3" />
                    <div className="h-2.5 bg-muted/40 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent searches (empty input) */}
          {showRecent && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground bg-muted/30 font-medium">
                Recent Searches
              </div>
              {recentSearches.map((recent, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(recent)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  data-testid={`recent-search-${i}`}
                >
                  <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{recent}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty prompt when no recent */}
          {query.length === 0 && recentSearches.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Type at least 2 characters to search</p>
            </div>
          )}

          {/* No results */}
          {showEmpty && (
            <div className="py-10 text-center text-muted-foreground">
              <p className="text-sm">No results for <span className="font-semibold text-foreground">"{query}"</span></p>
              <p className="text-xs mt-1">Try a different keyword</p>
            </div>
          )}

          {/* Grouped results */}
          {!loading && groups.length > 0 && (
            <div className="py-1">
              {groups.map(group => (
                <div key={group.type}>
                  <div className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground bg-muted/30 font-medium sticky top-0">
                    {TYPE_LABELS[group.type] || group.type}
                  </div>
                  {group.items.map(item => {
                    const idx = flatIndex++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleNavigate(item.href, query)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                          isSelected ? "bg-muted/70" : "hover:bg-muted/40"
                        }`}
                        data-testid={`search-result-${item.type}-${item.id}`}
                      >
                        <span className="text-xl flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-muted/50">
                          {item.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                        </div>
                        {isSelected && (
                          <kbd className="text-[10px] bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground flex-shrink-0">↵</kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[10px]">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[10px]">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[10px]">ESC</kbd> close</span>
          <span className="ml-auto flex items-center gap-0.5">
            <kbd className="bg-muted border border-border px-1 py-0.5 rounded text-[10px]">⌘K</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
