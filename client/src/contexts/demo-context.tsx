import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { DemoRole } from "@/lib/demo-data";

interface DemoContextValue {
  isDemoMode: boolean;
  demoRole: DemoRole;
  demoToken: string | null;
  startDemo: (role: DemoRole) => Promise<void>;
  switchRole: (role: DemoRole) => Promise<void>;
  exitDemo: () => void;
}

const DemoContext = createContext<DemoContextValue>({
  isDemoMode: false,
  demoRole: "agent",
  demoToken: null,
  startDemo: async () => {},
  switchRole: async () => {},
  exitDemo: () => {},
});

const STORAGE_KEY = "vpda_demo_token";
const ROLE_KEY = "vpda_demo_role";

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoToken, setDemoToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [demoRole, setDemoRole] = useState<DemoRole>(() => (localStorage.getItem(ROLE_KEY) as DemoRole) || "agent");

  const isDemoMode = Boolean(demoToken);

  const startDemo = useCallback(async (role: DemoRole) => {
    try {
      const res = await fetch("/api/demo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem(STORAGE_KEY, data.token);
        localStorage.setItem(ROLE_KEY, role);
        setDemoToken(data.token);
        setDemoRole(role);
      }
    } catch {
      const mockToken = `demo_${Date.now()}`;
      localStorage.setItem(STORAGE_KEY, mockToken);
      localStorage.setItem(ROLE_KEY, role);
      setDemoToken(mockToken);
      setDemoRole(role);
    }
  }, []);

  const switchRole = useCallback(async (role: DemoRole) => {
    if (!demoToken) return;
    try {
      await fetch("/api/demo/switch-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: demoToken, role }),
      });
    } catch {}
    localStorage.setItem(ROLE_KEY, role);
    setDemoRole(role);
  }, [demoToken]);

  const exitDemo = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ROLE_KEY);
    setDemoToken(null);
    setDemoRole("agent");
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode, demoRole, demoToken, startDemo, switchRole, exitDemo }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
