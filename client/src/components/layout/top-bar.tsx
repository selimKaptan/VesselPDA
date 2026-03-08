import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/lib/i18n";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { NotificationBell } from "@/components/notification-bell";
import { GlobalSearch } from "@/components/global-search";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Moon,
  Sun,
  Menu,
  Settings,
  Building2,
  Crown,
  LogOut,
  ChevronDown,
  Anchor,
  Search,
  Shield,
  X,
  Zap,
} from "lucide-react";

const PLAN_BADGE: Record<string, string> = {
  free: "bg-slate-700 text-slate-300",
  standard: "bg-amber-900/40 text-amber-400",
  unlimited: "bg-sky-900/40 text-sky-400",
};

const ADMIN_ROLE_OPTIONS = [
  { value: "admin", label: "Admin View" },
  { value: "agent", label: "Ship Agent" },
  { value: "shipowner", label: "Shipowner" },
  { value: "broker", label: "Ship Broker" },
  { value: "provider", label: "Ship Provider" },
  { value: "master", label: "Ship Master" },
];

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      data-testid="button-dark-mode-toggle"
      aria-label="Toggle dark mode"
      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function UserMenu({ user }: { user: any }) {
  const userRole = user?.userRole || "shipowner";
  const activeRole = user?.activeRole;
  const isAdmin = userRole === "admin";
  const plan = user?.subscriptionPlan || "free";
  const initials = `${(user?.firstName || "")[0] || ""}${(user?.lastName || "")[0] || ""}`.toUpperCase() || "U";
  const name = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "User";
  const { toast } = useToast();

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const res = await apiRequest("PATCH", "/api/admin/active-role", { activeRole: newRole });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err: any) => {
      toast({ title: "Role switch failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="button-user-menu"
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <Avatar className="w-7 h-7 flex-shrink-0 ring-2 ring-slate-700 hover:ring-sky-500/50 transition-all duration-200">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-sky-700 text-white text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium leading-tight truncate max-w-[100px] text-white">{name}</span>
              {isAdmin && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase tracking-wide leading-none">
                  Admin
                </span>
              )}
            </div>
            <span className={`text-[9px] font-bold px-1 rounded uppercase ${PLAN_BADGE[plan] || PLAN_BADGE.free}`}>{plan}</span>
          </div>
          <ChevronDown className="w-3 h-3 text-white/50 hidden md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          {isAdmin && (
            <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase">Admin</span>
          )}
        </div>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> View as role
              </p>
              {ADMIN_ROLE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => switchRoleMutation.mutate(opt.value)}
                  disabled={switchRoleMutation.isPending}
                  data-testid={`menu-role-${opt.value}`}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer ${
                    activeRole === opt.value
                      ? "bg-primary/10 text-primary font-medium focus:bg-primary/10 focus:text-primary"
                      : "text-foreground"
                  }`}
                >
                  {opt.label}
                  {activeRole === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                  {switchRoleMutation.isPending && switchRoleMutation.variables === opt.value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild data-testid="menu-settings">
          <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
            <Settings className="w-4 h-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="menu-company-profile">
          <Link href="/company-profile" className="flex items-center gap-2 cursor-pointer">
            <Building2 className="w-4 h-4" /> Company Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild data-testid="menu-pricing">
          <Link href="/pricing" className="flex items-center gap-2 cursor-pointer">
            <Crown className="w-4 h-4" /> Pricing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild data-testid="menu-logout">
          <a href="/api/logout" className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500">
            <LogOut className="w-4 h-4" /> Sign Out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface TopBarProps {
  user: any;
  onMenuClick: () => void;
}

function ActionBadge() {
  const { data: actions } = useQuery<{ counts: { critical: number, total: number } }>({
    queryKey: ["/api/actions/pending"],
    refetchInterval: 120000,
  });

  if (!actions || !actions.counts || !actions.counts.critical) return null;

  return (
    <Link href="/actions">
      <div className="relative group cursor-pointer">
        <Zap className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors" />
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-[#080c18] animate-pulse">
          {actions.counts.critical}
        </span>
      </div>
    </Link>
  );
}

export function TopBar({ user, onMenuClick }: TopBarProps) {
  const { lang, setLang } = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="h-12 flex-shrink-0 flex items-center px-3 gap-3 bg-[#080c18] border-b border-slate-700/50 z-30">
      {/* Left: hamburger (mobile) + logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onMenuClick}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          data-testid="button-mobile-nav"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
          <Anchor className="w-5 h-5 text-sky-400 flex-shrink-0" />
          <span className="hidden sm:block font-bold text-sm text-white tracking-tight">VesselPDA</span>
        </Link>
      </div>

      {/* Center: inline search with dropdown */}
      <div ref={searchRef} className="flex-1 max-w-md mx-auto relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search vessels, ports, proformas..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            data-testid="button-open-search"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-slate-800/50 border border-slate-700/40 rounded-full pl-9 pr-12 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 focus:bg-slate-800/80 transition-colors hover:bg-slate-700/40"
          />
          {searchQuery ? (
            <button
              onClick={() => { setSearchQuery(""); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-[10px] bg-slate-700/60 border border-slate-600/50 px-1.5 py-0.5 rounded text-slate-400 pointer-events-none">
              <span>⌘</span><span>K</span>
            </kbd>
          )}
        </div>

        <GlobalSearch
          open={searchOpen}
          query={searchQuery}
          onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
        />
      </div>

      {/* Right: lang · theme · bell · user */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <div className="hidden md:flex rounded-md border border-white/15 text-[10px] overflow-hidden">
          <button
            onClick={() => setLang("en")}
            className={`px-2 py-1 font-medium transition-colors ${lang === "en" ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
            data-testid="button-lang-en"
          >EN</button>
          <button
            onClick={() => setLang("tr")}
            className={`px-2 py-1 font-medium transition-colors ${lang === "tr" ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
            data-testid="button-lang-tr"
          >TR</button>
        </div>
        <DarkModeToggle />
        <ActionBadge />
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
