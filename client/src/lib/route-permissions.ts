export type AppRole = "ship_agent" | "shipowner" | "ship_broker" | "ship_provider" | "admin";

const ALL_ROLES: AppRole[] = ["ship_agent", "shipowner", "ship_broker", "ship_provider", "admin"];
const NO_PROVIDER: AppRole[] = ["ship_agent", "shipowner", "ship_broker", "admin"];
const OWNER_BROKER_ADMIN: AppRole[] = ["shipowner", "ship_broker", "admin"];
const AGENT_OWNER_ADMIN: AppRole[] = ["ship_agent", "shipowner", "admin"];
const AGENT_OWNER_BROKER: AppRole[] = ["ship_agent", "shipowner", "ship_broker", "admin"];
const PROVIDER_ADMIN: AppRole[] = ["ship_provider", "admin"];

const routePermissions: Record<string, AppRole[]> = {
  "/":                   ALL_ROLES,
  "/dashboard":          ALL_ROLES,
  "/settings":           ALL_ROLES,
  "/messages":           ALL_ROLES,
  "/team-chat":          ALL_ROLES,
  "/forum":              ALL_ROLES,
  "/directory":          ALL_ROLES,
  "/organization":       ALL_ROLES,
  "/organization-select": ALL_ROLES,
  "/organization-dashboard": ALL_ROLES,
  "/reminders":          ALL_ROLES,
  "/reports":            ALL_ROLES,
  "/contact":            ALL_ROLES,
  "/pricing":            ALL_ROLES,
  "/company-profile":    ALL_ROLES,

  "/exchange-rates":     NO_PROVIDER,
  "/email-inbox":        NO_PROVIDER,
  "/market-data":        NO_PROVIDER,
  "/sanctions-check":    NO_PROVIDER,
  "/port-benchmarking":  NO_PROVIDER,

  "/voyages":            AGENT_OWNER_BROKER,
  "/proformas":          AGENT_OWNER_BROKER,
  "/port-info":          AGENT_OWNER_BROKER,
  "/nominations":        AGENT_OWNER_BROKER,
  "/vessels":            AGENT_OWNER_BROKER,
  "/vessel-track":       AGENT_OWNER_BROKER,
  "/vessel-certificates": AGENT_OWNER_BROKER,
  "/compliance":         AGENT_OWNER_BROKER,
  "/tenders":            ALL_ROLES,
  "/service-requests":   ["ship_agent", "shipowner", "ship_provider", "admin"],

  "/final-da":           AGENT_OWNER_ADMIN,
  "/invoices":           ["ship_agent", "shipowner", "ship_provider", "admin"],

  "/bunker-management":  OWNER_BROKER_ADMIN,
  "/fixtures":           OWNER_BROKER_ADMIN,
  "/cargo-positions":    OWNER_BROKER_ADMIN,

  "/service-ports":      PROVIDER_ADMIN,

  "/admin":              ["admin"],
  "/tariff-management":  ["admin"],
};

export function canAccessRoute(role: string, route: string): boolean {
  if (role === "admin") return true;

  const exact = routePermissions[route];
  if (exact !== undefined) return exact.includes(role as AppRole);

  const base = "/" + route.split("/")[1];
  const basePerms = routePermissions[base];
  if (basePerms !== undefined) return basePerms.includes(role as AppRole);

  return true;
}

export function getAllowedRolesForRoute(route: string): AppRole[] {
  const exact = routePermissions[route];
  if (exact !== undefined) return exact;
  const base = "/" + route.split("/")[1];
  return routePermissions[base] ?? ALL_ROLES;
}

export { routePermissions };
