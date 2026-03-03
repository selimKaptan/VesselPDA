import {
  Ship, FileText, LogOut, LayoutDashboard, Building2, Crown, MapPin, Shield,
  ChevronDown, MessageSquare, MessagesSquare, MessageCircle, Anchor, Gavel, Navigation, Languages,
  Settings, ChevronUp, Users, Wrench, UserCheck, ShieldAlert, Handshake, Package,
  TrendingUp, BarChart3, Receipt, FileCheck, Star, Fuel,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
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

const ACTIVE_ROLE_OPTIONS = [
  { value: "agent", label: "Ship Agent" },
  { value: "shipowner", label: "Shipowner / Broker" },
  { value: "provider", label: "Service Provider" },
];

const PLAN_BADGE: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  standard: "bg-[hsl(var(--maritime-gold)/0.15)] text-[hsl(var(--maritime-gold))]",
  unlimited: "bg-[hsl(var(--maritime-primary)/0.15)] text-[hsl(var(--maritime-primary))]",
};

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

function NavGroupSection({
  group,
  isActive,
}: {
  group: NavGroup;
  isActive: (url: string) => boolean;
}) {
  if (group.items.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-sidebar-foreground/40">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const active = isActive(item.url);
            const hasBadge = (item.badge ?? 0) > 0;
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild data-active={active} tooltip={item.title}>
                  <Link
                    href={item.url}
                    data-testid={`nav-${item.url.replace(/\//g, "").replace(/-/g, "-") || "home"}`}
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
  const { user } = useAuth();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";

  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || "agent";
  const plan = (user as any)?.subscriptionPlan || "free";
  const isAdminUser = userRole === "admin";
  const effectiveRole = isAdminUser ? activeRole : userRole;
  const isAgent = effectiveRole === "agent";
  const isProvider = effectiveRole === "provider";
  const isShipowner = effectiveRole === "shipowner" || effectiveRole === "broker";

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const switchRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const res = await apiRequest("PATCH", "/api/admin/active-role", { activeRole: newRole });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });

  const { data: tenderBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/tenders/badge-count"],
    refetchInterval: 60000,
  });
  const tenderCount = tenderBadge?.count || 0;

  const { data: msgBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
  });
  const unreadMessages = msgBadge?.count || 0;

  const { data: myOrgs = [] } = useQuery<any[]>({
    queryKey: ["/api/organizations/my"],
    refetchInterval: 120000,
  });
  const activeOrgId = (user as any)?.activeOrganizationId;
  const activeOrg = myOrgs.find((o: any) => o.id === activeOrgId) || myOrgs[0];

  const { data: nomBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/nominations/pending-count"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    enabled: isAgent,
  });
  const pendingNominations = nomBadge?.count || 0;

  // ── Group visibility helpers ──────────────────────────────────────────────
  const canSeeAll = isAdminUser || isShipowner || isAgent;

  // ── OPERATIONS ────────────────────────────────────────────────────────────
  const operationsGroup: NavGroup = {
    label: "Operations",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Vessels", url: "/vessels", icon: Ship },
      { title: "Voyages", url: "/voyages", icon: Navigation },
      { title: "Bunker", url: "/bunker-management", icon: Fuel },
      { title: "Vessel Track", url: "/vessel-track", icon: MapPin },
      { title: "Port Info", url: "/port-info", icon: Anchor },
      { title: "Vessel Certificates", url: "/vessel-certificates", icon: FileCheck },
    ],
  };

  // ── COMMERCIAL ────────────────────────────────────────────────────────────
  const commercialItems: NavItem[] = [
    { title: "Proformas", url: "/proformas", icon: FileText },
    { title: "Final DA", url: "/final-da", icon: BarChart3 },
  ];
  if (canSeeAll) {
    commercialItems.push({ title: "Invoices", url: "/invoices", icon: Receipt });
  }
  commercialItems.push({ title: "Tenders", url: "/tenders", icon: Gavel, badge: tenderCount });
  if (canSeeAll) {
    commercialItems.push({ title: "Nominations", url: "/nominations", icon: UserCheck, badge: pendingNominations });
  }
  commercialItems.push({ title: "Fixtures", url: "/fixtures", icon: Handshake });
  if (canSeeAll) {
    commercialItems.push({ title: "Cargo Positions", url: "/cargo-positions", icon: Package });
  }
  commercialItems.push({ title: "Market Data", url: "/market-data", icon: TrendingUp });

  const commercialGroup: NavGroup = {
    label: "Commercial",
    items: commercialItems,
  };

  // ── COMMUNICATION ─────────────────────────────────────────────────────────
  const communicationGroup: NavGroup = {
    label: "Communication",
    items: [
      { title: "Messages", url: "/messages", icon: MessageSquare, badge: unreadMessages },
      { title: "Forum", url: "/forum", icon: MessagesSquare },
      { title: "Team Chat", url: "/team-chat", icon: MessageCircle },
      { title: "Service Requests", url: "/service-requests", icon: Wrench },
    ],
  };

  // ── DIRECTORY ─────────────────────────────────────────────────────────────
  const directoryGroup: NavGroup = {
    label: "Directory",
    items: [
      { title: "Directory", url: "/directory", icon: Building2 },
      { title: "Service Ports", url: "/service-ports", icon: Anchor },
      { title: "Sanctions Check", url: "/sanctions-check", icon: ShieldAlert },
    ],
  };

  // ── REPORTS ───────────────────────────────────────────────────────────────
  const reportsGroup: NavGroup = {
    label: "Reports",
    items: canSeeAll ? [{ title: "Reports", url: "/reports", icon: BarChart3 }] : [],
  };

  // ── SETTINGS ─────────────────────────────────────────────────────────────
  const settingsItems: NavItem[] = [
    { title: "Settings", url: "/settings", icon: Settings },
    { title: "Organization", url: "/organization", icon: Building2 },
    { title: "Company Profile", url: "/company-profile", icon: Star },
    { title: "Pricing", url: "/pricing", icon: Crown },
  ];
  if (isAdminUser) {
    settingsItems.push({ title: "Admin Panel", url: "/admin", icon: Users });
  }

  // ── COMPANY PANEL ─────────────────────────────────────────────────────
  const hasOrg = myOrgs.length > 0;
  const companyGroup: NavGroup = {
    label: "Company",
    items: hasOrg ? [
      { title: "Company Panel", url: "/organization-dashboard", icon: BarChart3 },
    ] : [],
  };

  const settingsGroup: NavGroup = { label: "Settings", items: settingsItems };

  const allGroups: NavGroup[] = [
    operationsGroup,
    commercialGroup,
    communicationGroup,
    directoryGroup,
    reportsGroup,
    companyGroup,
    settingsGroup,
  ];

  function isActive(url: string) {
    if (url === "/") return location === "/";
    return location === url || location.startsWith(url + "/");
  }

  const roleLabel = isAdminUser
    ? ACTIVE_ROLE_OPTIONS.find((r) => r.value === activeRole)?.label || "Admin"
    : isAgent ? "Ship Agent" : isProvider ? "Provider" : "Shipowner";

  const userDisplayName = user?.firstName
    ? `${user.firstName} ${(user as any).lastName || ""}`.trim()
    : "User";

  return (
    <Sidebar collapsible="icon" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {/* Header */}
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
            <div className={`mx-2 mb-1 rounded-lg border border-sidebar-border/40 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 transition-colors cursor-pointer ${isCollapsed ? "p-1.5 flex justify-center" : "p-2"}`}
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

        {/* Admin Role Switcher — hidden when collapsed */}
        {isAdminUser && !isCollapsed && (
          <div className="mx-3 mb-1 rounded-lg border border-red-500/20 bg-red-500/8 p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3 h-3 text-red-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">Admin — Role View</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {ACTIVE_ROLE_OPTIONS.map((opt) => {
                const active = activeRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => switchRoleMutation.mutate(opt.value)}
                    disabled={switchRoleMutation.isPending}
                    data-testid={`sidebar-role-${opt.value}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                      active
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border border-transparent"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {allGroups.map((group) => (
          <NavGroupSection key={group.label} group={group} isActive={isActive} />
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className={`border-t border-sidebar-border/60 ${isCollapsed ? "p-1" : "p-3"}`}>
        {/* Admin role dropdown — hidden when collapsed */}
        {isAdminUser && !isCollapsed && (
          <div className="mb-2">
            <p className="text-[9px] text-sidebar-foreground/40 mb-1.5 uppercase tracking-widest font-bold px-0.5">View as role</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-sidebar-border/60 text-xs hover:bg-sidebar-accent/60 transition-colors text-sidebar-foreground"
                  data-testid="dropdown-admin-role-switch"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-red-400" />
                    <span className="font-medium">{roleLabel}</span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-sidebar-foreground/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {ACTIVE_ROLE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => switchRoleMutation.mutate(opt.value)}
                    className={activeRole === opt.value ? "bg-muted" : ""}
                    data-testid={`menu-role-${opt.value}`}
                  >
                    {opt.label}
                    {activeRole === opt.value && (
                      <span className="ml-auto text-[hsl(var(--maritime-primary))]">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Language toggle — hidden when collapsed */}
        {!isCollapsed && (
          <div className="flex items-center gap-2 mb-2">
            <Languages className="w-3.5 h-3.5 text-sidebar-foreground/40" />
            <div className="flex rounded-md border border-sidebar-border/60 text-[11px] overflow-hidden">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 font-medium transition-colors ${lang === "en" ? "bg-[hsl(var(--maritime-primary))] text-white" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40"}`}
                data-testid="button-lang-en"
              >
                EN
              </button>
              <button
                onClick={() => setLang("tr")}
                className={`px-2.5 py-1 font-medium transition-colors ${lang === "tr" ? "bg-[hsl(var(--maritime-primary))] text-white" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/40"}`}
                data-testid="button-lang-tr"
              >
                TR
              </button>
            </div>
          </div>
        )}

        {/* User profile dropdown */}
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
                      {isAdminUser && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 uppercase tracking-wide">
                          Admin
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
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-settings">
              <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="menu-company-profile">
              <Link href="/company-profile" className="flex items-center gap-2 cursor-pointer">
                <Building2 className="w-4 h-4" />
                Company Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="menu-pricing">
              <Link href="/pricing" className="flex items-center gap-2 cursor-pointer">
                <Crown className="w-4 h-4" />
                Pricing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="menu-logout">
              <a href="/api/logout" className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500">
                <LogOut className="w-4 h-4" />
                Sign Out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
