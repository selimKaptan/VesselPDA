import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Clock, Loader2 } from "lucide-react";

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
  query: string;
  onClose: () => void;
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

export function GlobalSearch({ open, query, onClose }: GlobalSearchProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (open) {
      setRecentSearches(loadRecent());
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

  useEffect(() => { setSelectedIndex(0); }, [results]);

  const handleNavigate = useCallback((href: string, q?: string) => {
    if (q) saveRecent(q);
    onClose();
    navigate(href);
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return;
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
  }, [open, results, selectedIndex, query, handleNavigate]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  const groups = groupResults(results);
  const showRecent = query.length === 0 && recentSearches.length > 0;
  const showPrompt = query.length === 0 && recentSearches.length === 0;
  const showEmpty = query.length >= 2 && !loading && results.length === 0;

  let flatIndex = 0;

  return (
    <div
      className="absolute top-full left-0 right-0 mt-1.5 min-w-[480px] max-h-[420px] bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl shadow-black/60 z-50 flex flex-col overflow-hidden"
      data-testid="global-search-overlay"
    >
      {/* Results area */}
      <div className="flex-1 overflow-y-auto" data-testid="global-search-results">

        {/* Loading skeleton */}
        {loading && query.length >= 2 && results.length === 0 && (
          <div className="py-3 space-y-1 px-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex items-center gap-3 px-2 py-2">
                <div className="w-7 h-7 rounded-lg bg-slate-700/60 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-700/60 rounded w-2/3" />
                  <div className="h-2.5 bg-slate-700/40 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading inline spinner for subsequent results */}
        {loading && results.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 border-b border-slate-700/30">
            <Loader2 className="w-3 h-3 animate-spin" />
            Searching…
          </div>
        )}

        {/* Recent searches */}
        {showRecent && (
          <div>
            <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-800/40 font-semibold">
              Recent Searches
            </div>
            {recentSearches.map((recent, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.preventDefault(); }}
                onClick={() => handleNavigate(`/search?q=${encodeURIComponent(recent)}`, recent)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/50 transition-colors text-left"
                data-testid={`recent-search-${i}`}
              >
                <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-300">{recent}</span>
              </button>
            ))}
          </div>
        )}

        {/* Empty prompt */}
        {showPrompt && (
          <div className="py-8 text-center text-slate-500">
            <p className="text-sm">Type at least 2 characters to search</p>
          </div>
        )}

        {/* No results */}
        {showEmpty && (
          <div className="py-8 text-center text-slate-500">
            <p className="text-sm">No results for <span className="font-semibold text-white">"{query}"</span></p>
            <p className="text-xs mt-1">Try a different keyword</p>
          </div>
        )}

        {/* Grouped results */}
        {!loading && groups.length > 0 && (
          <div>
            {groups.map(group => (
              <div key={group.type}>
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-800/40 font-semibold sticky top-0 z-10">
                  {TYPE_LABELS[group.type] || group.type}
                </div>
                {group.items.map(item => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onMouseDown={(e) => { e.preventDefault(); }}
                      onClick={() => handleNavigate(item.href, query)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                        isSelected ? "bg-slate-800/70" : "hover:bg-slate-800/50"
                      }`}
                      data-testid={`search-result-${item.type}-${item.id}`}
                    >
                      <span className="text-base flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800">
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                      </div>
                      {isSelected && (
                        <kbd className="text-[10px] bg-slate-700 border border-slate-600 px-1.5 py-0.5 rounded text-slate-400 flex-shrink-0">↵</kbd>
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
      <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-800/30 flex items-center gap-4 text-[10px] text-slate-500 flex-shrink-0">
        <span className="flex items-center gap-1">
          <kbd className="bg-slate-700 border border-slate-600 px-1 py-0.5 rounded text-[9px]">↑↓</kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-slate-700 border border-slate-600 px-1 py-0.5 rounded text-[9px]">↵</kbd> open
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-slate-700 border border-slate-600 px-1 py-0.5 rounded text-[9px]">ESC</kbd> close
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          <kbd className="bg-slate-700 border border-slate-600 px-1 py-0.5 rounded text-[9px]">⌘K</kbd> to focus
        </span>
      </div>
    </div>
  );
}

export default GlobalSearch;
