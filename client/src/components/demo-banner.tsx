import { Link } from "wouter";
import { useDemo } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, ArrowRight, RefreshCw, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DemoRole } from "@/lib/demo-data";

const ROLE_LABELS: Record<DemoRole, string> = {
  agent: "Ship Agent",
  shipowner: "Shipowner / Broker",
  admin: "Admin",
};

export function DemoBanner() {
  const { isDemoMode, demoRole, switchRole, exitDemo } = useDemo();
  const [switching, setSwitching] = useState(false);

  if (!isDemoMode) return null;

  const handleSwitch = async (role: DemoRole) => {
    setSwitching(true);
    await switchRole(role);
    setSwitching(false);
    window.location.href = "/demo";
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 px-4 py-2"
      style={{
        background: "linear-gradient(135deg, #1d4ed8, #0ea5e9)",
        boxShadow: "0 2px 12px rgba(14,165,233,0.3)",
      }}
      data-testid="demo-banner"
    >
      <div className="flex items-center gap-3">
        <Target className="w-4 h-4 text-white flex-shrink-0" />
        <span className="text-white text-sm font-medium hidden sm:inline">
          Demo Mode
        </span>
        <Badge className="bg-white/20 text-white border-0 text-xs px-2 py-0.5">
          {ROLE_LABELS[demoRole]}
        </Badge>
        <span className="text-white/70 text-xs hidden md:inline">
          — Gerçek hesap için kayıt olun
        </span>
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20 h-7 text-xs gap-1"
              disabled={switching}
              data-testid="button-demo-switch-role"
            >
              {switching ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
              Rol Değiştir <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["agent", "shipowner", "admin"] as DemoRole[]).map(r => (
              <DropdownMenuItem
                key={r}
                onClick={() => handleSwitch(r)}
                className={demoRole === r ? "font-semibold" : ""}
              >
                {ROLE_LABELS[r]}
                {demoRole === r && <span className="ml-2 text-xs text-muted-foreground">(aktif)</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Link href="/register">
          <Button
            size="sm"
            className="h-7 text-xs font-semibold px-3 gap-1"
            style={{ background: "white", color: "#1d4ed8" }}
            data-testid="button-demo-register"
          >
            Kayıt Ol <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>

        <Button
          size="sm"
          variant="ghost"
          className="text-white/70 hover:text-white hover:bg-white/20 h-7 text-xs"
          onClick={() => { exitDemo(); window.location.href = "/"; }}
          data-testid="button-demo-exit"
        >
          Çıkış
        </Button>
      </div>
    </div>
  );
}
