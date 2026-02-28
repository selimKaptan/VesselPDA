import { useQuery } from "@tanstack/react-query";
import { Globe, MapPin, DollarSign, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Port } from "@shared/schema";

export default function Ports() {
  const { data: ports, isLoading } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-ports-title">Ports & Tariffs</h1>
        <p className="text-muted-foreground text-sm">View available ports and their tariff data for proforma calculations.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : ports && ports.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ports.map((port) => (
            <Card key={port.id} className="p-6 space-y-4 hover-elevate" data-testid={`card-port-${port.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-[hsl(var(--maritime-accent)/0.1)] flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-[hsl(var(--maritime-accent))]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate" data-testid={`text-port-name-${port.id}`}>{port.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{port.country}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  <DollarSign className="w-3 h-3 mr-0.5" />
                  {port.currency}
                </Badge>
              </div>
              {port.code && (
                <p className="text-xs text-muted-foreground">Port Code: {port.code}</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center space-y-4">
          <Globe className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <div>
            <h3 className="font-serif font-semibold text-lg">No Ports Available</h3>
            <p className="text-muted-foreground text-sm mt-1">Port data will be added by the system administrator.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
