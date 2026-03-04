import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { canAccessRoute } from "@/lib/route-permissions";

export function ProtectedRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const { role, isAdmin } = useAuth();
  const effectiveRole = isAdmin ? "admin" : (role || "shipowner");
  if (!canAccessRoute(effectiveRole, path)) {
    return <Redirect to="/unauthorized" />;
  }
  return <>{children}</>;
}

const _guardCache = new WeakMap<React.ComponentType<any>, Map<string, React.ComponentType<any>>>();

export function guardRoute<T extends object>(
  Component: React.ComponentType<T>,
  path: string,
): React.ComponentType<T> {
  if (!_guardCache.has(Component)) _guardCache.set(Component, new Map());
  const pathMap = _guardCache.get(Component)!;
  if (!pathMap.has(path)) {
    function Protected(props: T) {
      const { role, isAdmin } = useAuth();
      const effectiveRole = isAdmin ? "admin" : (role || "shipowner");
      if (!canAccessRoute(effectiveRole, path)) {
        return <Redirect to="/unauthorized" />;
      }
      return <Component {...props} />;
    }
    Protected.displayName = `Protected(${(Component as any).displayName || (Component as any).name || path})`;
    pathMap.set(path, Protected as React.ComponentType<T>);
  }
  return pathMap.get(path) as React.ComponentType<T>;
}
