import { Ship, FileText, Globe, LogOut, LayoutDashboard, Building2, Users, Crown, MapPin, Shield, ChevronDown, MessageSquare, Anchor, Gavel, Navigation } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  const { user } = useAuth();
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || "agent";
  const plan = (user as any)?.subscriptionPlan || "free";

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const mainNav = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Directory", url: "/directory", icon: Users },
    { title: "Forum", url: "/forum", icon: MessageSquare },
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

  const toolsNav = [];
  if (isAdminUser || effectiveRole !== "provider") {
    toolsNav.push({ title: "Vessels", url: "/vessels", icon: Ship });
    toolsNav.push({ title: "Proformas", url: "/proformas", icon: FileText });
  }
  if (isAdminUser || effectiveRole !== "provider") {
    toolsNav.push({ title: "Tenders", url: "/tenders", icon: Gavel, badge: tenderCount });
  }
  if (isAdminUser || effectiveRole !== "provider") {
    toolsNav.push({ title: "Vessel Track", url: "/vessel-track", icon: Navigation });
  }
  toolsNav.push({ title: "Port Info", url: "/port-info", icon: Anchor });
  if (isAdminUser || effectiveRole === "agent" || effectiveRole === "provider") {
    toolsNav.push({ title: "My Profile", url: "/company-profile", icon: Building2 });
  }

  const adminNav = isAdminUser ? [
    { title: "Admin Panel", url: "/admin", icon: Shield },
  ] : [];

  const roleLabel = isAdminUser
    ? ACTIVE_ROLE_OPTIONS.find(r => r.value === activeRole)?.label || "Admin"
    : effectiveRole === "agent" ? "Ship Agent" : effectiveRole === "provider" ? "Provider" : "Shipowner";

  function isActive(url: string) {
    if (url === "/") return location === "/";
    return location === url || location.startsWith(url + "/");
  }

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border/60">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-serif font-bold text-sm tracking-tight truncate text-sidebar-foreground">VesselPDA</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/45 truncate mt-0.5">Maritime Platform</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="py-3">
        {/* Admin Role Switcher — pinned at top of sidebar content */}
        {isAdminUser && (
          <div className="mx-3 mb-1 rounded-lg border border-red-500/20 bg-red-500/8 p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3 h-3 text-red-400" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-red-400">Admin — Role View</span>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {ACTIVE_ROLE_OPTIONS.map((opt) => {
                const isActive = activeRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => switchRoleMutation.mutate(opt.value)}
                    disabled={switchRoleMutation.isPending}
                    data-testid={`sidebar-role-${opt.value}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                      isActive
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border border-transparent"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
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
                    <SidebarMenuButton
                      asChild
                      data-active={active}
                    >
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
                      <SidebarMenuButton
                        asChild
                        data-active={active}
                      >
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
                      <SidebarMenuButton
                        asChild
                        data-active={active}
                      >
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

        {/* Account Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 text-sidebar-foreground/40">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={isActive("/service-ports")}>
                  <Link
                    href="/service-ports"
                    data-testid="nav-service-ports"
                    style={isActive("/service-ports") ? {
                      borderLeft: "3px solid hsl(var(--sidebar-primary))",
                      background: "hsl(var(--sidebar-primary) / 0.12)",
                      color: "hsl(var(--sidebar-primary))",
                      paddingLeft: "calc(0.75rem - 3px)",
                    } : {}}
                    className="transition-all duration-150"
                  >
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">Service Ports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={isActive("/pricing")}>
                  <Link
                    href="/pricing"
                    data-testid="nav-pricing"
                    style={isActive("/pricing") ? {
                      borderLeft: "3px solid hsl(var(--sidebar-primary))",
                      background: "hsl(var(--sidebar-primary) / 0.12)",
                      color: "hsl(var(--sidebar-primary))",
                      paddingLeft: "calc(0.75rem - 3px)",
                    } : {}}
                    className="transition-all duration-150"
                  >
                    <Crown className="w-4 h-4" />
                    <span className="font-medium">Pricing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border/60 p-4 space-y-3">
        {/* Admin role switcher */}
        {isAdminUser && (
          <div>
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

        {/* User info */}
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 ring-2 ring-sidebar-primary/20 flex-shrink-0">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))] text-xs font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-sidebar-foreground">
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "User"}
            </p>
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
          <a
            href="/api/logout"
            data-testid="button-logout"
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-500/10 transition-colors group"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/40 group-hover:text-red-400 transition-colors" />
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
