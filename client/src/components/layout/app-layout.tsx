import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useMobile } from "@/hooks/use-mobile";
import { TopBar } from "@/components/layout/top-bar";
import { IconRail } from "@/components/layout/icon-rail";
import { SidebarPanel } from "@/components/layout/sidebar-panel";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FlaskConical, ChevronRight } from "lucide-react";
import {
  urlToCategory,
  getCategoryByKey,
  getCurrentPageLabel,
  getVisibleCategories,
  type NavCategory,
} from "@/lib/nav-categories";

function MobileNavSheet({
  open,
  onClose,
  user,
  userRole,
  isAdmin,
  activeCategory,
  onCategoryChange,
}: {
  open: boolean;
  onClose: () => void;
  user: any;
  userRole: string;
  isAdmin: boolean;
  activeCategory: string;
  onCategoryChange: (key: string) => void;
}) {
  const [location] = useLocation();
  const [expandedCat, setExpandedCat] = useState<string>(activeCategory);
  const visibleCats = getVisibleCategories(userRole);

  const name = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "User";
  const initials = `${(user?.firstName || "")[0] || ""}${(user?.lastName || "")[0] || ""}`.toUpperCase() || "U";

  function isPageActive(url: string, exact?: boolean): boolean {
    if (exact || url === "/proformas/new") return location === url;
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col bg-[#0a0e1a] border-r border-slate-700/30">
        {/* User summary */}
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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleCats.map((cat) => {
            const CatIcon = cat.icon;
            const isExpanded = expandedCat === cat.key;
            const isAmber = cat.color === "amber";

            return (
              <div key={cat.key}>
                <button
                  onClick={() => setExpandedCat(isExpanded ? "" : cat.key)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    isAmber ? "text-amber-500" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CatIcon className="w-4 h-4" />
                    {cat.label}
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </button>
                {isExpanded && (
                  <div className="ml-2 mr-2 mb-1">
                    {cat.subPages.map((page) => {
                      const PageIcon = page.icon;
                      const active = isPageActive(page.url, page.exact);
                      return (
                        <Link
                          key={`${page.url}-${page.label}`}
                          href={page.url}
                          onClick={() => { onCategoryChange(cat.key); onClose(); }}
                        >
                          <div
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              active
                                ? "bg-sky-500/10 text-sky-400"
                                : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
                            }`}
                          >
                            <PageIcon className="w-4 h-4 flex-shrink-0" />
                            <span className="flex-1 truncate">{page.label}</span>
                            {page.isNew && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold">
                                NEW
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isMobile = useMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const userRole = (user as any)?.userRole || "shipowner";
  const activeRole = (user as any)?.activeRole;
  const isAdmin = userRole === "admin";
  const effectiveRole = isAdmin && activeRole ? activeRole : userRole;

  const [activeCategory, setActiveCategory] = useState<string>(() => urlToCategory(location));

  // Sync activeCategory when URL changes (back/forward navigation)
  useEffect(() => {
    const cat = urlToCategory(location);
    setActiveCategory(cat);
  }, [location]);

  function handleCategoryChange(key: string) {
    setActiveCategory(key);
    const cat = getCategoryByKey(key);
    if (cat && cat.subPages.length > 0) {
      navigate(cat.subPages[0].url);
    }
  }

  // Breadcrumb
  const categoryLabel = getCategoryByKey(activeCategory)?.label || "";
  const pageLabel = getCurrentPageLabel(location);

  const isDemoUser = (user as any)?.email?.endsWith("@vpda.demo");

  return (
    <SidebarProvider defaultOpen={false}>
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <TopBar user={user} onMenuClick={() => setMobileNavOpen(true)} />

      {/* Demo mode banner */}
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

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop: IconRail + SidebarPanel */}
        <IconRail
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          userRole={effectiveRole}
          isAdmin={isAdmin}
        />
        <SidebarPanel activeCategory={activeCategory} />

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0 bg-[#0B1120]">
          {/* Breadcrumb */}
          {categoryLabel && pageLabel && (
            <div className="flex items-center gap-2 text-xs text-slate-500 px-6 pt-4 pb-0">
              <button
                onClick={() => handleCategoryChange(activeCategory)}
                className="hover:text-slate-300 transition-colors"
              >
                {categoryLabel}
              </button>
              <span>/</span>
              <span className="text-white font-medium">{pageLabel}</span>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile sheet nav */}
      <MobileNavSheet
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        user={user}
        userRole={effectiveRole}
        isAdmin={isAdmin}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <MobileBottomNav />
    </div>
    </SidebarProvider>
  );
}
