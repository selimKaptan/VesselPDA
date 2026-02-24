import { useQuery } from "@tanstack/react-query";
import { Ship, FileText, Globe, TrendingUp, Plus, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import type { Vessel, Proforma, Port } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: vessels, isLoading: vesselsLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: proformas, isLoading: proformasLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"] });
  const { data: ports, isLoading: portsLoading } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  const stats = [
    { label: "Vessels", value: vessels?.length || 0, icon: Ship, color: "var(--maritime-primary)", href: "/vessels" },
    { label: "Proformas", value: proformas?.length || 0, icon: FileText, color: "var(--maritime-secondary)", href: "/proformas" },
    { label: "Ports", value: ports?.length || 0, icon: Globe, color: "var(--maritime-accent)", href: "/ports" },
  ];

  const recentProformas = proformas?.slice(0, 5) || [];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-welcome">
          Welcome back, {user?.firstName || "Captain"}
        </h1>
        <p className="text-muted-foreground">
          Here's an overview of your maritime operations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="p-6 hover-elevate cursor-pointer" data-testid={`card-stat-${stat.label.toLowerCase()}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  {(vesselsLoading || proformasLoading || portsLoading) ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-3xl font-bold font-serif">{stat.value}</p>
                  )}
                </div>
                <div
                  className="w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `hsl(${stat.color} / 0.1)` }}
                >
                  <stat.icon className="w-6 h-6" style={{ color: `hsl(${stat.color})` }} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif font-semibold text-lg">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/vessels?new=true">
              <Card className="p-4 hover-elevate cursor-pointer space-y-2" data-testid="button-add-vessel-quick">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
                    <Plus className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                  </div>
                  <span className="font-medium text-sm">Add Vessel</span>
                </div>
              </Card>
            </Link>
            <Link href="/proformas/new">
              <Card className="p-4 hover-elevate cursor-pointer space-y-2" data-testid="button-new-proforma-quick">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-secondary)/0.1)] flex items-center justify-center">
                    <FileText className="w-4 h-4 text-[hsl(var(--maritime-secondary))]" />
                  </div>
                  <span className="font-medium text-sm">New Proforma</span>
                </div>
              </Card>
            </Link>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif font-semibold text-lg">Recent Proformas</h2>
            <Link href="/proformas">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid="link-view-all-proformas">
                View All <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
          {proformasLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentProformas.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No proformas yet</p>
              <Link href="/proformas/new">
                <Button variant="outline" size="sm" data-testid="button-create-first-proforma">
                  Create Your First
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProformas.map((pda) => (
                <Link key={pda.id} href={`/proformas/${pda.id}`}>
                  <div className="flex items-center justify-between gap-4 p-3 rounded-md hover-elevate cursor-pointer" data-testid={`row-proforma-${pda.id}`}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pda.referenceNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{pda.purposeOfCall} - {pda.cargoType}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">${pda.totalUsd?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{pda.status}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
