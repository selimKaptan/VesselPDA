import {
  LayoutDashboard,
  Ship,
  Anchor,
  DollarSign,
  Users,
  Map,
  FileCheck,
  Megaphone,
  UserCheck,
  ArrowUpDown,
  Navigation,
  ClipboardList,
  ScrollText,
  Compass,
  Activity,
  Calendar,
  Wrench,
  Receipt,
  CreditCard,
  Scale,
  BarChart3,
  Paperclip,
  Users2,
  Package,
  FileText,
  MapPin,
  Building2,
  MessageSquare,
  MessageCircle,
  Settings,
  Shield,
  Crown,
  FileBarChart2,
  Bell,
} from "lucide-react";

export type BadgeSource = "messages" | "nominations" | "tenders" | "certs" | "voyageInvites";

export interface NavChild {
  label: string;
  url: string;
  icon: any;
  badge?: BadgeSource;
  isNew?: boolean;
  isPro?: boolean;
  roles?: string[];
}

export interface NavMainItem {
  key: string;
  label: string;
  abbrev: string;
  icon: any;
  url: string;
  children?: NavChild[];
}

export interface NavSecondaryItem {
  label: string;
  url: string;
  icon: any;
  badge?: BadgeSource;
  roles?: string[];
}

export interface NavStructure {
  main: NavMainItem[];
  secondary: NavSecondaryItem[];
  settings: NavSecondaryItem[];
}

export const NAV_STRUCTURE: NavStructure = {
  main: [
    {
      key: "dashboard",
      label: "Dashboard",
      abbrev: "Dash",
      icon: LayoutDashboard,
      url: "/dashboard",
    },
    {
      key: "voyages",
      label: "Voyages",
      abbrev: "Voyag",
      icon: Ship,
      url: "/voyages",
      children: [
        { label: "All Voyages", url: "/voyages", icon: Map },
        { label: "Port Calls", url: "/port-calls", icon: Anchor },
        { label: "NOR", url: "/nor", icon: FileText },
        { label: "SOF", url: "/sof", icon: FileCheck },
        { label: "Tenders", url: "/tenders", icon: Megaphone, badge: "tenders" },
        { label: "Nominations", url: "/nominations", icon: UserCheck, badge: "nominations" },
        { label: "Cargo Operations", url: "/cargo-ops", icon: ArrowUpDown, isNew: true },
        { label: "Husbandry", url: "/husbandry", icon: Package },
        { label: "Agent Reports", url: "/agent-reports", icon: FileBarChart2 },
        { label: "Action Center", url: "/actions", icon: Bell },
      ],
    },
    {
      key: "fleet",
      label: "Fleet & Assets",
      abbrev: "Fleet",
      icon: Anchor,
      url: "/vessels",
      children: [
        { label: "Vessels", url: "/vessels", icon: Ship },
        { label: "Vessel Tracking", url: "/vessel-track", icon: Navigation },
        { label: "PMS", url: "/pms", icon: ClipboardList, isNew: true },
        { label: "Certificates", url: "/vessel-certificates", icon: ScrollText, badge: "certs" },
        { label: "Passage Planning", url: "/passage-planning", icon: Compass, roles: ["admin", "master", "shipowner"] },
        { label: "Performance", url: "/noon-reports", icon: Activity },
        { label: "Vessel Schedule", url: "/vessel-schedule", icon: Calendar },
        { label: "Drydock", url: "/drydock", icon: Wrench },
        { label: "Maintenance", url: "/maintenance", icon: Settings },
        { label: "Charter Party", url: "/charter-parties", icon: ScrollText },
      ],
    },
    {
      key: "financials",
      label: "Financials",
      abbrev: "Finan",
      icon: DollarSign,
      url: "/proformas",
      children: [
        { label: "Proformas (PDA)", url: "/proformas", icon: FileText },
        { label: "FDA", url: "/fda", icon: Receipt },
        { label: "Invoices", url: "/invoices", icon: CreditCard },
        { label: "DA Advances", url: "/da-advances", icon: CreditCard },
        { label: "Port Expenses", url: "/port-expenses", icon: Receipt },
        { label: "Laytime Calculator", url: "/laytime-calculator", icon: Scale },
        { label: "Commercial", url: "/fixtures", icon: Paperclip },
        { label: "DA Comparison", url: "/da-comparison", icon: BarChart3, isPro: true },
        { label: "Analytics", url: "/analytics", icon: BarChart3, isPro: true },
      ],
    },
    {
      key: "crew",
      label: "Crew & Logistics",
      abbrev: "Crew",
      icon: Users,
      url: "/crew-roster",
      children: [
        { label: "Crew Roster", url: "/crew-roster", icon: Users2 },
        { label: "Crew Documents", url: "/crew-doc-settings", icon: FileText },
      ],
    },
  ],
  secondary: [
    { label: "Port Info", url: "/ports", icon: MapPin },
    { label: "Directory", url: "/directory", icon: Building2 },
    { label: "Messages", url: "/messages", icon: MessageSquare, badge: "messages" },
    { label: "Forum", url: "/forum", icon: MessageCircle },
    { label: "Voyage Invitations", url: "/voyage-invitations", icon: UserCheck, badge: "voyageInvites" },
  ],
  settings: [
    { label: "Settings", url: "/settings", icon: Settings },
    { label: "Admin Panel", url: "/admin", icon: Crown, roles: ["admin"] },
  ],
};

export const ROLE_MAIN_ITEMS: Record<string, string[]> = {
  admin:     ["dashboard", "voyages", "fleet", "financials", "crew"],
  shipowner: ["dashboard", "voyages", "fleet", "financials", "crew"],
  agent:     ["dashboard", "voyages", "fleet", "financials", "crew"],
  broker:    ["dashboard", "voyages", "financials"],
  provider:  ["dashboard", "voyages", "financials"],
  master:    ["dashboard", "voyages", "fleet", "crew"],
};

export const URL_TO_NAV_KEY: Record<string, string> = {
  "/dashboard": "dashboard",
  "/": "dashboard",
  "/market-data": "dashboard",
  "/port-info": "dashboard",
  "/sanctions-check": "dashboard",
  "/voyages": "voyages",
  "/voyage-workflow": "voyages",
  "/port-calls": "voyages",
  "/nor": "voyages",
  "/sof": "voyages",
  "/tenders": "voyages",
  "/nominations": "voyages",
  "/cargo-operations": "voyages",
  "/cargo-ops": "voyages",
  "/pda-review": "voyages",
  "/actions": "voyages",
  "/husbandry": "voyages",
  "/agent-reports": "voyages",
  "/vessels": "fleet",
  "/vessel-schedule": "fleet",
  "/vessel-certificates": "fleet",
  "/vessel-track": "fleet",
  "/vessel-q88": "fleet",
  "/vessel-vault": "fleet",
  "/noon-reports": "fleet",
  "/passage-planning": "fleet",
  "/charter-parties": "fleet",
  "/maintenance": "fleet",
  "/bunker-management": "fleet",
  "/environmental": "fleet",
  "/insurance": "fleet",
  "/drydock": "fleet",
  "/pms": "fleet",
  "/defect-tracker": "fleet",
  "/spare-parts": "fleet",
  "/proformas": "financials",
  "/fda": "financials",
  "/invoices": "financials",
  "/port-expenses": "financials",
  "/da-advances": "financials",
  "/da-comparison": "financials",
  "/laytime-calculator": "financials",
  "/laytime": "financials",
  "/voyage-estimation": "financials",
  "/fixtures": "financials",
  "/order-book": "financials",
  "/broker-commissions": "financials",
  "/analytics": "financials",
  "/crew-roster": "crew",
  "/crew": "crew",
  "/crew-doc-settings": "crew",
  "/directory": "dashboard",
  "/service-requests": "dashboard",
  "/ports": "dashboard",
  "/messages": "dashboard",
  "/forum": "dashboard",
  "/notifications": "dashboard",
  "/voyage-invitations": "dashboard",
  "/ai-smart-drop": "dashboard",
  "/admin": "dashboard",
  "/tariff-management": "dashboard",
  "/settings": "dashboard",
  "/team": "dashboard",
  "/company-profile": "dashboard",
  "/pricing": "dashboard",
  "/contacts": "voyages",
};

export function urlToCategory(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  for (const [prefix, key] of Object.entries(URL_TO_NAV_KEY)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return key;
    }
  }
  return "dashboard";
}

export function getVisibleMainItems(role: string): NavMainItem[] {
  const keys = ROLE_MAIN_ITEMS[role] || ROLE_MAIN_ITEMS["shipowner"];
  return NAV_STRUCTURE.main.filter((item) => keys.includes(item.key));
}

export function getFilteredChildren(role: string, item: NavMainItem): NavChild[] {
  if (!item.children) return [];
  return item.children.filter((child) => {
    if (!child.roles) return true;
    return child.roles.includes(role);
  });
}

export function getMainItemByKey(key: string): NavMainItem | undefined {
  return NAV_STRUCTURE.main.find((item) => item.key === key);
}

export function getCurrentPageLabel(pathname: string): string {
  for (const item of NAV_STRUCTURE.main) {
    if (item.children) {
      for (const child of item.children) {
        if (pathname === child.url || pathname.startsWith(child.url + "/")) {
          return child.label;
        }
      }
    }
  }
  return "";
}

export function getMainItemLabel(key: string): string {
  return NAV_STRUCTURE.main.find((item) => item.key === key)?.label || "";
}

export function getVisibleSettingsItems(role: string): NavSecondaryItem[] {
  return NAV_STRUCTURE.settings.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });
}

export function getCategoryByKey(key: string) {
  const item = getMainItemByKey(key);
  if (!item) return undefined;
  return {
    key: item.key,
    label: item.label,
    abbrev: item.abbrev,
    icon: item.icon,
    color: "sky" as const,
    subPages: (item.children || []).map((c) => ({
      label: c.label,
      url: c.url,
      icon: c.icon,
      badge: c.badge,
      isNew: c.isNew,
      isPro: c.isPro,
      roles: c.roles,
    })),
  };
}

export function getVisibleCategories(role: string) {
  return getVisibleMainItems(role).map((item) => getCategoryByKey(item.key)!).filter(Boolean);
}

export function getFilteredSubPages(role: string, category: ReturnType<typeof getCategoryByKey>) {
  if (!category) return [];
  return category.subPages.filter((p) => {
    if (!p.roles) return true;
    return p.roles.includes(role);
  });
}
