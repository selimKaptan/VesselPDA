import {
  LayoutDashboard,
  Map,
  FileText,
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
  Calendar,
  FileSpreadsheet,
  Zap,
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
    label: "Port Operations",
    abbrev: "Opera",
    icon: Map,
    color: "sky",
    subPages: [
      { label: "Voyages", url: "/voyages", icon: Map },
      { label: "Proformas", url: "/proformas", icon: FileText },
      { label: "Notice of Readiness", url: "/nor", icon: FileCheck, isNew: true },
      { label: "Statement of Facts", url: "/sof", icon: ClipboardList, isNew: true },
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
    key: "services",
    label: "Services & Directory",
    abbrev: "Serv",
    icon: Building2,
    color: "sky",
    subPages: [
      { label: "Provider Directory", url: "/directory", icon: Building2 },
      { label: "Service Requests", url: "/service-requests", icon: Bell },
      { label: "Ports Database", url: "/ports", icon: Anchor },
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
    ],
  },
  {
    key: "communication",
    label: "Workspace",
    abbrev: "Work",
    icon: Mail,
    color: "sky",
    subPages: [
      { label: "Messages", url: "/messages", icon: Mail, badge: "messages" },
      { label: "Forum", url: "/forum", icon: MessageSquare },
      { label: "Notifications", url: "/notifications", icon: BellRing },
      { label: "Voyage Invitations", url: "/voyage-invitations", icon: UserPlus, badge: "voyageInvites" },
      { label: "AI Smart Drop", url: "/ai-smart-drop", icon: Wand2, isNew: true },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    abbrev: "Intel",
    icon: BarChart3,
    color: "sky",
    subPages: [
      { label: "Market Data & BDI", url: "/market-data", icon: TrendingUp },
      { label: "Port Info", url: "/port-info", icon: Anchor },
      { label: "Sanctions Check", url: "/sanctions-check", icon: Shield },
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
      { label: "Company Profile", url: "/company-profile", icon: Building2 },
      { label: "Pricing & Plans", url: "/pricing", icon: Gem },
    ],
  },
];

export const ROLE_CATEGORIES: Record<string, string[]> = {
  admin:     ["dashboard", "operations", "commercial", "fleet", "finance", "services", "communication", "intelligence", "admin", "settings"],
  shipowner: ["dashboard", "operations", "commercial", "fleet", "finance", "services", "communication", "intelligence", "settings"],
  agent:     ["dashboard", "operations", "commercial", "finance", "services", "communication", "intelligence", "settings"],
  broker:    ["dashboard", "commercial", "operations", "services", "communication", "intelligence", "settings"],
  provider:  ["dashboard", "operations", "services", "communication", "settings"],
  master:    ["dashboard", "operations", "fleet", "communication", "intelligence", "settings"],
};

export const URL_TO_CATEGORY: Record<string, string> = {
  "/dashboard": "dashboard",
  "/": "dashboard",
  "/voyages": "operations",
  "/proformas": "operations",
  "/nor": "operations",
  "/sof": "operations",
  "/nominations": "operations",
  "/pda-review": "operations",
  "/tenders": "commercial",
  "/fixtures": "commercial",
  "/cargo-positions": "commercial",
  "/vessels": "fleet",
  "/vessel-schedule": "fleet",
  "/vessel-certificates": "fleet",
  "/vessel-track": "fleet",
  "/vessel-q88": "fleet",
  "/directory": "services",
  "/service-requests": "services",
  "/ports": "services",
  "/da-comparison": "finance",
  "/fda": "finance",
  "/invoices": "finance",
  "/messages": "communication",
  "/forum": "communication",
  "/notifications": "communication",
  "/voyage-invitations": "communication",
  "/ai-smart-drop": "communication",
  "/market-data": "intelligence",
  "/port-info": "intelligence",
  "/sanctions-check": "intelligence",
  "/admin": "admin",
  "/tariff-management": "admin",
  "/settings": "settings",
  "/team": "settings",
  "/company-profile": "settings",
  "/pricing": "settings",
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
