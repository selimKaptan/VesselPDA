import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlobalSearch, useGlobalSearch } from "@/components/global-search";
import { AiChat } from "@/components/ai-chat";
import { DemoBanner } from "@/components/demo-banner";
import { NotificationBell } from "@/components/notification-bell";
import {
  LayoutDashboard, Ship, Anchor, FileText, Building2, Gavel, MessageSquare,
  Navigation, MapPin, Users, Settings as SettingsIcon, LogOut, Wrench,
  Handshake, Receipt, TrendingUp, Fuel, ShieldCheck, Scale, Mail, UserCheck,
  Package, Search, ChevronRight, Menu, X, Shield, BarChart3, Database,
  Globe, BookOpen, Layers, CreditCard, Calculator,
  Truck, AlertCircle, Activity,
  Moon, Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";

type SubItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  external?: boolean;
};

type ModuleTab = {
  id: string;
  label: string;
  icon: React.ElementType;
  isDashboard?: boolean;
  subItems?: SubItem[];
  badge?: number;
};

const ROLE_LABELS: Record<string, string> = {
  ship_agent: "Agent",
  shipowner: "Owner",
  ship_broker: "Broker",
  ship_provider: "Provider",
  admin: "Admin",
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  ship_agent: "bg-blue-500/20 text-blue-300 ring-blue-500/30",
  shipowner: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  ship_broker: "bg-orange-500/20 text-orange-300 ring-orange-500/30",
  ship_provider: "bg-purple-500/20 text-purple-300 ring-purple-500/30",
  admin: "bg-red-500/20 text-red-300 ring-red-500/30",
};

function getTabsForRole(role: string, badges: { email: number; notifications: number }): ModuleTab[] {
  const emailBadge = badges.email > 0 ? badges.email : undefined;
  const notifBadge = badges.notifications > 0 ? badges.notifications : undefined;

  if (role === "ship_agent") {
    return [
      {
        id: "dashboard", label: "Dashboard", icon: LayoutDashboard, isDashboard: true,
      },
      {
        id: "operations", label: "Operations", icon: Anchor,
        subItems: [
          { href: "/voyages", label: "Voyages", icon: Navigation },
          { href: "/vessel-track", label: "Vessel Track", icon: MapPin },
          { href: "/port-info", label: "Port Info", icon: Globe },
          { href: "/vessel-certificates", label: "Certificates", icon: ShieldCheck },
          { href: "/compliance", label: "Compliance", icon: Shield },
        ],
      },
      {
        id: "commercial", label: "Commercial", icon: CreditCard,
        subItems: [
          { href: "/proformas", label: "Proforma DA", icon: FileText },
          { href: "/final-da", label: "Final DA", icon: Scale },
          { href: "/invoices", label: "Invoices", icon: Receipt },
          { href: "/port-benchmarking", label: "Port Benchmarking", icon: BarChart3 },
          { href: "/market-data", label: "Market Data", icon: TrendingUp },
        ],
      },
      {
        id: "tender", label: "Tender & Bid", icon: Gavel,
        subItems: [
          { href: "/tenders", label: "Tenders", icon: Gavel },
          { href: "/nominations", label: "Nominations", icon: UserCheck },
          { href: "/service-requests", label: "Service Requests", icon: Wrench },
        ],
      },
      {
        id: "communication", label: "Communication", icon: MessageSquare,
        badge: emailBadge,
        subItems: [
          { href: "/messages", label: "Messages", icon: MessageSquare },
          { href: "/team-chat", label: "Team Chat", icon: Users },
          { href: "/email-inbox", label: "Email Inbox", icon: Mail, badge: emailBadge },
          { href: "/forum", label: "Forum", icon: BookOpen },
          { href: "/directory", label: "Directory", icon: Building2 },
        ],
      },
      {
        id: "tools", label: "Tools", icon: Wrench,
        subItems: [
          { href: "/reports", label: "Reports", icon: BarChart3 },
          { href: "/sanctions-check", label: "Sanctions Check", icon: AlertCircle },
        ],
      },
    ];
  }

  if (role === "shipowner") {
    return [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, isDashboard: true },
      {
        id: "fleet", label: "Fleet", icon: Ship,
        subItems: [
          { href: "/vessels", label: "My Fleet", icon: Ship },
          { href: "/vessel-track", label: "Fleet Tracking", icon: MapPin },
          { href: "/bunker-management", label: "Bunker Management", icon: Fuel },
          { href: "/vessel-certificates", label: "Certificates", icon: ShieldCheck },
          { href: "/compliance", label: "Compliance", icon: Shield },
        ],
      },
      {
        id: "voyages", label: "Voyages", icon: Navigation,
        subItems: [
          { href: "/voyages", label: "Voyages", icon: Navigation },
          { href: "/final-da", label: "Final DA", icon: Scale },
        ],
      },
      {
        id: "charter", label: "Charter & Market", icon: Handshake,
        subItems: [
          { href: "/fixtures", label: "Fixtures", icon: Handshake },
          { href: "/cargo-positions", label: "Cargo Positions", icon: Package },
          { href: "/tenders", label: "Tenders", icon: Gavel },
          { href: "/nominations", label: "Nominations", icon: UserCheck },
          { href: "/market-data", label: "Market Data", icon: TrendingUp },
        ],
      },
      {
        id: "commercial", label: "Commercial", icon: CreditCard,
        subItems: [
          { href: "/proformas", label: "Proformas", icon: FileText },
          { href: "/invoices", label: "Invoices", icon: Receipt },
          { href: "/port-benchmarking", label: "Port Benchmarking", icon: BarChart3 },
        ],
      },
      {
        id: "communication", label: "Communication", icon: MessageSquare,
        badge: emailBadge,
        subItems: [
          { href: "/messages", label: "Messages", icon: MessageSquare },
          { href: "/team-chat", label: "Team Chat", icon: Users },
          { href: "/email-inbox", label: "Email Inbox", icon: Mail, badge: emailBadge },
          { href: "/forum", label: "Forum", icon: BookOpen },
          { href: "/directory", label: "Directory", icon: Building2 },
        ],
      },
      {
        id: "tools", label: "Tools", icon: Wrench,
        subItems: [
          { href: "/reports", label: "Reports", icon: BarChart3 },
          { href: "/service-requests", label: "Service Requests", icon: Wrench },
          { href: "/sanctions-check", label: "Sanctions Check", icon: AlertCircle },
        ],
      },
    ];
  }

  if (role === "ship_broker") {
    return [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, isDashboard: true },
      {
        id: "charter", label: "Charter", icon: Handshake,
        subItems: [
          { href: "/fixtures", label: "Fixtures", icon: Handshake },
          { href: "/cargo-positions", label: "Cargo Positions", icon: Package },
          { href: "/tenders", label: "Tenders", icon: Gavel },
          { href: "/nominations", label: "Nominations", icon: UserCheck },
        ],
      },
      {
        id: "fleet", label: "Fleet & Vessel", icon: Ship,
        subItems: [
          { href: "/vessels", label: "Vessels", icon: Ship },
          { href: "/vessel-track", label: "Fleet Tracking", icon: MapPin },
          { href: "/bunker-management", label: "Bunker Management", icon: Fuel },
          { href: "/vessel-certificates", label: "Certificates", icon: ShieldCheck },
          { href: "/compliance", label: "Compliance", icon: Shield },
        ],
      },
      {
        id: "voyages", label: "Voyages", icon: Navigation,
        subItems: [
          { href: "/voyages", label: "Voyages", icon: Navigation },
          { href: "/final-da", label: "Final DA", icon: Scale },
        ],
      },
      {
        id: "commercial", label: "Commercial", icon: CreditCard,
        subItems: [
          { href: "/proformas", label: "Proformas", icon: FileText },
          { href: "/invoices", label: "Invoices", icon: Receipt },
        ],
      },
      {
        id: "market", label: "Market", icon: TrendingUp,
        subItems: [
          { href: "/market-data", label: "Market Data", icon: TrendingUp },
          { href: "/port-benchmarking", label: "Port Benchmarking", icon: BarChart3 },
          { href: "/sanctions-check", label: "Sanctions Check", icon: AlertCircle },
        ],
      },
      {
        id: "communication", label: "Communication", icon: MessageSquare,
        badge: emailBadge,
        subItems: [
          { href: "/messages", label: "Messages", icon: MessageSquare },
          { href: "/team-chat", label: "Team Chat", icon: Users },
          { href: "/email-inbox", label: "Email Inbox", icon: Mail, badge: emailBadge },
          { href: "/forum", label: "Forum", icon: BookOpen },
          { href: "/directory", label: "Directory", icon: Building2 },
        ],
      },
      {
        id: "tools", label: "Tools", icon: Wrench,
        subItems: [
          { href: "/reports", label: "Reports", icon: BarChart3 },
          { href: "/service-requests", label: "Service Requests", icon: Wrench },
        ],
      },
    ];
  }

  if (role === "ship_provider") {
    return [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, isDashboard: true },
      {
        id: "services", label: "Services", icon: Truck,
        subItems: [
          { href: "/service-requests", label: "Service Requests", icon: Wrench },
          { href: "/tenders", label: "Tenders", icon: Gavel },
          { href: "/service-ports", label: "Service Ports", icon: MapPin },
        ],
      },
      {
        id: "finance", label: "Finance", icon: CreditCard,
        subItems: [
          { href: "/invoices", label: "Invoices", icon: Receipt },
        ],
      },
      {
        id: "communication", label: "Communication", icon: MessageSquare,
        badge: emailBadge,
        subItems: [
          { href: "/messages", label: "Messages", icon: MessageSquare },
          { href: "/team-chat", label: "Team Chat", icon: Users },
          { href: "/forum", label: "Forum", icon: BookOpen },
          { href: "/directory", label: "Directory", icon: Building2 },
        ],
      },
      {
        id: "tools", label: "Tools", icon: Wrench,
        subItems: [
          { href: "/reports", label: "Reports", icon: BarChart3 },
        ],
      },
    ];
  }

  if (role === "admin") {
    return [
      { id: "dashboard", label: "Admin Dashboard", icon: LayoutDashboard, isDashboard: true },
      {
        id: "management", label: "Management", icon: Users,
        subItems: [
          { href: "/admin", label: "Users & Orgs", icon: Shield },
          { href: "/admin#audit", label: "Audit Logs", icon: Activity },
        ],
      },
      {
        id: "tariffs", label: "Tariffs", icon: Calculator,
        subItems: [
          { href: "/tariff-management", label: "Port Tariffs", icon: Calculator },
        ],
      },
      {
        id: "content", label: "Content", icon: Layers,
        subItems: [
          { href: "/forum", label: "Forum", icon: BookOpen },
          { href: "/directory", label: "Directory", icon: Building2 },
        ],
      },
      {
        id: "system", label: "System", icon: Database,
        subItems: [
          { href: "/admin#system", label: "System Settings", icon: SettingsIcon },
          { href: "/settings", label: "Account Settings", icon: SettingsIcon },
        ],
      },
    ];
  }

  return [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, isDashboard: true },
  ];
}

function getRouteTabId(tabs: ModuleTab[], location: string): string | null {
  if (location === "/" || location === "/dashboard") return "dashboard";
  for (const tab of tabs) {
    if (tab.isDashboard) continue;
    for (const item of tab.subItems || []) {
      const cleanHref = item.href.split("#")[0];
      if (location === cleanHref || location.startsWith(cleanHref + "/")) {
        return tab.id;
      }
    }
  }
  return null;
}

function NavBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold leading-none rounded-full bg-red-500 text-white min-w-[16px] text-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const userRole: string = (user as any)?.userRole || "shipowner";
  const activeRole: string = (user as any)?.activeRole || userRole;
  const isAdmin = userRole === "admin";
  const displayRole = isAdmin ? activeRole : userRole;
  const fullName = user ? `${(user as any).firstName || ""} ${(user as any).lastName || ""}`.trim() || "User" : "User";
  const initials = user
    ? `${((user as any).firstName || "")[0] || ""}${((user as any).lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";
  const plan: string = (user as any)?.subscriptionPlan || "free";

  const { data: emailCountData } = useQuery<{ count: number }>({
    queryKey: ["/api/email/inbox/count"],
    refetchInterval: 60_000,
  });
  const { data: notifData } = useQuery<{ notifications: any[]; unreadCount: number }>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30_000,
  });

  const emailUnread = emailCountData?.count ?? 0;
  const notifUnread = notifData?.unreadCount ?? 0;

  const tabs = getTabsForRole(displayRole, { email: emailUnread, notifications: notifUnread });

  const lsKey = `vpda-active-tab-${displayRole}`;
  const detectedTabId = getRouteTabId(tabs, location);

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (detectedTabId) return detectedTabId;
    try { return localStorage.getItem(lsKey) || "dashboard"; } catch { return "dashboard"; }
  });

  useEffect(() => {
    if (detectedTabId && detectedTabId !== activeTabId) {
      setActiveTabId(detectedTabId);
    }
  }, [detectedTabId]);

  useEffect(() => {
    try { localStorage.setItem(lsKey, activeTabId); } catch { /* */ }
  }, [activeTabId, lsKey]);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
  const showSidePanel = !activeTab?.isDashboard && (activeTab?.subItems?.length ?? 0) > 0;

  const orgName = (user as any)?.activeOrganizationName || null;

  const PLAN_COLORS: Record<string, string> = {
    free: "bg-slate-500/20 text-slate-300",
    standard: "bg-amber-500/20 text-amber-300",
    unlimited: "bg-blue-500/20 text-blue-300",
  };

  return (
    <div
      className="flex flex-col h-screen w-full bg-background overflow-hidden"
      style={{ '--app-side-panel-width': showSidePanel ? '200px' : '0px' } as any}
    >
      <DemoBanner />

      {/* ── TOP BAR ── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 h-[52px] bg-[#0F172A] border-b border-[#1E293B] z-50">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Anchor className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm hidden sm:block">VesselPDA</span>
          {orgName && (
            <span className="text-[10px] text-slate-400 font-medium hidden md:block truncate max-w-[120px]">
              / {orgName}
            </span>
          )}
        </Link>

        {/* Search — desktop */}
        <div className="hidden md:flex flex-1 max-w-[360px] mx-auto">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 h-8 rounded-md bg-[#1E293B] hover:bg-[#2D3748] border border-[#334155] text-slate-400 text-sm transition-colors"
            data-testid="button-global-search"
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 text-left">Search vessels, voyages, proformas...</span>
            <kbd className="text-[10px] px-1 py-0.5 rounded bg-[#334155] text-slate-500 font-mono hidden lg:block">⌘K</kbd>
          </button>
        </div>

        <div className="flex-1 md:hidden" />

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Mobile search */}
          <Button
            variant="ghost" size="icon"
            className="md:hidden w-8 h-8 text-slate-400 hover:text-white hover:bg-[#1E293B]"
            onClick={() => setSearchOpen(true)}
            data-testid="button-mobile-search"
          >
            <Search className="w-4 h-4" />
          </Button>

          {/* Dark mode toggle */}
          <Button
            variant="ghost" size="icon"
            className="w-8 h-8 text-slate-400 hover:text-white hover:bg-[#1E293B]"
            onClick={toggleTheme}
            data-testid="button-dark-mode-toggle"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* Notification bell */}
          <div className="relative">
            <NotificationBell />
          </div>

          {/* User avatar + dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[#1E293B] transition-colors group"
                data-testid="button-user-menu"
              >
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="text-[11px] font-bold bg-blue-700 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-xs font-semibold text-white leading-none">{fullName}</span>
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded-full mt-0.5 ring-1 ${ROLE_BADGE_COLORS[displayRole] || ROLE_BADGE_COLORS.shipowner}`}>
                    {ROLE_LABELS[displayRole] || displayRole}
                  </span>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-500 hidden sm:block rotate-90" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-semibold">{fullName}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_BADGE_COLORS[displayRole] || ""}`}>
                    {ROLE_LABELS[displayRole] || displayRole}
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${PLAN_COLORS[plan] || ""}`}>
                    {plan}
                  </span>
                </div>
              </div>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/organization" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Organization
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/company-profile" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Company Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/api/logout" className="flex items-center gap-2 text-red-400 focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950/20">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── MODULE TABS ── */}
      <div className="flex-shrink-0 flex items-end gap-0 px-2 h-[40px] bg-[#0F172A] border-b border-[#1E293B] overflow-x-auto scrollbar-none z-40 relative">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTabId(tab.id);
                if (tab.isDashboard) {
                  window.location.href = "/";
                }
              }}
              className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium whitespace-nowrap transition-all relative border-b-2 flex-shrink-0 ${
                isActive
                  ? "text-white border-blue-500 bg-blue-500/5"
                  : "text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-600"
              }`}
              data-testid={`tab-module-${tab.id}`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{tab.label}</span>
              {tab.badge && <NavBadge count={tab.badge} />}
            </button>
          );
        })}
      </div>

      {/* ── BODY (Side Panel + Content) ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Side Panel — desktop */}
        <AnimatePresence initial={false}>
          {showSidePanel && (
            <motion.div
              key={activeTabId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="hidden md:flex flex-col w-[200px] flex-shrink-0 bg-[#0B1120] border-r border-[#1E293B] overflow-y-auto"
              data-testid="nav-side-panel"
            >
              <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {activeTab?.label}
                </p>
              </div>
              <nav className="flex flex-col gap-0.5 px-2 pb-4">
                {(activeTab?.subItems || []).map(item => {
                  const Icon = item.icon;
                  const cleanHref = item.href.split("#")[0];
                  const isItemActive = location === cleanHref || location.startsWith(cleanHref + "/");
                  return (
                    <Link
                      key={item.href}
                      href={cleanHref}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all relative ${
                        isItemActive
                          ? "text-blue-400 bg-blue-500/10 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:bg-blue-500 before:rounded-r"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                      }`}
                      data-testid={`nav-${item.href.replace(/\//g, "-").slice(1)}`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && <NavBadge count={item.badge} />}
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-auto" data-testid="main-content">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <MobileBottomNav
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        location={location}
        drawerOpen={mobileDrawerOpen}
        setDrawerOpen={setMobileDrawerOpen}
        activeTab={activeTab}
      />

      {/* Global Search Dialog */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      {/* AI Chat */}
      <AiChat />
    </div>
  );
}

function MobileBottomNav({
  tabs, activeTabId, onTabChange, location, drawerOpen, setDrawerOpen, activeTab
}: {
  tabs: ModuleTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  location: string;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  activeTab: ModuleTab | undefined;
}) {
  const visibleTabs = tabs.slice(0, 4);
  const hasMore = tabs.length > 4;

  return (
    <>
      {/* Bottom nav bar */}
      <div className="md:hidden flex-shrink-0 flex items-center justify-around h-14 bg-[#0F172A] border-t border-[#1E293B] z-50">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                if (tab.isDashboard) {
                  window.location.href = "/";
                } else if (tab.subItems?.length) {
                  setDrawerOpen(true);
                }
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 relative ${
                isActive ? "text-blue-400" : "text-slate-500"
              }`}
            >
              {tab.badge && <NavBadge count={tab.badge} />}
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium">{tab.label}</span>
            </button>
          );
        })}
        {hasMore && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-slate-500"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[9px] font-medium">More</span>
          </button>
        )}
      </div>

      {/* Mobile Sub-menu Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/60"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-[#0F172A] rounded-t-2xl border-t border-[#1E293B] max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-white">
                  {activeTab?.isDashboard ? "Navigation" : activeTab?.label || "Menu"}
                </h3>
                <button onClick={() => setDrawerOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* All tabs list for "more" */}
              {tabs.slice(4).map(tab => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTabId;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { onTabChange(tab.id); setDrawerOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium ${
                      isActive ? "text-blue-400 bg-blue-500/10" : "text-slate-300 hover:bg-slate-800/30"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                    {tab.badge && <NavBadge count={tab.badge} />}
                  </button>
                );
              })}

              {/* Active tab sub-items */}
              {(activeTab?.subItems?.length ?? 0) > 0 && (
                <div className="border-t border-[#1E293B] mt-2 pt-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-4 py-1">
                    {activeTab?.label}
                  </p>
                  {(activeTab?.subItems || []).map(item => {
                    const Icon = item.icon;
                    const cleanHref = item.href.split("#")[0];
                    const isItemActive = location === cleanHref || location.startsWith(cleanHref + "/");
                    return (
                      <Link
                        key={item.href}
                        href={cleanHref}
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium ${
                          isItemActive ? "text-blue-400 bg-blue-500/10" : "text-slate-300 hover:bg-slate-800/30"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                        {item.badge && <NavBadge count={item.badge} />}
                      </Link>
                    );
                  })}
                </div>
              )}

              <div className="h-4" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
