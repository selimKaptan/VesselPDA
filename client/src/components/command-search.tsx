import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Loader2, Ship, Anchor, FileText, Map, Users, Receipt, BarChart3, MessageSquare, Building2, Clock } from "lucide-react";

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  icon: string;
  href: string;
}

interface GroupedResults {
  type: string;
  label: string;
  icon: ReactNode;
  items: SearchResult[];
}

const TYPE_CONFIG: Record<string, { label: string; icon: ReactNode; color: string }> = {
  vessel:          { label: "Vessels",         icon: <Ship className="w-4 h-4" />,         color: "text-sky-500" },
  voyage:          { label: "Voyages",          icon: <Map className="w-4 h-4" />,           color: "text-indigo-500" },
  proforma:        { label: "Proformas",        icon: <FileText className="w-4 h-4" />,      color: "text-emerald-500" },
  fda:             { label: "FDA",              icon: <BarChart3 className="w-4 h-4" />,     color: "text-orange-500" },
  invoice:         { label: "Invoices",         icon: <Receipt className="w-4 h-4" />,       color: "text-violet-500" },
  port:            { label: "Ports",            icon: <Anchor className="w-4 h-4" />,        color: "text-amber-500" },
  port_datalastic: { label: "Ports (Live)",     icon: <Anchor className="w-4 h-4" />,        color: "text-violet-400" },
  company:         { label: "Companies",        icon: <Building2 className="w-4 h-4" />,     color: "text-rose-500" },
  forum:           { label: "Forum",            icon: <MessageSquare className="w-4 h-4" />, color: "text-teal-500" },
  tender:          { label: "Tenders",          icon: <Users className="w-4 h-4" />,         color: "text-pink-500" },
};

const TYPE_ORDER = ["vessel", "voyage", "proforma", "fda", "invoice", "tender", "port", "port_datalastic", "company", "forum"];
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

function groupResults(results: SearchResult[]): GroupedResults[] {
  const map: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!map[r.type]) map[r.type] = [];
    map[r.type].push(r);
  }
  return TYPE_ORDER
    .filter(t => !!map[t])
    .map(t => ({
      type: t,
      label: TYPE_CONFIG[t]?.label ?? t,
      icon: TYPE_CONFIG[t]?.icon,
      items: map[t],
    }));
}

interface CommandSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandSearch({ open, onOpenChange }: CommandSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<ReturnType<typeof loadRecent>>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestRef = useRef("");
  const [, navigate] = useLocation();

  useEffect(() => {
    if (open) setRecent(loadRecent());
    else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => fetchResults(query), 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchResults]);

  function handleSelect(result: SearchResult) {
    saveRecent({ title: result.title, subtitle: result.subtitle, href: result.href, type: result.type });
    setRecent(loadRecent());
    navigate(result.href);
    onOpenChange(false);
  }

  function handleRecentSelect(item: ReturnType<typeof loadRecent>[0]) {
    navigate(item.href);
    onOpenChange(false);
  }

  const groups = groupResults(results);
  const showRecent = query.length < 2 && recent.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="relative">
        {loading && (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin z-10" />
        )}
        <CommandInput
          placeholder="Search vessels, ports, proformas, voyages..."
          value={query}
          onValueChange={setQuery}
          data-testid="input-command-search"
        />
      </div>

      <CommandList className="max-h-[420px]">
        {showRecent && (
          <CommandGroup heading="Recent">
            {recent.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type];
              return (
                <CommandItem
                  key={`recent-${i}`}
                  value={`recent-${item.href}-${i}`}
                  onSelect={() => handleRecentSelect(item)}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  data-testid={`cmd-recent-${i}`}
                >
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                  </div>
                  {cfg && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {cfg.label}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <CommandEmpty>
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
              <p className="text-xs text-muted-foreground mt-1">Try a vessel name, IMO, port, or reference number</p>
            </div>
          </CommandEmpty>
        )}

        {groups.map((group, gi) => (
          <div key={group.type}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={group.label}>
              {group.items.map((item) => {
                const cfg = TYPE_CONFIG[item.type];
                return (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.type}-${item.id}-${item.title}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    data-testid={`cmd-result-${item.type}-${item.id}`}
                  >
                    <span className={`shrink-0 ${cfg?.color ?? "text-muted-foreground"}`}>
                      {cfg?.icon ?? <FileText className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 hidden sm:flex">
                      {item.icon}
                    </Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>

      <div className="border-t px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="bg-muted border rounded px-1 py-0.5 text-[10px]">↑↓</kbd> navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="bg-muted border rounded px-1 py-0.5 text-[10px]">↵</kbd> open
        </span>
        <span className="ml-auto flex items-center gap-1">
          <kbd className="bg-muted border rounded px-1 py-0.5 text-[10px]">⌘K</kbd> to open
        </span>
      </div>
    </CommandDialog>
  );
}

export default CommandSearch;
