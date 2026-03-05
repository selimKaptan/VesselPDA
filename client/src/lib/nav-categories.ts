import {
  LayoutDashboard,
  Map,
  FileText,
  Zap,
  ClipboardList,
  FileCheck,
  Bell,
  CheckSquare,
  Megaphone,
  Paperclip,
  Package,
  TrendingUp,
  Building2,
  Ship,
  ScrollText,
  Navigation,
  Receipt,
  CreditCard,
  Gem,
  Fuel,
  Mail,
  MessageSquare,
  BellRing,
  UserPlus,
  Anchor,
  Shield,
  BarChart3,
  Users,
  HardDrive,
  Wand2,
  Settings,
  Crown,
  UserCheck,
  Wrench,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";

export type BadgeSource = "messages" | "nominations" | "tenders" | "certs" | "voyageInvites";

export interface NavSubPage {
  label: string;
  url: string;
  icon: any;
  badge?: BadgeSource;
  isNew?: boolean;
  exact?: boolean;
}

export interface NavCategory {
  key: string;
  label: string;
  abbrev: string;
  icon: any;
  color: "sky" | "amber";
  subPages: NavSubPage[];
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    abbrev: "Dashb",
    icon: LayoutDashboard,
    color: "sky",
    subPages: [
      { label: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    abbrev: "Opera",
    icon: Map,
    color: "sky",
    subPages: [
      { label: "Voyages", url: "/voyages", icon: Map },
      { label: "Proformas", url: "/proformas", icon: FileText },
      { label: "Quick Proforma", url: "/proformas/new", icon: Zap, exact: true },
      { label: "Notice of Readiness", url: "/nor", icon: FileCheck, isNew: true },
      { label: "Statement of Facts", url: "/sof", icon: ClipboardList, isNew: true },
      { label: "Service Requests", url: "/service-requests", icon: Bell },
      { label: "Nominations", url: "/nominations", icon: UserCheck, badge: "nominations" },
      { label: "PDA Review", url: "/pda-review", icon: CheckSquare },
    ],
  },
  {
    key: "commercial",
    label: "Commercial",
    abbrev: "Comm",
    icon: Megaphone,
    color: "sky",
    subPages: [
      { label: "Tenders", url: "/tenders", icon: Megaphone, badge: "tenders" },
      { label: "Fixtures", url: "/fixtures", icon: Paperclip },
      { label: "Cargo Positions", url: "/cargo-positions", icon: Package },
      { label: "Market Data", url: "/market-data", icon: TrendingUp },
      { label: "Directory", url: "/directory", icon: Building2 },
    ],
  },
  {
    key: "fleet",
    label: "Fleet",
    abbrev: "Fleet",
    icon: Ship,
    color: "sky",
    subPages: [
      { label: "Vessels", url: "/vessels", icon: Ship },
      { label: "Q88 Questionnaire", url: "/vessels", icon: FileSpreadsheet },
      { label: "Vessel Schedule", url: "/vessel-schedule", icon: Calendar },
      { label: "Certificates", url: "/vessel-certificates", icon: ScrollText, badge: "certs" },
      { label: "Vessel Tracking", url: "/vessel-track", icon: Navigation },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    abbrev: "Finan",
    icon: Receipt,
    color: "sky",
    subPages: [
      { label: "DA Comparison", url: "/da-comparison", icon: BarChart3 },
      { label: "Final Disbursement", url: "/fda", icon: Receipt, isNew: true },
      { label: "Invoices", url: "/invoices", icon: CreditCard },
      { label: "Pricing & Plans", url: "/pricing", icon: Gem },
      { label: "Bunker Prices", url: "/market-data", icon: Fuel },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    abbrev: "Chat",
    icon: Mail,
    color: "sky",
    subPages: [
      { label: "Messages", url: "/messages", icon: Mail, badge: "messages" },
      { label: "Forum", url: "/forum", icon: MessageSquare },
      { label: "Notifications", url: "/notifications", icon: BellRing },
      { label: "Voyage Invitations", url: "/voyage-invitations", icon: UserPlus, badge: "voyageInvites" },
    ],
  },
  {
    key: "tools",
    label: "Tools",
    abbrev: "Tools",
    icon: Wrench,
    color: "sky",
    subPages: [
      { label: "AI Smart Drop", url: "/ai-smart-drop", icon: Wand2 },
      { label: "Port Info", url: "/port-info", icon: Anchor },
      { label: "Sanctions Check", url: "/sanctions-check", icon: Shield },
      { label: "Company Profile", url: "/company-profile", icon: Building2 },
    ],
  },
  {
    key: "admin",
    label: "Admin",
    abbrev: "Admin",
    icon: Crown,
    color: "amber",
    subPages: [
      { label: "Admin Panel", url: "/admin", icon: Zap },
      { label: "Tariff Management", url: "/tariff-management", icon: BarChart3 },
      { label: "User Management", url: "/admin", icon: Users },
      { label: "Cache Stats", url: "/admin", icon: HardDrive },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    abbrev: "Set",
    icon: Settings,
    color: "sky",
    subPages: [
      { label: "Settings", url: "/settings", icon: Settings },
      { label: "Team Management", url: "/team", icon: Users },
    ],
  },
];

export const ROLE_CATEGORIES: Record<string, string[]> = {
  admin: ["dashboard", "operations", "commercial", "fleet", "finance", "communication", "tools", "admin", "settings"],
  shipowner: ["dashboard", "operations", "commercial", "fleet", "finance", "communication", "tools", "settings"],
  agent: ["dashboard", "operations", "commercial", "finance", "communication", "tools", "settings"],
  broker: ["dashboard", "commercial", "operations", "communication", "tools", "settings"],
  provider: ["dashboard", "operations", "communication", "tools", "settings"],
  master: ["dashboard", "operations", "fleet", "communication", "tools", "settings"],
};

export const URL_TO_CATEGORY: Record<string, string> = {
  "/dashboard": "dashboard",
  "/": "dashboard",
  "/voyages": "operations",
  "/proformas": "operations",
  "/nor": "operations",
  "/sof": "operations",
  "/service-requests": "operations",
  "/nominations": "operations",
  "/pda-review": "operations",
  "/tenders": "commercial",
  "/fixtures": "commercial",
  "/cargo-positions": "commercial",
  "/market-data": "commercial",
  "/directory": "commercial",
  "/vessels": "fleet",
  "/vessel-schedule": "fleet",
  "/vessel-certificates": "fleet",
  "/vessel-track": "fleet",
  "/vessel-q88": "fleet",
  "/da-comparison": "finance",
  "/fda": "finance",
  "/invoices": "finance",
  "/pricing": "finance",
  "/messages": "communication",
  "/forum": "communication",
  "/notifications": "communication",
  "/voyage-invitations": "communication",
  "/ai-smart-drop": "tools",
  "/port-info": "tools",
  "/sanctions-check": "tools",
  "/company-profile": "tools",
  "/admin": "admin",
  "/tariff-management": "admin",
  "/settings": "settings",
  "/team": "settings",
};

export function urlToCategory(pathname: string): string {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  for (const [prefix, cat] of Object.entries(URL_TO_CATEGORY)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return cat;
    }
  }
  return "dashboard";
}

export function getCategoryByKey(key: string): NavCategory | undefined {
  return NAV_CATEGORIES.find((c) => c.key === key);
}

export function getVisibleCategories(role: string): NavCategory[] {
  const keys = ROLE_CATEGORIES[role] || ROLE_CATEGORIES["shipowner"];
  return NAV_CATEGORIES.filter((c) => keys.includes(c.key));
}

export function getCurrentPageLabel(pathname: string): string {
  for (const cat of NAV_CATEGORIES) {
    for (const page of cat.subPages) {
      const isExact = page.exact;
      if (isExact ? pathname === page.url : (pathname === page.url || pathname.startsWith(page.url + "/"))) {
        return page.label;
      }
    }
  }
  return "";
}
