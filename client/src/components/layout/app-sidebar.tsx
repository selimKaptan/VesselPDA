import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  NAV_STRUCTURE,
  getVisibleMainItems,
  getFilteredChildren,
  getVisibleSettingsItems,
  urlToCategory,
  type NavChild,
  type NavSecondaryItem,
} from "@/lib/nav-categories";

interface AppSidebarProps {
  userRole?: string;
  isAdmin?: boolean;
}

function useBadgeCounts() {
  const { data: msgBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
  });
  const { data: nomBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/nominations/pending-count"],
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const { data: tenderBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/tenders/badge-count"],
    refetchInterval: 60000,
  });
  const { data: certExpiring } = useQuery<any[]>({
    queryKey: ["/api/certificates/expiring"],
    queryFn: async () => {
      const res = await fetch("/api/certificates/expiring?days=30", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 60000,
  });
  const { data: inviteBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/my-voyage-invitations/count"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  return {
    messages: msgBadge?.count || 0,
    nominations: nomBadge?.count || 0,
    tenders: tenderBadge?.count || 0,
    certs: (certExpiring?.length || 0) > 0 ? 1 : 0,
    voyageInvites: inviteBadge?.count || 0,
  };
}

function BadgeDot({ count, warn }: { count?: number; warn?: boolean }) {
  if (warn) {
    return (
      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold flex-shrink-0">
        !
      </span>
    );
  }
  if (!count || count === 0) return null;
  return (
    <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold flex-shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NewBadge() {
  return (
    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold leading-none flex-shrink-0">
      NEW
    </span>
  );
}

function ProBadge() {
  return (
    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold leading-none border border-amber-500/30 flex-shrink-0">
      PRO
    </span>
  );
}

function ChildItem({
  child,
  isActive,
  badgeCounts,
}: {
  child: NavChild;
  isActive: boolean;
  badgeCounts: ReturnType<typeof useBadgeCounts>;
}) {
  const Icon = child.icon;
  const badgeCount = child.badge && child.badge !== "certs" ? badgeCounts[child.badge] || 0 : 0;
  const certWarn = child.badge === "certs" && badgeCounts.certs > 0;

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={isActive}>
        <Link href={child.url}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 truncate">{child.label}</span>
          {badgeCount > 0 && <BadgeDot count={badgeCount} />}
          {certWarn && <BadgeDot warn />}
          {child.isNew && <NewBadge />}
          {child.isPro && <ProBadge />}
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

function SecondaryIconButton({
  item,
  badgeCounts,
}: {
  item: NavSecondaryItem;
  badgeCounts: ReturnType<typeof useBadgeCounts>;
}) {
  const [location] = useLocation();
  const Icon = item.icon;
  const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"));
  const badgeCount = item.badge && item.badge !== "certs" ? badgeCounts[item.badge] || 0 : 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={item.url}>
          <div
            data-testid={`secondary-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            className={`relative w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0 ${
              isActive
                ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-sky-500 text-white text-[8px] font-bold">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function CollapseToggle() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  return (
    <button
      onClick={toggleSidebar}
      data-testid="button-sidebar-collapse"
      className="w-full flex items-center justify-center gap-2 px-2 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-150 text-xs"
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {isCollapsed ? (
        <PanelLeftOpen className="w-4 h-4" />
      ) : (
        <>
          <PanelLeftClose className="w-4 h-4" />
          <span>Collapse</span>
        </>
      )}
    </button>
  );
}

export function AppSidebar({ userRole = "shipowner", isAdmin = false }: AppSidebarProps) {
  const [location] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const badgeCounts = useBadgeCounts();

  const activeKey = urlToCategory(location);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set([activeKey]));

  const visibleMain = getVisibleMainItems(userRole);
  const visibleSettings = getVisibleSettingsItems(userRole);

  function isChildActive(url: string): boolean {
    if (url === "/proformas/new") return location === url;
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  }

  function toggleKey(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-slate-700/30 bg-[#080c18]">
      {/* Header / Logo */}
      <SidebarHeader className="px-3 py-3 border-b border-slate-700/20">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 cursor-pointer group" data-testid="sidebar-logo">
            <div className="w-7 h-7 rounded-md bg-sky-500 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-400 transition-colors">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            {!isCollapsed && (
              <span className="text-white font-bold text-sm tracking-tight">VesselPDA</span>
            )}
          </div>
        </Link>
      </SidebarHeader>

      {/* Main navigation */}
      <SidebarContent className="overflow-y-auto sidebar-scroll px-2 py-2">
        <SidebarMenu>
          {visibleMain.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isItemActive = activeKey === item.key;
            const isOpen = openKeys.has(item.key);
            const filteredChildren = hasChildren ? getFilteredChildren(userRole, item) : [];

            if (!hasChildren || filteredChildren.length === 0) {
              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isItemActive}
                    tooltip={item.label}
                    data-testid={`nav-${item.key}`}
                  >
                    <Link href={item.url}>
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            const childBadgeTotal = filteredChildren.reduce((sum, c) => {
              if (!c.badge || c.badge === "certs") return sum;
              return sum + (badgeCounts[c.badge] || 0);
            }, 0);
            const hasCertWarn = filteredChildren.some(
              (c) => c.badge === "certs" && badgeCounts.certs > 0
            );

            return (
              <Collapsible
                key={item.key}
                open={isOpen}
                onOpenChange={() => toggleKey(item.key)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isItemActive && !isOpen}
                      tooltip={item.label}
                      data-testid={`nav-${item.key}`}
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!isCollapsed && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!isOpen && childBadgeTotal > 0 && <BadgeDot count={childBadgeTotal} />}
                          {!isOpen && hasCertWarn && <BadgeDot warn />}
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90`}
                          />
                        </div>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {filteredChildren.map((child) => (
                        <ChildItem
                          key={child.url}
                          child={child}
                          isActive={isChildActive(child.url)}
                          badgeCounts={badgeCounts}
                        />
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer: secondary icons + settings + collapse */}
      <SidebarFooter className="border-t border-slate-700/20 px-2 pt-2 pb-2 space-y-1">
        {/* Secondary icons row */}
        <div className={`flex gap-1 ${isCollapsed ? "flex-col items-center" : "flex-row flex-wrap"}`}>
          {NAV_STRUCTURE.secondary.map((item) => (
            <SecondaryIconButton key={item.url} item={item} badgeCounts={badgeCounts} />
          ))}
        </div>

        <SidebarSeparator className="bg-slate-700/30 my-1" />

        {/* Settings items */}
        <SidebarMenu>
          {visibleSettings.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.url || location.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  data-testid={`nav-settings-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Link href={item.url}>
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <SidebarSeparator className="bg-slate-700/30 my-1" />
        <CollapseToggle />
      </SidebarFooter>
    </Sidebar>
  );
}
