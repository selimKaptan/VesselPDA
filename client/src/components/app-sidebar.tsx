import { Ship, FileText, LogOut, LayoutDashboard, Building2, Crown, MapPin, Shield, ChevronDown, MessageSquare, MessageCircle, Anchor, Gavel, Navigation, Languages, Settings, ChevronUp, Users, Wrench } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
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

export function AppSidebar() {
  const [location] = useLocation();
  const { lang, setLang, t } = useLanguage();
  const { user } = useAuth();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === "collapsed";
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || "agent";
  const plan = (user as any)?.subscriptionPlan || "free";

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const mainNav = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.directory"), url: "/directory", icon: Users },
    { title: t("nav.forum"), url: "/forum", icon: MessageSquare },
  ];

  const isAdminUser = userRole === "admin";
  const effectiveRole = isAdminUser ? activeRole : userRole;

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

  const toolsNav: any[] = [];
  if (isAdminUser || effectiveRole !== "provider") {
    toolsNav.push({ title: t("nav.vessels"), url: "/vessels", icon: Ship });
    toolsNav.push({ title: t("nav.proformas"), url: "/proformas", icon: FileText });
  }
  if (isAdminUser || effectiveRole !== "provider") {
    toolsNav.push({ title: t("nav.tenders"), url: "/tenders", icon: Gavel, badge: tenderCount });
  }
  if (isAdminUser || effectiveRole !== "provider") {
    toolsNav.push({ title: t("nav.vesselTrack"), url: "/vessel-track", icon: Navigation });
  }
  if (isAdminUser || effectiveRole === "shipowner" || effectiveRole === "agent") {
    toolsNav.push({ title: "Seferler", url: "/voyages", icon: Ship });
  }
  toolsNav.push({ title: "Hizmet Talepleri", url: "/service-requests", icon: Wrench });
  toolsNav.push({ title: "Mesajlar", url: "/messages", icon: MessageCircle, badge: unreadMessages });
  toolsNav.push({ title: t("nav.portInfo"), url: "/port-info", icon: Anchor });
  toolsNav.push({ title: t("nav.servicePorts"), url: "/service-ports", icon: MapPin });

  const adminNav = isAdminUser ? [
    { title: t("nav.admin"), url: "/admin", icon: Shield },
  ] : [];

  const roleLabel = isAdminUser
    ? ACTIVE_ROLE_OPTIONS.find(r => r.value === activeRole)?.label || "Admin"
    : effectiveRole === "agent" ? "Ship Agent" : effectiveRole === "provider" ? "Provider" : "Shipowner";

  function isActive(url: string) {
    if (url === "/") return location === "/";
    return location === url || location.startsWith(url + "/");
  }

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

        {/* Main Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-sidebar-foreground/40">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={active} tooltip={item.title}>
                      <Link
                        href={item.url}
                        data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        style={active ? {
                          borderLeft: "3px solid hsl(var(--sidebar-primary))",
                          background: "hsl(var(--sidebar-primary) / 0.12)",
                          color: "hsl(var(--sidebar-primary))",
                          paddingLeft: "calc(0.75rem - 3px)",
                        } : {}}
                        className="transition-all duration-150"
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools Nav */}
        {toolsNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-sidebar-foreground/40">
              Tools
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {toolsNav.map((item) => {
                  const active = isActive(item.url);
                  const hasBadge = (item as any).badge > 0;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild data-active={active} tooltip={item.title}>
                        <Link
                          href={item.url}
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          style={active ? {
                            borderLeft: "3px solid hsl(var(--sidebar-primary))",
                            background: "hsl(var(--sidebar-primary) / 0.12)",
                            color: "hsl(var(--sidebar-primary))",
                            paddingLeft: "calc(0.75rem - 3px)",
                          } : {}}
                          className="transition-all duration-150"
                        >
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium flex-1">{item.title}</span>
                          {hasBadge && (
                            <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {(item as any).badge}
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
        )}

        {/* Admin Nav */}
        {adminNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-sidebar-foreground/40">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild data-active={active} tooltip={item.title}>
                        <Link
                          href={item.url}
                          data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          style={active ? {
                            borderLeft: "3px solid hsl(0 84% 35%)",
                            background: "hsl(0 84% 35% / 0.10)",
                            color: "hsl(0 84% 35%)",
                            paddingLeft: "calc(0.75rem - 3px)",
                          } : {}}
                          className="transition-all duration-150"
                        >
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
                    {activeRole === opt.value && <span className="ml-auto text-[hsl(var(--maritime-primary))]">✓</span>}
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
                isCollapsed
                  ? "w-full justify-center py-1.5"
                  : "w-full gap-3 px-2 py-2 text-left"
              }`}
            >
              <Avatar className="w-8 h-8 ring-2 ring-sidebar-primary/20 flex-shrink-0">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] text-xs font-bold">{initials}</AvatarFallback>
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
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-56"
          >
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
