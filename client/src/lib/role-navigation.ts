import {
  Ship,
  FileText,
  Navigation,
  Anchor,
  MessageCircle,
  MessageSquare,
  Gavel,
  Wallet,
  ShieldAlert,
  Wrench,
  Building2,
  TrendingUp,
  Handshake,
  Package,
  Settings,
  Users,
  UserCheck,
  MapPin,
  Crown,
} from "lucide-react";

export interface SubPage {
  label: string;
  url: string;
  icon: any;
}

export interface Module {
  key: string;
  label: string;
  subPages: SubPage[];
}

const SETTINGS_MODULE: Module = {
  key: "settings",
  label: "Settings",
  subPages: [
    { label: "Profile", url: "/settings", icon: Settings },
    { label: "Company", url: "/company-profile", icon: Building2 },
    { label: "Pricing", url: "/pricing", icon: Crown },
  ],
};

export function getModulesForRole(role: string): Module[] {
  switch (role) {
    case "agent":
      return [
        {
          key: "operations",
          label: "Operations",
          subPages: [
            { label: "Voyages", url: "/voyages", icon: Ship },
            { label: "Proformas", url: "/proformas", icon: FileText },
            { label: "Quick Proforma", url: "/proformas/new", icon: FileText },
            { label: "Nominations", url: "/nominations", icon: UserCheck },
          ],
        },
        {
          key: "finance",
          label: "Finance",
          subPages: [
            { label: "Invoices", url: "/invoices", icon: Wallet },
          ],
        },
        {
          key: "communication",
          label: "Communication",
          subPages: [
            { label: "Messages", url: "/messages", icon: MessageCircle },
            { label: "Forum", url: "/forum", icon: MessageSquare },
          ],
        },
        {
          key: "tools",
          label: "Tools",
          subPages: [
            { label: "Vessel Track", url: "/vessel-track", icon: Navigation },
            { label: "Port Info", url: "/port-info", icon: Anchor },
            { label: "Sanctions Check", url: "/sanctions-check", icon: ShieldAlert },
            { label: "Directory", url: "/directory", icon: Building2 },
          ],
        },
        SETTINGS_MODULE,
      ];

    case "shipowner":
      return [
        {
          key: "fleet",
          label: "Fleet",
          subPages: [
            { label: "Vessels", url: "/vessels", icon: Ship },
            { label: "Vessel Track", url: "/vessel-track", icon: Navigation },
            { label: "Certificates", url: "/vessel-certificates", icon: FileText },
          ],
        },
        {
          key: "operations",
          label: "Operations",
          subPages: [
            { label: "Voyages", url: "/voyages", icon: Ship },
            { label: "Proformas", url: "/proformas", icon: FileText },
            { label: "Quick Proforma", url: "/proformas/new", icon: FileText },
            { label: "Nominations", url: "/nominations", icon: UserCheck },
          ],
        },
        {
          key: "commercial",
          label: "Commercial",
          subPages: [
            { label: "Fixtures", url: "/fixtures", icon: Handshake },
            { label: "Cargo Positions", url: "/cargo-positions", icon: Package },
            { label: "Tenders", url: "/tenders", icon: Gavel },
            { label: "Market Data", url: "/market-data", icon: TrendingUp },
          ],
        },
        {
          key: "finance",
          label: "Finance",
          subPages: [
            { label: "Invoices", url: "/invoices", icon: Wallet },
          ],
        },
        {
          key: "communication",
          label: "Communication",
          subPages: [
            { label: "Messages", url: "/messages", icon: MessageCircle },
            { label: "Forum", url: "/forum", icon: MessageSquare },
          ],
        },
        SETTINGS_MODULE,
      ];

    case "broker":
      return [
        {
          key: "commercial",
          label: "Commercial",
          subPages: [
            { label: "Fixtures", url: "/fixtures", icon: Handshake },
            { label: "Cargo Positions", url: "/cargo-positions", icon: Package },
            { label: "Tenders", url: "/tenders", icon: Gavel },
            { label: "Market Data", url: "/market-data", icon: TrendingUp },
            { label: "Nominations", url: "/nominations", icon: UserCheck },
          ],
        },
        {
          key: "operations",
          label: "Operations",
          subPages: [
            { label: "Voyages", url: "/voyages", icon: Ship },
            { label: "Proformas", url: "/proformas", icon: FileText },
            { label: "Quick Proforma", url: "/proformas/new", icon: FileText },
          ],
        },
        {
          key: "fleet",
          label: "Fleet",
          subPages: [
            { label: "Vessels", url: "/vessels", icon: Ship },
            { label: "Vessel Track", url: "/vessel-track", icon: Navigation },
          ],
        },
        {
          key: "finance",
          label: "Finance",
          subPages: [
            { label: "Invoices", url: "/invoices", icon: Wallet },
          ],
        },
        {
          key: "communication",
          label: "Communication",
          subPages: [
            { label: "Messages", url: "/messages", icon: MessageCircle },
            { label: "Forum", url: "/forum", icon: MessageSquare },
          ],
        },
        {
          key: "tools",
          label: "Tools",
          subPages: [
            { label: "Port Info", url: "/port-info", icon: Anchor },
            { label: "Sanctions Check", url: "/sanctions-check", icon: ShieldAlert },
            { label: "Directory", url: "/directory", icon: Building2 },
          ],
        },
        SETTINGS_MODULE,
      ];

    case "provider":
      return [
        {
          key: "services",
          label: "Services",
          subPages: [
            { label: "Service Requests", url: "/service-requests", icon: Wrench },
            { label: "Service Ports", url: "/service-ports", icon: MapPin },
          ],
        },
        {
          key: "commercial",
          label: "Commercial",
          subPages: [
            { label: "Tenders", url: "/tenders", icon: Gavel },
            { label: "Directory", url: "/directory", icon: Building2 },
          ],
        },
        {
          key: "finance",
          label: "Finance",
          subPages: [
            { label: "Invoices", url: "/invoices", icon: Wallet },
          ],
        },
        {
          key: "communication",
          label: "Communication",
          subPages: [
            { label: "Messages", url: "/messages", icon: MessageCircle },
            { label: "Forum", url: "/forum", icon: MessageSquare },
          ],
        },
        SETTINGS_MODULE,
      ];

    case "admin":
      return [
        {
          key: "fleet",
          label: "Fleet",
          subPages: [
            { label: "Vessels", url: "/vessels", icon: Ship },
            { label: "Vessel Track", url: "/vessel-track", icon: Navigation },
            { label: "Certificates", url: "/vessel-certificates", icon: FileText },
          ],
        },
        {
          key: "operations",
          label: "Operations",
          subPages: [
            { label: "Voyages", url: "/voyages", icon: Ship },
            { label: "Proformas", url: "/proformas", icon: FileText },
            { label: "Nominations", url: "/nominations", icon: UserCheck },
          ],
        },
        {
          key: "commercial",
          label: "Commercial",
          subPages: [
            { label: "Fixtures", url: "/fixtures", icon: Handshake },
            { label: "Cargo Positions", url: "/cargo-positions", icon: Package },
            { label: "Tenders", url: "/tenders", icon: Gavel },
            { label: "Market Data", url: "/market-data", icon: TrendingUp },
          ],
        },
        {
          key: "finance",
          label: "Finance",
          subPages: [
            { label: "Invoices", url: "/invoices", icon: Wallet },
          ],
        },
        {
          key: "communication",
          label: "Communication",
          subPages: [
            { label: "Messages", url: "/messages", icon: MessageCircle },
            { label: "Forum", url: "/forum", icon: MessageSquare },
          ],
        },
        {
          key: "tools",
          label: "Tools",
          subPages: [
            { label: "Port Info", url: "/port-info", icon: Anchor },
            { label: "Sanctions Check", url: "/sanctions-check", icon: ShieldAlert },
            { label: "Directory", url: "/directory", icon: Building2 },
            { label: "Service Ports", url: "/service-ports", icon: MapPin },
          ],
        },
        {
          key: "admin",
          label: "Admin",
          subPages: [
            { label: "Admin Panel", url: "/admin", icon: Users },
            { label: "Tariff Management", url: "/tariff-management", icon: FileText },
          ],
        },
        SETTINGS_MODULE,
      ];

    default:
      return getModulesForRole("shipowner");
  }
}

export function getActiveModule(modules: Module[], pathname: string): Module | null {
  if (pathname === "/" || pathname === "/dashboard") {
    return modules[0] || null;
  }
  for (const mod of modules) {
    for (const page of mod.subPages) {
      if (pathname === page.url || pathname.startsWith(page.url + "/")) {
        return mod;
      }
    }
  }
  return modules[0] || null;
}

export function canAccessRoute(role: string, path: string): boolean {
  if (path === "/" || path === "/dashboard") return true;
  const modules = getModulesForRole(role);
  const allUrls = modules.flatMap((m) => m.subPages.map((p) => p.url));
  return allUrls.some((u) => path === u || path.startsWith(u + "/"));
}
