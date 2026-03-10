import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Loader2,
  Ship,
  Anchor,
  FileText,
  Map,
  Users,
  Receipt,
  BarChart3,
  MessageSquare,
  Building2,
  Clock,
  Navigation,
  LayoutDashboard,
  Settings,
  Compass,
  MapPin,
  DollarSign,
  Search,
} from "lucide-react";

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
  color: string;
  items: SearchResult[];
}

const TYPE_CONFIG: Record<string, { label: string; icon: ReactNode; color: string }> = {
  vessel:          { label: "Vessels",   icon: <Ship className="w-4 h-4" />,         color: "text-sky-400" },
  voyage:          { label: "Voyages",   icon: <Map className="w-4 h-4" />,           color: "text-indigo-400" },
  proforma:        { label: "Proformas", icon: <FileText className="w-4 h-4" />,      color: "text-emerald-400" },
  fda:             { label: "FDA",       icon: <BarChart3 className="w-4 h-4" />,     color: "text-orange-400" },
  invoice:         { label: "Invoices",  icon: <Receipt className="w-4 h-4" />,       color: "text-violet-400" },
  port:            { label: "Ports",     icon: <Anchor className="w-4 h-4" />,        color: "text-amber-400" },
  port_datalastic: { label: "Ports",     icon: <Anchor className="w-4 h-4" />,        color: "text-violet-400" },
  company:         { label: "Companies", icon: <Building2 className="w-4 h-4" />,     color: "text-rose-400" },
  forum:           { label: "Forum",     icon: <MessageSquare className="w-4 h-4" />, color: "text-teal-400" },
  tender:          { label: "Tenders",   icon: <Users className="w-4 h-4" />,         color: "text-pink-400" },
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
      color: TYPE_CONFIG[t]?.color ?? "text-slate-400",
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
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
    } else {
      setQuery("");
      setResults([]);
      if (abortRef.current) abortRef.current.abort();
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
    navigate(result.href);
    onOpenChange(false);
  }

  function handleRecentSelect(item: ReturnType<typeof loadRecent>[0]) {
    navigate(item.href);
    onOpenChange(false);
  }

  function handleNavSelect(url: string) {
    navigate(url);
    onOpenChange(false);
  }

  const groups = groupResults(results);
  const showRecent = query.length < 2 && recent.length > 0;
  const filteredNav = query.length > 0
    ? QUICK_NAV.filter(n => n.name.toLowerCase().includes(query.toLowerCase()))
    : QUICK_NAV;
  const showNav = filteredNav.length > 0 && (query.length < 2 || groups.length === 0);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[14%] z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-slate-700/80 bg-[#0d1424] shadow-2xl shadow-black/80 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=closed]:slide-out-to-top-[14%] data-[state=open]:slide-in-from-top-[14%]"
          data-testid="command-search-dialog"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <Command
            shouldFilter={false}
            className="bg-transparent text-slate-100 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:mx-2 [&_[cmdk-item][aria-selected=true]]:bg-slate-700/50 [&_[cmdk-item][aria-selected=true]]:text-slate-100"
          >
            {/* ── Search Input ── */}
            <div className="flex items-center gap-3 px-4 border-b border-slate-700/60" cmdk-input-wrapper="">
              {loading ? (
                <Loader2 className="w-[18px] h-[18px] text-slate-500 shrink-0 animate-spin" />
              ) : (
                <Search className="w-[18px] h-[18px] text-slate-500 shrink-0" />
              )}
              <CommandInput
                placeholder="Search vessels, ports, proformas, voyages..."
                value={query}
                onValueChange={setQuery}
                className="flex-1 bg-transparent text-[15px] text-slate-100 placeholder:text-slate-600 outline-none border-0 p-0 py-4 h-auto focus:ring-0 [&:focus]:outline-none"
                data-testid="input-command-search"
              />
            </div>

            {/* ── Results List ── */}
            <CommandList className="max-h-[420px] overflow-y-auto py-2">

              {/* Empty state */}
              {query.length >= 2 && !loading && results.length === 0 && groups.length === 0 && (
                <CommandEmpty>
                  <div className="flex flex-col items-center py-10 text-slate-600">
                    <Ship className="w-10 h-10 mb-3 opacity-15" />
                    <p className="text-sm font-medium text-slate-500">No results for &quot;{query}&quot;</p>
                    <p className="text-xs text-slate-600 mt-1">Try a vessel name, IMO, port, or reference number</p>
                  </div>
                </CommandEmpty>
              )}

              {/* Recent Searches */}
              {showRecent && (
                <CommandGroup heading="Recent">
                  {recent.map((item, i) => {
                    const cfg = TYPE_CONFIG[item.type];
                    return (
                      <CommandItem
                        key={`recent-${i}`}
                        value={`recent-${item.href}-${i}`}
                        onSelect={() => handleRecentSelect(item)}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                        data-testid={`cmd-recent-${i}`}
                      >
                        <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-200 truncate">{item.title}</div>
                          <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                        </div>
                        {cfg && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-700/80 bg-slate-800/60 text-slate-500 shrink-0">
                            {cfg.label}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {/* Search Result Groups */}
              {groups.map((group, gi) => (
                <div key={group.type}>
                  {(gi > 0 || showRecent) && <CommandSeparator className="bg-slate-700/30 mx-3 my-1.5" />}
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
                          <span className={`shrink-0 ${cfg?.color ?? "text-slate-400"}`}>
                            {cfg?.icon ?? <FileText className="w-4 h-4" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-200 truncate">{item.title}</div>
                            <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 shrink-0 hidden sm:block">
                            {item.icon}
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              ))}

              {/* Quick Navigation */}
              {showNav && (
                <>
                  {(groups.length > 0 || showRecent) && (
                    <CommandSeparator className="bg-slate-700/30 mx-3 my-1.5" />
                  )}
                  <CommandGroup heading="Quick Navigation">
                    {filteredNav.map(item => (
                      <CommandItem
                        key={item.url}
                        value={`nav-${item.url}-${item.name}`}
                        onSelect={() => handleNavSelect(item.url)}
                        className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                        data-testid={`cmd-nav-${item.url.replace(/\//g, "-")}`}
                      >
                        <item.icon className={`w-4 h-4 shrink-0 ${item.color}`} />
                        <span className="text-sm text-slate-300">{item.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>

            {/* ── Footer ── */}
            <div className="border-t border-slate-700/40 px-4 py-2.5 flex items-center gap-4 bg-slate-900/50">
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <kbd className="inline-flex items-center rounded border border-slate-700/80 bg-slate-800/60 px-1 py-0.5 text-[10px] font-medium text-slate-500">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <kbd className="inline-flex items-center rounded border border-slate-700/80 bg-slate-800/60 px-1 py-0.5 text-[10px] font-medium text-slate-500">↵</kbd>
                open
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <kbd className="inline-flex items-center rounded border border-slate-700/80 bg-slate-800/60 px-1 py-0.5 text-[10px] font-medium text-slate-500">Esc</kbd>
                close
              </span>
              <span className="ml-auto text-[11px] text-slate-600 flex items-center gap-1.5">
                <kbd className="inline-flex items-center rounded border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">⌘K</kbd>
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default CommandSearch;
