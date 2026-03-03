import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Ship, FileText, MapPin, Building2, MessageSquare, Gavel, Anchor, Package, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MAX_RECENT = 5;
const STORAGE_KEY = "vpda_recent_searches";

interface SearchResults {
  vessels: { id: number; name: string; imoNumber?: string; flag?: string; vesselType?: string }[];
  ports: { id: number; name: string; country: string; code?: string }[];
  proformas: { id: number; referenceNumber: string; toCompany?: string; status: string }[];
  voyages: { id: number; vesselName?: string; status: string; portId?: number }[];
  directory: { id: number; companyName: string; companyType?: string; city?: string; country?: string }[];
  forum: { id: number; title: string; replyCount?: number }[];
  tenders: { id: number; vesselName?: string; status: string }[];
  fixtures: { id: number; vesselName?: string; cargoType?: string; status: string }[];
}

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(q: string) {
  try {
    const recent = getRecentSearches().filter((r) => r !== q);
    recent.unshift(q);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {}
}

function removeRecentSearch(q: string) {
  try {
    const recent = getRecentSearches().filter((r) => r !== q);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {}
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  final: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  planned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  nominated: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  closed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) setRecentSearches(getRecentSearches());
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
      setLoading(false);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (res.ok) setResults(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const go = (path: string) => {
    if (query.trim().length >= 2) saveRecentSearch(query.trim());
    onOpenChange(false);
    navigate(path);
  };

  const runRecent = (q: string) => {
    setQuery(q);
    doSearch(q);
  };

  const hasResults = results && Object.values(results).some((arr) => arr.length > 0);
  const totalCount = results ? Object.values(results).reduce((s, a) => s + a.length, 0) : 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search vessels, ports, proformas, companies..."
        value={query}
        onValueChange={setQuery}
        data-testid="input-global-search"
      />
      <CommandList className="max-h-[480px]">
        {/* Loading state */}
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">Searching...</div>
        )}

        {/* Empty state */}
        {!loading && query.length >= 2 && !hasResults && (
          <CommandEmpty>No results found for &ldquo;{query}&rdquo;</CommandEmpty>
        )}

        {/* Recent searches (shown when no query) */}
        {!loading && query.length < 2 && recentSearches.length > 0 && (
          <CommandGroup heading="Recent Searches">
            {recentSearches.map((r) => (
              <CommandItem
                key={r}
                onSelect={() => runRecent(r)}
                className="flex items-center justify-between group"
                data-testid={`recent-search-${r}`}
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {r}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecentSearch(r);
                    setRecentSearches(getRecentSearches());
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-opacity"
                  aria-label="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Empty prompt */}
        {!loading && query.length < 2 && recentSearches.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <p className="font-medium">Search everything</p>
            <p className="text-xs mt-1 text-muted-foreground/70">Vessels, ports, proformas, companies, voyages...</p>
          </div>
        )}

        {/* Results */}
        {!loading && hasResults && (
          <>
            {/* Summary */}
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b flex items-center justify-between">
              <span>{totalCount} result{totalCount !== 1 ? "s" : ""} for <strong>&ldquo;{query}&rdquo;</strong></span>
            </div>

            {results!.vessels.length > 0 && (
              <CommandGroup heading="Vessels">
                {results!.vessels.map((v) => (
                  <CommandItem key={`vessel-${v.id}`} onSelect={() => go("/vessels")} data-testid={`search-result-vessel-${v.id}`}>
                    <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{v.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{[v.vesselType, v.flag, v.imoNumber && `IMO ${v.imoNumber}`].filter(Boolean).join(" · ")}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results!.ports.length > 0 && (
              <>
                {results!.vessels.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Ports">
                  {results!.ports.map((p) => (
                    <CommandItem key={`port-${p.id}`} onSelect={() => go(`/port-info/${p.code || p.id}`)} data-testid={`search-result-port-${p.id}`}>
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.country}{p.code ? ` · ${p.code}` : ""}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results!.proformas.length > 0 && (
              <>
                {(results!.vessels.length > 0 || results!.ports.length > 0) && <CommandSeparator />}
                <CommandGroup heading="Proformas">
                  {results!.proformas.map((p) => (
                    <CommandItem key={`proforma-${p.id}`} onSelect={() => go(`/proformas/${p.id}`)} data-testid={`search-result-proforma-${p.id}`}>
                      <FileText className="w-4 h-4 text-amber-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.referenceNumber}</p>
                        {p.toCompany && <p className="text-xs text-muted-foreground truncate">{p.toCompany}</p>}
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}>{p.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results!.voyages.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Voyages">
                  {results!.voyages.map((v) => (
                    <CommandItem key={`voyage-${v.id}`} onSelect={() => go(`/voyages/${v.id}`)} data-testid={`search-result-voyage-${v.id}`}>
                      <Anchor className="w-4 h-4 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{v.vesselName || `Voyage #${v.id}`}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[v.status] ?? "bg-muted text-muted-foreground"}`}>{v.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results!.directory.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Companies">
                  {results!.directory.map((c) => (
                    <CommandItem key={`dir-${c.id}`} onSelect={() => go(`/directory/${c.id}`)} data-testid={`search-result-company-${c.id}`}>
                      <Building2 className="w-4 h-4 text-violet-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.companyName}</p>
                        <p className="text-xs text-muted-foreground truncate">{[c.companyType, c.city, c.country].filter(Boolean).join(" · ")}</p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results!.forum.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Forum Topics">
                  {results!.forum.map((f) => (
                    <CommandItem key={`forum-${f.id}`} onSelect={() => go(`/forum/topic/${f.id}`)} data-testid={`search-result-forum-${f.id}`}>
                      <MessageSquare className="w-4 h-4 text-rose-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{f.title}</p>
                      </div>
                      {(f.replyCount ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground">{f.replyCount} replies</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results!.tenders.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Tenders">
                  {results!.tenders.map((t) => (
                    <CommandItem key={`tender-${t.id}`} onSelect={() => go(`/tenders/${t.id}`)} data-testid={`search-result-tender-${t.id}`}>
                      <Gavel className="w-4 h-4 text-orange-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.vesselName || `Tender #${t.id}`}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[t.status] ?? "bg-muted text-muted-foreground"}`}>{t.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {results!.fixtures.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Fixtures">
                  {results!.fixtures.map((f) => (
                    <CommandItem key={`fixture-${f.id}`} onSelect={() => go(`/fixtures`)} data-testid={`search-result-fixture-${f.id}`}>
                      <Package className="w-4 h-4 text-teal-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{f.vesselName || `Fixture #${f.id}`}</p>
                        {f.cargoType && <p className="text-xs text-muted-foreground truncate">{f.cargoType}</p>}
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_COLORS[f.status] ?? "bg-muted text-muted-foreground"}`}>{f.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}

        {/* Footer hint */}
        {!loading && (
          <div className="flex items-center justify-end gap-4 px-3 py-2 border-t text-[10px] text-muted-foreground/60">
            <span><kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">↵</kbd> open</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> close</span>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
