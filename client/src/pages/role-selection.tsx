import { useMutation } from "@tanstack/react-query";
import { Ship, Building2, ArrowRight, Anchor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const ROLES = [
  {
    value: "shipowner",
    title: "Shipowner / Broker",
    description: "I need to generate proforma disbursement accounts and find trusted agents & service providers.",
    icon: Ship,
    color: "var(--maritime-primary)",
    features: ["Generate proforma invoices", "Browse maritime directory", "Manage vessel fleet"],
  },
  {
    value: "agent",
    title: "Ship Agent",
    description: "I provide ship agency services and want to create a company profile to attract shipowners.",
    icon: Anchor,
    color: "var(--maritime-secondary)",
    features: ["Create company profile", "Appear in directory", "Generate proforma invoices", "Manage vessel fleet"],
  },
  {
    value: "provider",
    title: "Service Provider",
    description: "I provide maritime services (chandlery, bunker, repair, etc.) and want to advertise in the directory.",
    icon: Building2,
    color: "var(--maritime-accent)",
    features: ["Create company profile", "Appear in directory", "Advertise services to shipowners"],
  },
];

export default function RoleSelection() {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);

  const roleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await apiRequest("PATCH", "/api/user/role", { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.reload();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to set role", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-3">
          <img src="/logo-v2.png" alt="VesselPDA" className="w-14 h-14 rounded-lg mx-auto object-contain" />
          <h1 className="font-serif text-3xl font-bold tracking-tight" data-testid="text-role-selection-title">
            Welcome to VesselPDA
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            How will you be using the platform? This helps us customize your experience.
          </p>
          <p className="text-sm text-muted-foreground/70">
            This choice is permanent and cannot be changed later.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {ROLES.map((role) => (
            <Card
              key={role.value}
              className={`p-6 cursor-pointer transition-all hover:shadow-md ${
                selected === role.value
                  ? "ring-2 ring-[hsl(var(--maritime-primary))] border-[hsl(var(--maritime-primary))] shadow-md"
                  : "hover:border-[hsl(var(--maritime-primary)/0.3)]"
              }`}
              onClick={() => setSelected(role.value)}
              data-testid={`card-role-${role.value}`}
            >
              <div className="space-y-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `hsl(${role.color} / 0.1)` }}
                >
                  <role.icon className="w-6 h-6" style={{ color: `hsl(${role.color})` }} />
                </div>
                <div>
                  <h3 className="font-serif font-semibold text-lg">{role.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                </div>
                <ul className="space-y-1.5">
                  {role.features.map((feature, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--maritime-primary))]" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            className="gap-2 min-w-[200px]"
            disabled={!selected || roleMutation.isPending}
            onClick={() => selected && roleMutation.mutate(selected)}
            data-testid="button-confirm-role"
          >
            {roleMutation.isPending ? "Setting up..." : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
