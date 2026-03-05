import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getCategoryByKey } from "@/lib/nav-categories";

interface SidebarPanelProps {
  activeCategory: string;
}

export function SidebarPanel({ activeCategory }: SidebarPanelProps) {
  const [location] = useLocation();
  const category = getCategoryByKey(activeCategory);

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

  const { data: voyageInviteBadge } = useQuery<{ count: number }>({
    queryKey: ["/api/my-voyage-invitations/count"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const badgeCounts: Record<string, number> = {
    messages: msgBadge?.count || 0,
    nominations: nomBadge?.count || 0,
    tenders: tenderBadge?.count || 0,
    voyageInvites: voyageInviteBadge?.count || 0,
  };
  const hasExpiring = (certExpiring?.length || 0) > 0;

  if (!category) return null;

  const CategoryIcon = category.icon;

  function isPageActive(url: string, exact?: boolean): boolean {
    if (exact) return location === url;
    if (url === "/proformas/new") return location === url;
    return location === url || (url !== "/" && location.startsWith(url + "/"));
  }

  const isAmberCategory = category.color === "amber";

  return (
    <aside className="w-48 flex-shrink-0 bg-[#0a0e1a] border-r border-slate-700/30 hidden md:flex flex-col overflow-y-auto">
      {/* Category header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <CategoryIcon
          className={`w-4 h-4 flex-shrink-0 ${isAmberCategory ? "text-amber-400" : "text-slate-400"}`}
        />
        <span
          className={`text-xs uppercase tracking-wider font-semibold ${isAmberCategory ? "text-amber-400" : "text-slate-400"}`}
        >
          {category.label}
        </span>
      </div>

      {/* Sub-pages */}
      <nav className="flex-1 px-2 pb-3 space-y-0.5">
        {category.subPages.map((page) => {
          const PageIcon = page.icon;
          const active = isPageActive(page.url, page.exact);
          const badgeCount = page.badge && page.badge !== "certs" ? badgeCounts[page.badge] || 0 : 0;
          const showCertWarning = page.badge === "certs" && hasExpiring;

          return (
            <Link
              key={`${page.url}-${page.label}`}
              href={page.url}
            >
              <div
                data-testid={`subnav-${page.label.toLowerCase().replace(/[\s/()]+/g, "-").replace(/-+$/, "")}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? isAmberCategory
                      ? "bg-amber-500/10 text-amber-400 border-r-2 border-amber-400"
                      : "bg-sky-500/10 text-sky-400 border-r-2 border-sky-400"
                    : "text-slate-400 hover:bg-slate-800/30 hover:text-white"
                }`}
              >
                <PageIcon className="w-4 h-4 flex-shrink-0 shrink-0" />
                <span className="flex-1 truncate">{page.label}</span>

                {/* Count badge */}
                {badgeCount > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-bold">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}

                {/* Cert warning badge */}
                {showCertWarning && (
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                    !
                  </span>
                )}

                {/* NEW badge */}
                {page.isNew && (
                  <span className="flex-shrink-0 text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold leading-none">
                    NEW
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
