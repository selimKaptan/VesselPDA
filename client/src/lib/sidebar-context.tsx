import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarContextValue {
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  return useContext(SidebarContext);
}
