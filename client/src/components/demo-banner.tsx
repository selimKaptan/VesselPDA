import { Link, useLocation } from "wouter";
import { useDemo } from "@/contexts/demo-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, ArrowRight, RefreshCw, ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { DemoRole } from "@/lib/demo-data";

const ROLE_LABELS: Record<DemoRole, string> = {
  ship_agent:    "Ship Agent",
  shipowner:     "Shipowner",
  ship_broker:   "Ship Broker",
  ship_provider: "Ship Provider",
};

const ROLE_GRADIENTS: Record<DemoRole, { bg: string; shadow: string }> = {
  ship_agent:    { bg: "linear-gradient(135deg, #1d4ed8, #0ea5e9)", shadow: "rgba(14,165,233,0.3)"  },
  shipowner:     { bg: "linear-gradient(135deg, #16a34a, #10b981)", shadow: "rgba(16,185,129,0.3)"  },
  ship_broker:   { bg: "linear-gradient(135deg, #ea580c, #f59e0b)", shadow: "rgba(245,158,11,0.3)"  },
  ship_provider: { bg: "linear-gradient(135deg, #7c3aed, #a855f7)", shadow: "rgba(168,85,247,0.3)"  },
};

export function DemoBanner() {
  const { isDemoMode, demoRole, switchRole, exitDemo } = useDemo();
  const [switching, setSwitching] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  if (!isDemoMode) return null;

  const gradient = ROLE_GRADIENTS[demoRole] ?? ROLE_GRADIENTS.ship_agent;

  const handleSwitch = async (role: DemoRole) => {
    if (role === demoRole) return;
    setSwitching(true);
    await switchRole(role);
    setSwitching(false);
    toast({ title: `Şimdi ${ROLE_LABELS[role]} olarak görüntülüyorsunuz`, duration: 2500 });
    navigate("/demo");
  };

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 z-[200]"
      style={{
        background: gradient.bg,
        boxShadow: `0 2px 12px ${gradient.shadow}`,
      }}
      data-testid="demo-banner"
    >
      <div className="flex items-center gap-3">
        <Target className="w-4 h-4 text-white flex-shrink-0" />
        <span className="text-white text-sm font-semibold hidden sm:inline">Demo Mod</span>
        <Badge className="bg-white/20 text-white border-0 text-xs px-2 py-0.5">
          {ROLE_LABELS[demoRole]}
        </Badge>
        <span className="text-white/70 text-xs hidden md:inline">
          olarak görüntülüyorsunuz — Gerçek hesap için kayıt olun
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
            {(["ship_agent", "shipowner", "ship_broker", "ship_provider"] as DemoRole[]).map(r => (
              <DropdownMenuItem
                key={r}
                onClick={() => handleSwitch(r)}
                className={demoRole === r ? "font-semibold" : ""}
                data-testid={`demo-role-option-${r}`}
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
            Gerçek hesap oluştur <ArrowRight className="w-3 h-3" />
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
