import { Ship, FileText, Anchor, Globe, LogOut, LayoutDashboard, Building2, Users, Crown, MapPin, Shield, ChevronDown, MessageSquare } from "lucide-react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
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

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole || "agent";

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

  const toolsNav = [];
  if (isAdminUser || effectiveRole !== "provider") {
    toolsNav.push({ title: "Vessels", url: "/vessels", icon: Ship });
    toolsNav.push({ title: "Proformas", url: "/proformas", icon: FileText });
  }
  if (isAdminUser || effectiveRole === "agent" || effectiveRole === "provider") {
    toolsNav.push({ title: "My Profile", url: "/company-profile", icon: Building2 });
  }

  const adminNav = isAdminUser ? [
    { title: "Admin Panel", url: "/admin", icon: Shield },
  ] : [];

  const roleLabel = isAdminUser
    ? ACTIVE_ROLE_OPTIONS.find(r => r.value === activeRole)?.label || "Admin"
    : effectiveRole === "agent" ? "Ship Agent" : effectiveRole === "provider" ? "Provider" : "Shipowner";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-primary))] flex items-center justify-center flex-shrink-0">
            <Anchor className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-serif font-bold text-sm tracking-tight truncate">MaritimePDA</p>
            <p className="text-xs text-muted-foreground truncate">Maritime Hub</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {toolsNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {toolsNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {adminNav.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={location === item.url || location.startsWith(item.url)}
                    >
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={location === "/service-ports"}>
                  <Link href="/service-ports" data-testid="nav-service-ports">
                    <MapPin className="w-4 h-4" />
                    <span>Service Ports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={location === "/pricing"}>
                  <Link href="/pricing" data-testid="nav-pricing">
                    <Crown className="w-4 h-4" />
                    <span>Pricing</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {isAdminUser && (
          <div className="px-1">
            <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">View as role</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border text-xs hover:bg-muted/50 transition-colors"
                  data-testid="dropdown-admin-role-switch"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-red-500" />
                    <span>{roleLabel}</span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
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
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-[hsl(var(--maritime-primary))] text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "User"}
            </p>
            <div className="flex items-center gap-1.5">
              {isAdminUser && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-300 text-red-600">Admin</Badge>}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{roleLabel}</Badge>
            </div>
          </div>
          <a href="/api/logout" data-testid="button-logout">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
