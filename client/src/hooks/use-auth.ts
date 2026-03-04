import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

export type AppRole = "ship_agent" | "shipowner" | "ship_broker" | "ship_provider" | "admin";

const MODULE_PERMISSIONS: Record<AppRole, string[]> = {
  ship_agent: [
    "vessels", "voyages", "vessel-track", "sof", "port-info", "certificates",
    "proformas", "final-da", "invoices", "exchange-rates", "port-benchmarking", "market-data",
    "tenders", "nominations", "service-requests",
    "messages", "team-chat", "email-inbox", "forum",
    "directory", "sanctions-check", "compliance", "reports", "settings",
  ],
  shipowner: [
    "vessels", "voyages", "vessel-track", "sof", "certificates", "compliance",
    "bunker", "voyage-expenses",
    "fixtures", "cargo-positions", "tenders", "nominations", "market-data",
    "proformas", "final-da", "invoices", "port-benchmarking", "exchange-rates",
    "messages", "team-chat", "email-inbox", "forum",
    "directory", "service-requests", "sanctions-check", "reports", "settings",
  ],
  ship_broker: [
    "fixtures", "cargo-positions", "tenders", "nominations", "laytime",
    "vessels", "voyages", "vessel-track", "sof", "certificates", "compliance",
    "bunker", "voyage-expenses",
    "proformas", "final-da", "invoices",
    "market-data", "port-benchmarking", "exchange-rates", "sanctions-check",
    "messages", "team-chat", "email-inbox", "forum", "directory",
    "service-requests", "reports", "settings",
  ],
  ship_provider: [
    "service-requests", "tenders", "service-ports", "invoices", "exchange-rates",
    "messages", "team-chat", "forum", "directory", "reports", "settings",
  ],
  admin: ["*"],
};

const ROUTE_MODULE_MAP: Record<string, string> = {
  "vessels": "vessels",
  "voyages": "voyages",
  "vessel-track": "vessel-track",
  "vessel-certificates": "certificates",
  "compliance": "compliance",
  "port-info": "port-info",
  "proformas": "proformas",
  "final-da": "final-da",
  "invoices": "invoices",
  "market-data": "market-data",
  "port-benchmarking": "port-benchmarking",
  "tenders": "tenders",
  "nominations": "nominations",
  "service-requests": "service-requests",
  "messages": "messages",
  "team-chat": "team-chat",
  "email-inbox": "email-inbox",
  "forum": "forum",
  "directory": "directory",
  "sanctions-check": "sanctions-check",
  "reports": "reports",
  "settings": "settings",
  "bunker-management": "bunker",
  "fixtures": "fixtures",
  "cargo-positions": "cargo-positions",
  "service-ports": "service-ports",
  "admin": "admin-panel",
  "tariff-management": "admin-panel",
  "organization": "settings",
  "organization-dashboard": "settings",
  "pricing": "settings",
  "company-profile": "settings",
};

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  window.location.href = "/";
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const userRole = (user as any)?.userRole as AppRole | undefined;
  const isAdmin = userRole === "admin";
  const activeRole = (user as any)?.activeRole as AppRole | undefined;
  const effectiveRole: AppRole = (isAdmin ? activeRole : userRole) || "shipowner";

  function hasPermission(module: string): boolean {
    const perms = MODULE_PERMISSIONS[effectiveRole] || [];
    return perms.includes("*") || perms.includes(module);
  }

  function canAccess(route: string): boolean {
    if (!user) return false;
    if (isAdmin) return true;
    const path = route.replace(/^\//, "").split("/")[0];
    const module = ROUTE_MODULE_MAP[path] || path;
    return hasPermission(module);
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    role: effectiveRole,
    userRole,
    isAdmin,
    hasPermission,
    canAccess,
  };
}
