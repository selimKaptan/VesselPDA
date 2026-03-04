import { useLocation, Link } from "wouter";
import { Home, Ship, FileText, MessageSquare, User } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/vessels", icon: Ship, label: "Fleet" },
  { href: "/proformas", icon: FileText, label: "PDA" },
  { href: "/messages", icon: MessageSquare, label: "Messages" },
  { href: "/company-profile", icon: User, label: "Profile" },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-700/50 safe-area-bottom md:hidden" data-testid="mobile-bottom-nav">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? location === "/" || location === "/dashboard"
              : location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex flex-col items-center gap-0.5 px-3 py-1 min-w-[44px] min-h-[44px] justify-center cursor-pointer ${
                  isActive ? "text-sky-400" : "text-slate-500"
                }`}
                data-testid={`bottom-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
