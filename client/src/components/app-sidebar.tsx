import {
  Ship, FileText, LogOut, LayoutDashboard, Building2, Crown, MapPin, Shield,
  ChevronDown, MessageSquare, MessagesSquare, MessageCircle, Anchor, Gavel,
  Navigation, Languages, Settings, ChevronUp, Users, Wrench, UserCheck,
  ShieldAlert, Handshake, Package, TrendingUp, BarChart3, Receipt, FileCheck,
  Fuel, Scale, Mail, ShieldCheck, Bell, Wallet, Layers, ClipboardList,
  BookOpen, AlertTriangle, Database, RefreshCw, FileStack, Activity,
  DollarSign, PieChart, Award, Star,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

interface BadgeCounts {
  tenders: number;
  messages: number;
  emails: number;
  nominations: number;
}

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  ship_agent:    { label: "Agent",    className: "bg-blue-500/15 text-blue-500" },
  shipowner:     { label: "Owner",    className: "bg-green-500/15 text-green-600 dark:text-green-400" },
  ship_broker:   { label: "Broker",   className: "bg-orange-500/15 text-orange-500" },
  ship_provider: { label: "Provider", className: "bg-purple-500/15 text-purple-500" },
  admin:         { label: "Admin",    className: "bg-red-500/15 text-red-400" },
};

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  standard: "bg-[hsl(var(--maritime-gold)/0.15)] text-[hsl(var(--maritime-gold))]",
  unlimited: "bg-[hsl(var(--maritime-primary)/0.15)] text-[hsl(var(--maritime-primary))]",
};

const ADMIN_ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "ship_agent",    label: "Ship Agent" },
  { value: "shipowner",     label: "Shipowner" },
  { value: "ship_broker",   label: "Broker" },
  { value: "ship_provider", label: "Provider" },
];

function agentGroups(b: BadgeCounts): NavGroup[] {
  return [
    {
      label: "Operations",
      items: [
        { title: "Dashboard",        url: "/",                  icon: LayoutDashboard },
        { title: "Vessels",          url: "/vessels",           icon: Ship },
        { title: "Voyages",          url: "/voyages",           icon: Navigation },
        { title: "Vessel Track",     url: "/vessel-track",      icon: MapPin },
        { title: "SOF Records",      url: "/voyages",           icon: ClipboardList },
        { title: "Port Info",        url: "/port-info",         icon: Anchor },
        { title: "Certificates",     url: "/vessel-certificates", icon: FileCheck },
      ],
    },
    {
      label: "Commercial",
      items: [
        { title: "Proforma DA",      url: "/proformas",         icon: FileText },
        { title: "Final DA",         url: "/final-da",          icon: BarChart3 },
        { title: "Invoices",         url: "/invoices",          icon: Receipt },
        { title: "Exchange Rates",   url: "/market-data",       icon: DollarSign },
        { title: "Port Benchmarking",url: "/port-benchmarking", icon: Scale },
        { title: "Market Data",      url: "/market-data",       icon: TrendingUp },
      ],
    },
    {
      label: "Tenders & Bids",
      items: [
        { title: "Tenders",          url: "/tenders",           icon: Gavel,     badge: b.tenders },
        { title: "Nominations",      url: "/nominations",       icon: UserCheck, badge: b.nominations },
        { title: "Service Requests", url: "/service-requests",  icon: Wrench },
      ],
    },
    {
      label: "Communication",
      items: [
        { title: "Messages",         url: "/messages",          icon: MessageSquare, badge: b.messages },
        { title: "Team Chat",        url: "/team-chat",         icon: MessageCircle },
        { title: "Email Inbox",      url: "/email-inbox",       icon: Mail,          badge: b.emails },
        { title: "Forum",            url: "/forum",             icon: MessagesSquare },
      ],
    },
    {
      label: "Other",
      items: [
        { title: "Directory",        url: "/directory",         icon: Building2 },
        { title: "Sanctions Check",  url: "/sanctions-check",   icon: ShieldAlert },
        { title: "Compliance",       url: "/compliance",        icon: ShieldCheck },
        { title: "Reports",          url: "/reports",           icon: PieChart },
        { title: "Settings",         url: "/settings",          icon: Settings },
      ],
    },
  ];
}

function shipownerGroups(b: BadgeCounts): NavGroup[] {
  return [
    {
      label: "Fleet Management",
      items: [
        { title: "Dashboard",        url: "/",                    icon: LayoutDashboard },
        { title: "My Fleet",         url: "/vessels",             icon: Ship },
        { title: "Fleet Tracking",   url: "/vessel-track",        icon: MapPin },
        { title: "Bunker Management",url: "/bunker-management",   icon: Fuel },
        { title: "Certificates",     url: "/vessel-certificates", icon: FileCheck },
        { title: "Compliance",       url: "/compliance",          icon: ShieldCheck },
      ],
    },
    {
      label: "Voyages",
      items: [
        { title: "Voyages",          url: "/voyages",             icon: Navigation },
        { title: "SOF Records",      url: "/voyages",             icon: ClipboardList },
        { title: "Voyage Expenses",  url: "/voyages",             icon: Wallet },
      ],
    },
    {
      label: "Charter & Market",
      items: [
        { title: "Fixtures",         url: "/fixtures",            icon: Handshake },
        { title: "Cargo Positions",  url: "/cargo-positions",     icon: Package },
        { title: "Tenders",          url: "/tenders",             icon: Gavel,     badge: b.tenders },
        { title: "Nominations",      url: "/nominations",         icon: UserCheck, badge: b.nominations },
        { title: "Market Data",      url: "/market-data",         icon: TrendingUp },
      ],
    },
    {
      label: "Commercial",
      items: [
        { title: "Proformas",        url: "/proformas",           icon: FileText },
        { title: "Final DA",         url: "/final-da",            icon: BarChart3 },
        { title: "Invoices",         url: "/invoices",            icon: Receipt },
        { title: "Port Benchmarking",url: "/port-benchmarking",   icon: Scale },
        { title: "Exchange Rates",   url: "/market-data",         icon: DollarSign },
      ],
    },
    {
      label: "Communication",
      items: [
        { title: "Messages",         url: "/messages",            icon: MessageSquare, badge: b.messages },
        { title: "Team Chat",        url: "/team-chat",           icon: MessageCircle },
        { title: "Email Inbox",      url: "/email-inbox",         icon: Mail,          badge: b.emails },
        { title: "Forum",            url: "/forum",               icon: MessagesSquare },
      ],
    },
    {
      label: "Other",
      items: [
        { title: "Directory",        url: "/directory",           icon: Building2 },
        { title: "Service Requests", url: "/service-requests",    icon: Wrench },
        { title: "Sanctions Check",  url: "/sanctions-check",     icon: ShieldAlert },
        { title: "Reports",          url: "/reports",             icon: PieChart },
        { title: "Settings",         url: "/settings",            icon: Settings },
      ],
    },
  ];
}

function brokerGroups(b: BadgeCounts): NavGroup[] {
  return [
    {
      label: "Chartering",
      items: [
        { title: "Dashboard",        url: "/",                    icon: LayoutDashboard },
        { title: "Fixtures",         url: "/fixtures",            icon: Handshake },
        { title: "Cargo Positions",  url: "/cargo-positions",     icon: Package },
        { title: "Tenders",          url: "/tenders",             icon: Gavel,     badge: b.tenders },
        { title: "Nominations",      url: "/nominations",         icon: UserCheck, badge: b.nominations },
        { title: "Laytime",          url: "/fixtures",            icon: Scale },
      ],
    },
    {
      label: "Fleet & Vessel",
      items: [
        { title: "Vessels",          url: "/vessels",             icon: Ship },
        { title: "Fleet Tracking",   url: "/vessel-track",        icon: MapPin },
        { title: "Bunker Management",url: "/bunker-management",   icon: Fuel },
        { title: "Certificates",     url: "/vessel-certificates", icon: FileCheck },
        { title: "Compliance",       url: "/compliance",          icon: ShieldCheck },
      ],
    },
    {
      label: "Voyages",
      items: [
        { title: "Voyages",          url: "/voyages",             icon: Navigation },
        { title: "SOF Records",      url: "/voyages",             icon: ClipboardList },
        { title: "Voyage Expenses",  url: "/voyages",             icon: Wallet },
        { title: "Proformas",        url: "/proformas",           icon: FileText },
        { title: "Final DA",         url: "/final-da",            icon: BarChart3 },
        { title: "Invoices",         url: "/invoices",            icon: Receipt },
      ],
    },
    {
      label: "Market",
      items: [
        { title: "Market Data",      url: "/market-data",         icon: TrendingUp },
        { title: "Port Benchmarking",url: "/port-benchmarking",   icon: Scale },
        { title: "Exchange Rates",   url: "/market-data",         icon: DollarSign },
        { title: "Sanctions Check",  url: "/sanctions-check",     icon: ShieldAlert },
      ],
    },
    {
      label: "Communication",
      items: [
        { title: "Messages",         url: "/messages",            icon: MessageSquare, badge: b.messages },
        { title: "Team Chat",        url: "/team-chat",           icon: MessageCircle },
        { title: "Email Inbox",      url: "/email-inbox",         icon: Mail,          badge: b.emails },
        { title: "Forum",            url: "/forum",               icon: MessagesSquare },
        { title: "Directory",        url: "/directory",           icon: Building2 },
      ],
    },
    {
      label: "Other",
      items: [
        { title: "Service Requests", url: "/service-requests",    icon: Wrench },
        { title: "Reports",          url: "/reports",             icon: PieChart },
        { title: "Settings",         url: "/settings",            icon: Settings },
      ],
    },
  ];
}

function providerGroups(b: BadgeCounts): NavGroup[] {
  return [
    {
      label: "Services",
      items: [
        { title: "Dashboard",        url: "/",                    icon: LayoutDashboard },
        { title: "Service Requests", url: "/service-requests",    icon: Wrench, badge: b.tenders },
        { title: "Tenders",          url: "/tenders",             icon: Gavel },
        { title: "Service Ports",    url: "/service-ports",       icon: Anchor },
      ],
    },
    {
      label: "Finance",
      items: [
        { title: "Invoices",         url: "/invoices",            icon: Receipt },
        { title: "Exchange Rates",   url: "/market-data",         icon: DollarSign },
      ],
    },
    {
      label: "Communication",
      items: [
        { title: "Messages",         url: "/messages",            icon: MessageSquare, badge: b.messages },
        { title: "Team Chat",        url: "/team-chat",           icon: MessageCircle },
        { title: "Forum",            url: "/forum",               icon: MessagesSquare },
      ],
    },
    {
      label: "Other",
      items: [
        { title: "Directory",        url: "/directory",           icon: Building2 },
        { title: "Reports",          url: "/reports",             icon: PieChart },
        { title: "Settings",         url: "/settings",            icon: Settings },
      ],
    },
  ];
}

function adminOnlyGroups(): NavGroup[] {
  return [
    {
      label: "Administration",
      items: [
        { title: "Admin Dashboard",  url: "/",                    icon: LayoutDashboard },
        { title: "Users",            url: "/admin",               icon: Users },
        { title: "Organizations",    url: "/organization",        icon: Building2 },
        { title: "Audit Logs",       url: "/admin",               icon: Activity },
      ],
    },
    {
      label: "Tariffs",
      items: [
        { title: "Port Tariffs",     url: "/tariff-management",   icon: Layers },
        { title: "Port Benchmarking",url: "/port-benchmarking",   icon: Scale },
      ],
    },
    {
      label: "Content",
      items: [
        { title: "Forum Management", url: "/forum",               icon: MessagesSquare },
        { title: "Directory",        url: "/directory",           icon: Building2 },
      ],
    },
    {
      label: "System",
      items: [
        { title: "Market Data",      url: "/market-data",         icon: TrendingUp },
        { title: "Reports",          url: "/reports",             icon: PieChart },
        { title: "Settings",         url: "/settings",            icon: Settings },
      ],
    },
  ];
}

function getNavGroups(role: AppRole, isAdmin: boolean, activeRole: AppRole | undefined, badges: BadgeCounts): NavGroup[] {
  if (isAdmin) {
    const adminGroups = adminOnlyGroups();
    const viewRole = activeRole || "ship_agent";
    let roleGroups: NavGroup[] = [];
    if (viewRole === "ship_agent") roleGroups = agentGroups(badges);
    else if (viewRole === "shipowner") roleGroups = shipownerGroups(badges);
    else if (viewRole === "ship_broker") roleGroups = brokerGroups(badges);
    else if (viewRole === "ship_provider") roleGroups = providerGroups(badges);
    return [...adminGroups, ...roleGroups];
  }
  if (role === "ship_agent") return agentGroups(badges);
  if (role === "shipowner") return shipownerGroups(badges);
  if (role === "ship_broker") return brokerGroups(badges);
  if (role === "ship_provider") return providerGroups(badges);
  return agentGroups(badges);
}

function NavGroupSection({ group, isActive }: { group: NavGroup; isActive: (url: string) => boolean }) {
  if (group.items.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-sidebar-foreground/40">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item, idx) => {
            const active = isActive(item.url);
            const hasBadge = (item.badge ?? 0) > 0;
            return (
              <SidebarMenuItem key={`${item.url}-${idx}`}>
                <SidebarMenuButton asChild data-active={active} tooltip={item.title}>
                  <Link
                    href={item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    style={
                      active
                        ? {
                            borderLeft: "3px solid hsl(var(--sidebar-primary))",
                            background: "hsl(var(--sidebar-primary) / 0.12)",
                            color: "hsl(var(--sidebar-primary))",
                            paddingLeft: "calc(0.75rem - 3px)",
                          }
                        : {}
                    }
                    className="transition-all duration-150"
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium flex-1">{item.title}</span>
                    {hasBadge && (
                      <span className="ml-auto flex-shrink-0 min-w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { lang, setLang } = useLanguage();
  const { user, role, userRole, isAdmin } = useAuth();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";

  const activeRole = (user as any)?.activeRole as AppRole | undefined;
  const plan = (user as any)?.subscriptionPlan || "free";

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const userDisplayName = user?.firstName
    ? `${user.firstName} ${(user as any).lastName || ""}`.trim()
    : "User";

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const res = await apiRequest("PATCH", "/api/admin/active-role", { activeRole: newRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const { data: tenderBadge } = useQuery<{ count: number }>({ queryKey: ["/api/tenders/badge-count"], refetchInterval: 60000 });
  const { data: msgBadge }    = useQuery<{ count: number }>({ queryKey: ["/api/messages/unread-count"], refetchInterval: 30000 });
  const { data: emailBadge }  = useQuery<{ count: number }>({ queryKey: ["/api/email/inbox/count"], refetchInterval: 30000 });
  const { data: nomBadge }    = useQuery<{ count: number }>({
    queryKey: ["/api/nominations/pending-count"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    enabled: role === "ship_agent" || isAdmin,
  });

  const badges: BadgeCounts = {
    tenders:     tenderBadge?.count || 0,
    messages:    msgBadge?.count    || 0,
    emails:      emailBadge?.count  || 0,
    nominations: nomBadge?.count    || 0,
  };

  const { data: myOrgs = [] } = useQuery<any[]>({ queryKey: ["/api/organizations/my"], refetchInterval: 120000 });
  const activeOrgId = (user as any)?.activeOrganizationId;
  const activeOrg = myOrgs.find((o: any) => o.id === activeOrgId) || myOrgs[0];

  const navGroups = getNavGroups(role, isAdmin, activeRole, badges);

  function isActive(url: string) {
    if (url === "/") return location === "/";
    return location === url || location.startsWith(url + "/");
  }

  const roleBadge = ROLE_BADGE[userRole || "shipowner"] || ROLE_BADGE.shipowner;
  const viewingAs = isAdmin && activeRole ? ROLE_BADGE[activeRole] : null;

  return (
    <Sidebar collapsible="icon" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {/* ── Header ── */}
      <SidebarHeader className={`border-b border-sidebar-border/60 ${isCollapsed ? "px-1 py-3" : "px-4 py-5"}`}>
        <Link href="/" className={`flex items-center hover:opacity-80 transition-opacity ${isCollapsed ? "justify-center" : "gap-3 overflow-hidden"}`}>
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="font-serif font-bold text-sm tracking-tight truncate text-sidebar-foreground">VesselPDA</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/45 truncate mt-0.5">Maritime Platform</p>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-3">
        {/* Organization indicator */}
        {activeOrg && (
          <Link href="/organization-select">
            <div
              className={`mx-2 mb-1 rounded-lg border border-sidebar-border/40 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 transition-colors cursor-pointer ${isCollapsed ? "p-1.5 flex justify-center" : "p-2"}`}
              data-testid="sidebar-org-indicator"
            >
              {isCollapsed ? (
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0" title={activeOrg.name}>
                  {activeOrg.logo_url
                    ? <img src={activeOrg.logo_url} alt={activeOrg.name} className="w-5 h-5 rounded object-contain" />
                    : <Building2 className="w-3.5 h-3.5 text-primary" />}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {activeOrg.logo_url
                      ? <img src={activeOrg.logo_url} alt={activeOrg.name} className="w-6 h-6 rounded object-contain" />
                      : <Building2 className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-sidebar-foreground truncate">{activeOrg.name}</p>
                    <p className="text-[9px] text-sidebar-foreground/40 uppercase tracking-wider">
                      {myOrgs.length > 1 ? `${myOrgs.length} orgs · switch` : "Active Organization"}
                    </p>
                  </div>
                  <ChevronDown className="w-3 h-3 text-sidebar-foreground/40 flex-shrink-0" />
                </div>
              )}
            </div>
          </Link>
        )}

        {/* Admin role switcher */}
        {isAdmin && !isCollapsed && (
          <div className="mx-3 mb-2 rounded-lg border border-red-500/20 bg-red-500/8 p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3 h-3 text-red-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">Admin — View As</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {ADMIN_ROLE_OPTIONS.map((opt) => {
                const active = (activeRole || "ship_agent") === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => switchRoleMutation.mutate(opt.value)}
                    disabled={switchRoleMutation.isPending}
                    data-testid={`sidebar-role-${opt.value}`}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      active
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border border-transparent"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Nav groups */}
        {navGroups.map((group) => (
          <NavGroupSection key={group.label} group={group} isActive={isActive} />
        ))}
      </SidebarContent>

      {/* ── Footer ── */}
      <SidebarFooter className={`border-t border-sidebar-border/60 ${isCollapsed ? "p-1" : "p-3"}`}>
        {/* Language toggle */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 mb-2">
            <Languages className="w-3.5 h-3.5 text-sidebar-foreground/40" />
            <div className="flex rounded-md border border-sidebar-border/60 text-[11px] overflow-hidden">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 font-medium transition-colors ${lang === "en" ? "bg-[hsl(var(--maritime-primary))] text-white" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40"}`}
                data-testid="button-lang-en"
              >EN</button>
              <button
                onClick={() => setLang("tr")}
                className={`px-2.5 py-1 font-medium transition-colors ${lang === "tr" ? "bg-[hsl(var(--maritime-primary))] text-white" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40"}`}
                data-testid="button-lang-tr"
              >TR</button>
            </div>
          </div>
        )}

        {/* User profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="button-user-menu"
              className={`flex items-center rounded-lg hover:bg-sidebar-accent/60 transition-colors ${
                isCollapsed ? "w-full justify-center py-1.5" : "w-full gap-3 px-2 py-2 text-left"
              }`}
            >
              <Avatar className="w-8 h-8 ring-2 ring-sidebar-primary/20 flex-shrink-0">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-sidebar-foreground">{userDisplayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${roleBadge.className}`}>
                        {roleBadge.label}
                      </span>
                      {viewingAs && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${viewingAs.className}`}>
                          ↗ {viewingAs.label}
                        </span>
                      )}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${PLAN_BADGE[plan] || PLAN_BADGE.free}`}>
                        {plan}
                      </span>
                    </div>
                  </div>
                  <ChevronUp className="w-3.5 h-3.5 text-sidebar-foreground/40 flex-shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-semibold truncate">{userDisplayName}</p>
              <p className="text-xs text-muted-foreground truncate">{(user as any)?.email}</p>
              <div className="mt-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${roleBadge.className}`}>
                  {roleBadge.label}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-settings">
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="menu-company-profile">
              <Link href="/company-profile" className="flex items-center gap-2 cursor-pointer">
                <Building2 className="w-4 h-4" />Company Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="menu-organization">
              <Link href="/organization" className="flex items-center gap-2 cursor-pointer">
                <Users className="w-4 h-4" />Organization
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="menu-pricing">
              <Link href="/pricing" className="flex items-center gap-2 cursor-pointer">
                <Crown className="w-4 h-4" />Pricing
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild data-testid="menu-admin">
                  <Link href="/admin" className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500">
                    <Shield className="w-4 h-4" />Admin Panel
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-logout">
              <a href="/api/logout" className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500">
                <LogOut className="w-4 h-4" />Sign Out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
