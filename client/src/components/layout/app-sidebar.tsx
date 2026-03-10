import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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
import { useSidebarState } from "@/lib/sidebar-context";

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

type BadgeCounts = ReturnType<typeof useBadgeCounts>;

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

function SecondaryIconButton({
  item,
  badgeCounts,
  expanded,
}: {
  item: NavSecondaryItem;
  badgeCounts: BadgeCounts;
  expanded: boolean;
}) {
  const [location] = useLocation();
  const Icon = item.icon;
  const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url + "/"));
  const badgeCount = item.badge && item.badge !== "certs" ? badgeCounts[item.badge as keyof BadgeCounts] || 0 : 0;

  const iconBtn = (
    <Link href={item.url}>
      <div
        data-testid={`secondary-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
        className={cn(
          "relative flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer flex-shrink-0",
          expanded ? "w-full gap-2 px-2 py-1.5" : "w-9 h-9",
          isActive
            ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        {expanded && <span className="text-sm truncate flex-1">{item.label}</span>}
        {badgeCount > 0 && (
          <span className={cn(
            "flex items-center justify-center rounded-full bg-sky-500 text-white text-[8px] font-bold",
            expanded ? "min-w-[18px] h-[18px] px-1" : "absolute -top-0.5 -right-0.5 w-3.5 h-3.5"
          )}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </div>
    </Link>
  );

  if (expanded) return iconBtn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{iconBtn}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function AppSidebar({ userRole = "shipowner", isAdmin = false }: AppSidebarProps) {
  const [location] = useLocation();
  const { isCollapsed, setIsCollapsed } = useSidebarState();
  const [isHovered, setIsHovered] = useState(false);
  const badgeCounts = useBadgeCounts();

  const activeKey = urlToCategory(location);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set([activeKey]));

  const visibleMain = getVisibleMainItems(userRole);
  const visibleSettings = getVisibleSettingsItems(userRole);

  const isExpanded = !isCollapsed || isHovered;
  const isOverlay = isCollapsed && isHovered;

  useEffect(() => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.add(activeKey);
      return next;
    });
  }, [activeKey]);

  function isChildActive(url: string): boolean {
    if (url === "/proformas/new") return location === url;
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  }

  function toggleKey(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderMainItem(item: ReturnType<typeof getVisibleMainItems>[0]) {
    const Icon = item.icon;
    const hasChildren = item.children && item.children.length > 0;
    const isItemActive = activeKey === item.key;
    const isOpen = openKeys.has(item.key);
    const filteredChildren = hasChildren ? getFilteredChildren(userRole, item) : [];

    if (!isExpanded) {
      const firstChildUrl = filteredChildren[0]?.url || item.url;
      return (
        <Tooltip key={item.key}>
          <TooltipTrigger asChild>
            <Link href={firstChildUrl}>
              <div
                className={cn(
                  "flex items-center justify-center p-2.5 rounded-lg my-0.5 transition-all duration-150 cursor-pointer",
                  isItemActive
                    ? "bg-sky-500/15 text-sky-400"
                    : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                )}
                data-testid={`nav-${item.key}`}
              >
                <Icon className="w-5 h-5" />
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
        </Tooltip>
      );
    }

    if (!hasChildren || filteredChildren.length === 0) {
      return (
        <Link key={item.key} href={item.url}>
          <div
            className={cn(
              "flex items-center gap-2 px-2 py-2 rounded-lg my-0.5 text-sm font-medium transition-all duration-150 cursor-pointer",
              isItemActive
                ? "bg-sky-500/10 text-sky-400"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            )}
            data-testid={`nav-${item.key}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        </Link>
      );
    }

    const childBadgeTotal = filteredChildren.reduce((sum, c) => {
      if (!c.badge || c.badge === "certs") return sum;
      return sum + (badgeCounts[c.badge as keyof BadgeCounts] || 0);
    }, 0);
    const hasCertWarn = filteredChildren.some((c) => c.badge === "certs" && badgeCounts.certs > 0);

    return (
      <Collapsible
        key={item.key}
        open={isOpen}
        onOpenChange={() => toggleKey(item.key)}
        className="group/collapsible"
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center justify-between px-2 py-2 rounded-lg my-0.5 text-sm font-medium transition-all duration-150 cursor-pointer",
              isItemActive && !isOpen
                ? "bg-sky-500/10 text-sky-400"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            )}
            data-testid={`nav-${item.key}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isOpen && childBadgeTotal > 0 && <BadgeDot count={childBadgeTotal} />}
              {!isOpen && hasCertWarn && <BadgeDot warn />}
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="ml-3 pl-2 border-l border-slate-700/30 mt-0.5 mb-1 space-y-0.5">
            {filteredChildren.map((child) => {
              const ChildIcon = child.icon;
              const active = isChildActive(child.url);
              const childBadgeCount =
                child.badge && child.badge !== "certs"
                  ? (badgeCounts[child.badge as keyof BadgeCounts] as number) || 0
                  : 0;
              const certWarn = child.badge === "certs" && badgeCounts.certs > 0;
              return (
                <Link key={child.url} href={child.url}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all duration-150 cursor-pointer",
                      active
                        ? "text-sky-400 bg-sky-500/10"
                        : "text-slate-400 hover:bg-slate-800/30 hover:text-slate-200"
                    )}
                  >
                    <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 truncate">{child.label}</span>
                    {childBadgeCount > 0 && <BadgeDot count={childBadgeCount} />}
                    {certWarn && <BadgeDot warn />}
                    {child.isNew && <NewBadge />}
                    {child.isPro && <ProBadge />}
                  </div>
                </Link>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const sidebarContent = (
    <>
      {/* Header / Logo */}
      <div className="px-3 py-3 border-b border-slate-700/20 flex-shrink-0">
        <Link href="/dashboard">
          <div className="flex items-center gap-2 cursor-pointer group" data-testid="sidebar-logo">
            <div className="w-7 h-7 rounded-md bg-sky-500 flex items-center justify-center flex-shrink-0 group-hover:bg-sky-400 transition-colors">
              <span className="text-white text-xs font-bold">V</span>
            </div>
            {isExpanded && (
              <span className="text-white font-bold text-sm tracking-tight">VesselPDA</span>
            )}
          </div>
        </Link>
      </div>

      {/* Main navigation */}
      <div className="flex-1 overflow-y-auto sidebar-scroll px-2 py-2">
        {visibleMain.map((item) => renderMainItem(item))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-700/20 px-2 pt-2 pb-2 flex-shrink-0 space-y-1">
        {/* Secondary icons */}
        <div className={cn("flex gap-1", isExpanded ? "flex-col" : "flex-col items-center")}>
          {NAV_STRUCTURE.secondary.map((item) => (
            <SecondaryIconButton
              key={item.url}
              item={item}
              badgeCounts={badgeCounts}
              expanded={isExpanded}
            />
          ))}
        </div>

        <div className="w-full h-px bg-slate-700/30 my-1" />

        {/* Settings items */}
        <div className="space-y-0.5">
          {visibleSettings.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.url || location.startsWith(item.url + "/");

            if (!isExpanded) {
              return (
                <Tooltip key={item.url}>
                  <TooltipTrigger asChild>
                    <Link href={item.url}>
                      <div
                        className={cn(
                          "w-full flex items-center justify-center p-2.5 rounded-lg transition-all duration-150 cursor-pointer",
                          isActive
                            ? "bg-sky-500/15 text-sky-400"
                            : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                        )}
                        data-testid={`nav-settings-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link key={item.url} href={item.url}>
                <div
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all duration-150 cursor-pointer",
                    isActive
                      ? "bg-sky-500/10 text-sky-400"
                      : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                  )}
                  data-testid={`nav-settings-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="w-full h-px bg-slate-700/30 my-1" />

        {/* Collapse toggle */}
        <button
          onClick={() => {
            setIsCollapsed(!isCollapsed);
            setIsHovered(false);
          }}
          data-testid="button-sidebar-collapse"
          className="w-full flex items-center justify-center gap-2 px-2 py-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all duration-150 text-xs"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isExpanded ? (
            <>
              <PanelLeftClose className="w-4 h-4" />
              {!isOverlay && <span>Collapse</span>}
            </>
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <>
        {/* Spacer — keeps space in flex layout */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300",
            isCollapsed ? "w-16" : "w-60"
          )}
          aria-hidden="true"
        />

        {/* Actual sidebar panel — always absolute so hover can expand without shifting content */}
        <aside
          className={cn(
            "absolute left-0 top-0 h-full z-40 flex flex-col bg-[#080c18] border-r border-slate-700/30 transition-all duration-300",
            isExpanded ? "w-60" : "w-16",
            isOverlay && "shadow-2xl z-50"
          )}
          onMouseEnter={() => isCollapsed && setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {sidebarContent}
        </aside>
      </>
    </TooltipProvider>
  );
}
