import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMobile } from "@/hooks/use-mobile";
import { TopBar } from "@/components/layout/top-bar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FlaskConical, ChevronRight } from "lucide-react";
import {
  urlToCategory,
  getVisibleMainItems,
  getFilteredChildren,
  getCurrentPageLabel,
  getMainItemLabel,
  NAV_STRUCTURE,
} from "@/lib/nav-categories";

function MobileNavSheet({
  open,
  onClose,
  user,
  userRole,
}: {
  open: boolean;
  onClose: () => void;
  user: any;
  userRole: string;
}) {
  const [location] = useLocation();
  const activeKey = urlToCategory(location);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set([activeKey]));
  const visibleMain = getVisibleMainItems(userRole);

  const name = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "User";
  const initials = `${(user?.firstName || "")[0] || ""}${(user?.lastName || "")[0] || ""}`.toUpperCase() || "U";

  function isChildActive(url: string): boolean {
    if (url === "/proformas/new") return location === url;
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  }

  function toggleKey(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col bg-[#080c18] border-r border-slate-700/30">
        <div className="px-4 py-4 border-b border-slate-700/30 flex items-center gap-3">
          <Avatar className="w-9 h-9">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-sky-700 text-white text-sm font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-white truncate">{name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {visibleMain.map((item) => {
            const Icon = item.icon;
            const isExpanded = openKeys.has(item.key);
            const children = getFilteredChildren(userRole, item);
            const isItemActive = activeKey === item.key;

            if (!children.length) {
              return (
                <Link key={item.key} href={item.url} onClick={onClose}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isItemActive ? "bg-sky-500/10 text-sky-400" : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                  }`}>
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            }

            return (
              <Collapsible key={item.key} open={isExpanded} onOpenChange={() => toggleKey(item.key)}>
                <CollapsibleTrigger asChild>
                  <button className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isItemActive && !isExpanded ? "bg-sky-500/10 text-sky-400" : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                  }`}>
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-3 pl-3 border-l border-slate-700/40 mt-0.5 mb-1 space-y-0.5">
                    {children.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isChildActive(child.url);
                      return (
                        <Link key={child.url} href={child.url} onClick={onClose}>
                          <div className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
                            active ? "text-sky-400 bg-sky-500/10" : "text-slate-400 hover:bg-slate-800/30 hover:text-white"
                          }`}>
                            <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{child.label}</span>
                            {child.isNew && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold leading-none">NEW</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          <div className="mt-3 pt-3 border-t border-slate-700/30 space-y-0.5">
            {NAV_STRUCTURE.secondary.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.url} href={item.url} onClick={onClose}>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800/40 hover:text-white transition-colors cursor-pointer">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-0.5">
            {NAV_STRUCTURE.settings.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.url} href={item.url} onClick={onClose}>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800/40 hover:text-white transition-colors cursor-pointer">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

const sidebarStyle = {
  "--sidebar-width": "13.5rem",
  "--sidebar-width-icon": "3.5rem",
} as React.CSSProperties;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const isMobile = useMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole;
  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin && activeRole ? activeRole : userRole;

  const activeKey = urlToCategory(location);
  const categoryLabel = getMainItemLabel(activeKey);
  const pageLabel = getCurrentPageLabel(location);

  const isDemoUser = (user as any)?.email?.endsWith("@vpda.demo");

  return (
    <SidebarProvider style={sidebarStyle} defaultOpen={true}>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex flex-shrink-0">
          <AppSidebar userRole={effectiveRole} isAdmin={isAdmin} />
        </div>

        {/* Right side: top bar + content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar user={user} onMenuClick={() => setMobileNavOpen(true)} />

          {isDemoUser && (
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

          <main key={location} className="flex-1 overflow-auto pb-16 md:pb-0 bg-[#0B1120] page-fade-in">
            {categoryLabel && pageLabel && (
              <div className="flex items-center gap-2 text-xs text-slate-500 px-6 pt-4 pb-0">
                <span className="hover:text-slate-300 transition-colors cursor-default">{categoryLabel}</span>
                <span>/</span>
                <span className="text-white font-medium">{pageLabel}</span>
              </div>
            )}
            {children}
          </main>
        </div>
      </div>

      {/* Mobile: sheet nav + bottom nav */}
      <MobileNavSheet
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        user={user}
        userRole={effectiveRole}
      />
      <MobileBottomNav />
    </SidebarProvider>
  );
}
