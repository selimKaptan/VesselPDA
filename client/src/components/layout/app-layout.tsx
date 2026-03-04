import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/lib/i18n";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getModulesForRole, getActiveModule, type Module } from "@/lib/role-navigation";
import { NotificationBell } from "@/components/notification-bell";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarProvider } from "@/components/ui/sidebar";
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
  Shield,
  LayoutDashboard,
  Languages,
  ChevronRight,
  FlaskConical,
  X,
} from "lucide-react";

const PLAN_BADGE: Record<string, string> = {
  free:      "bg-muted text-muted-foreground",
  standard:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  unlimited: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const ADMIN_ROLE_OPTIONS = [
  { value: "admin",     label: "Admin View" },
  { value: "agent",     label: "Ship Agent" },
  { value: "shipowner", label: "Shipowner" },
  { value: "broker",    label: "Ship Broker" },
  { value: "provider",  label: "Ship Provider" },
];

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-dark-mode-toggle"
      aria-label="Toggle dark mode"
      className="h-8 w-8 no-scale text-white/60 hover:text-white hover:bg-white/10"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
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
          className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors no-scale"
        >
          <Avatar className="w-7 h-7">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary text-white text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start min-w-0">
            <span className="text-sm font-medium leading-tight truncate max-w-[120px] text-white">{name}</span>
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
            <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">Admin</span>
          )}
        </div>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold mb-1">View as role</p>
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

function MobileDrawer({ user, modules, activeModule, unreadMessages, pendingNominations }: {
  user: any;
  modules: Module[];
  activeModule: Module | null;
  unreadMessages: number;
  pendingNominations: number;
}) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(activeModule?.key || null);

  function isSubPageActive(url: string) {
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 no-scale text-white/70 hover:text-white hover:bg-white/10" data-testid="button-mobile-nav" aria-label="Open navigation">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 flex flex-col">
        <div className="px-4 py-4 border-b flex items-center gap-3">
          <img src="/logo-v2.png" alt="VesselPDA" className="w-8 h-8 rounded-md object-contain" />
          <div>
            <div className="font-serif font-bold text-sm">VesselPDA</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Maritime Platform</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          <Link href="/" onClick={() => setOpen(false)}>
            <div className={`flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
              location === "/" || location === "/dashboard" ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
            }`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </div>
          </Link>
          {modules.map((mod) => {
            const isExpanded = expandedModule === mod.key;
            return (
              <div key={mod.key}>
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.key)}
                  className="w-full flex items-center justify-between mx-0 px-5 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  {mod.label}
                  <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="ml-2 mr-2 mb-1">
                    {mod.subPages.map((page) => {
                      const Icon = page.icon;
                      const active = isSubPageActive(page.url);
                      const badge = page.label === "Messages" ? unreadMessages : page.label === "Nominations" ? pendingNominations : 0;
                      return (
                        <Link key={page.url} href={page.url} onClick={() => setOpen(false)}>
                          <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"
                          }`}>
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1">{page.label}</span>
                            {badge > 0 && (
                              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                                {badge}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function SidePanel({ modules, activeModule, unreadMessages, pendingNominations }: {
  modules: Module[];
  activeModule: Module | null;
  unreadMessages: number;
  pendingNominations: number;
}) {
  const [location] = useLocation();

  function isSubPageActive(url: string) {
    if (url === "/proformas/new") return location === url;
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  }

  if (!activeModule) return null;

  return (
    <aside className="w-[220px] flex-shrink-0 bg-sidebar overflow-y-auto hidden md:flex flex-col border-r border-sidebar-border">
      <div className="px-3 pt-4 pb-1">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/35 px-2 py-1">{activeModule.label}</p>
      </div>
      <nav className="flex-1 px-2 pb-3 space-y-0.5">
        {activeModule.subPages.map((page) => {
          const Icon = page.icon;
          const active = isSubPageActive(page.url);
          const badge = page.label === "Messages" ? unreadMessages : page.label === "Nominations" ? pendingNominations : 0;
          return (
            <Link key={page.url} href={page.url}>
              <div
                data-testid={`subnav-${page.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer group ${
                  active
                    ? "bg-primary text-white border-l-[3px] border-l-sidebar-accent pl-[calc(0.625rem-3px)] shadow-sm"
                    : "text-sidebar-foreground/60 hover:bg-white/6 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"}`} />
                <span className="flex-1 truncate">{page.label}</span>
                {badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { lang, setLang } = useLanguage();

  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole;
  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin && activeRole ? activeRole : userRole;

  const modules = getModulesForRole(effectiveRole);
  const activeModule = getActiveModule(modules, location);

  const { data: msgBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
  });
  const unreadMessages = msgBadge?.count || 0;

  const { data: nomBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/nominations/pending-count"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    enabled: effectiveRole === "agent",
  });
  const pendingNominations = nomBadge?.count || 0;

  function handleModuleClick(mod: Module) {
    const firstPage = mod.subPages[0];
    if (firstPage) navigate(firstPage.url);
  }

  function isModuleActive(mod: Module) {
    if (location === "/" || location === "/dashboard") {
      return mod.key === modules[0]?.key;
    }
    return mod.subPages.some((p) => location === p.url || location.startsWith(p.url + "/"));
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Top Bar — dark gradient, 56px */}
      <header className="flex-shrink-0 h-14 shadow-md bg-gradient-to-r from-slate-900 to-slate-800 flex items-center px-3 gap-2 z-30">
        {/* Left: mobile menu + logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <MobileDrawer
            user={user}
            modules={modules}
            activeModule={activeModule}
            unreadMessages={unreadMessages}
            pendingNominations={pendingNominations}
          />
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-7 h-7 rounded-md object-contain" />
            <span className="font-serif font-bold text-sm hidden sm:block text-white">VesselPDA</span>
          </Link>
        </div>

        {/* Center: Module tabs */}
        <nav className="flex-1 flex items-center justify-center overflow-x-auto scrollbar-hide px-2 self-stretch">
          <div className="flex items-center gap-0.5 h-full">
            {/* Dashboard home */}
            <Link href="/" className="self-stretch flex items-stretch">
              <button
                data-testid="nav-dashboard"
                className={`topbar-tab no-scale ${location === "/" || location === "/dashboard" ? "active" : ""}`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden lg:block">Dashboard</span>
              </button>
            </Link>

            <div className="w-px h-4 bg-white/20 mx-1 self-center flex-shrink-0" />

            {modules.map((mod) => {
              const active = isModuleActive(mod);
              const hasBadge = mod.subPages.some(
                (p) => (p.label === "Messages" && unreadMessages > 0) || (p.label === "Nominations" && pendingNominations > 0)
              );
              return (
                <button
                  key={mod.key}
                  data-testid={`nav-module-${mod.key}`}
                  onClick={() => handleModuleClick(mod)}
                  className={`topbar-tab no-scale ${active ? "active" : ""}`}
                >
                  {mod.label}
                  {hasBadge && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
                  )}
                  {isAdmin && mod.key === "admin" && (
                    <Shield className="w-3 h-3 text-red-400" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right: lang toggle + dark mode + notifications + user */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Language toggle */}
          <div className="hidden md:flex rounded-md border border-white/15 text-[10px] overflow-hidden">
            <button
              onClick={() => setLang("en")}
              className={`px-2 py-1 font-medium transition-colors no-scale ${lang === "en" ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              data-testid="button-lang-en"
            >EN</button>
            <button
              onClick={() => setLang("tr")}
              className={`px-2 py-1 font-medium transition-colors no-scale ${lang === "tr" ? "bg-white/20 text-white" : "text-white/50 hover:text-white hover:bg-white/10"}`}
              data-testid="button-lang-tr"
            >TR</button>
          </div>
          <DarkModeToggle />
          <NotificationBell />
          <UserMenu user={user} />
        </div>
      </header>

      {/* Demo mode banner */}
      {(user as any)?.email?.endsWith("@vpda.demo") && (
        <div className="flex-shrink-0 bg-amber-500 text-white text-xs font-medium flex items-center justify-between px-4 py-1.5 gap-2" data-testid="banner-demo-mode">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              You are in <strong>Demo Mode</strong> as {(user as any)?.userRole} — data may be shared.
            </span>
          </div>
          <a href="/register" className="underline hover:no-underline flex-shrink-0">Create a free account →</a>
        </div>
      )}

      {/* Body: side panel + main content */}
      <div className="flex flex-1 overflow-hidden">
        <SidePanel
          modules={modules}
          activeModule={activeModule}
          unreadMessages={unreadMessages}
          pendingNominations={pendingNominations}
        />
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
