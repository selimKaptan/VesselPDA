import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Phone, Mail, Globe, MapPin, Star, Search, Filter, ExternalLink, Anchor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { CompanyProfile, Port } from "@shared/schema";

export default function Directory() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [portFilter, setPortFilter] = useState("");

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (portFilter && portFilter !== "all") params.set("portId", portFilter);
    const qs = params.toString();
    return `/api/directory${qs ? `?${qs}` : ""}`;
  };

  const { data: profiles, isLoading } = useQuery<CompanyProfile[]>({
    queryKey: ["/api/directory", typeFilter, portFilter],
    queryFn: async () => {
      const res = await fetch(buildUrl());
      if (!res.ok) throw new Error("Failed to fetch directory");
      return res.json();
    },
  });
  const { data: ports } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  const getPortName = (portId: number) => {
    return ports?.find(p => p.id === portId)?.name || `Port #${portId}`;
  };

  const filtered = profiles?.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.companyName.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      (p.serviceTypes as string[])?.some(s => s.toLowerCase().includes(q))
    );
  });

  const featured = filtered?.filter(p => p.isFeatured) || [];
  const regular = filtered?.filter(p => !p.isFeatured) || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-directory-title">
          Maritime Directory
        </h1>
        <p className="text-muted-foreground text-sm">
          Find trusted ship agents and service providers for your port operations.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, city, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-directory-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48" data-testid="select-directory-type">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            <SelectItem value="agent">Ship Agents</SelectItem>
            <SelectItem value="provider">Service Providers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={portFilter} onValueChange={setPortFilter}>
          <SelectTrigger className="w-48" data-testid="select-directory-port">
            <MapPin className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Ports" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ports</SelectItem>
            {ports?.slice(0, 100).map((port) => (
              <SelectItem key={port.id} value={String(port.id)}>{port.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h2 className="font-serif font-semibold text-lg">Featured Companies</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {featured.map(profile => (
                  <CompanyCard key={profile.id} profile={profile} getPortName={getPortName} featured />
                ))}
              </div>
              <Separator />
            </div>
          )}

          {regular.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regular.map(profile => (
                <CompanyCard key={profile.id} profile={profile} getPortName={getPortName} />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <Card className="p-12 text-center space-y-4">
              <Building2 className="w-16 h-16 text-muted-foreground/20 mx-auto" />
              <div>
                <h3 className="font-serif font-semibold text-lg">No Companies Found</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  {searchQuery ? "Try adjusting your search criteria." : "No companies have registered yet."}
                </p>
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function CompanyCard({ profile, getPortName, featured }: { profile: CompanyProfile; getPortName: (id: number) => string; featured?: boolean }) {
  const servedPorts = (profile.servedPorts as number[]) || [];
  const serviceTypes = (profile.serviceTypes as string[]) || [];

  return (
    <Card
      className={`p-6 space-y-4 hover-elevate transition-all ${featured ? "border-amber-300 dark:border-amber-700 shadow-md shadow-amber-100/50 dark:shadow-amber-900/20" : ""}`}
      data-testid={`card-company-${profile.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-md flex items-center justify-center flex-shrink-0 ${featured ? "bg-amber-100 dark:bg-amber-900/30" : "bg-[hsl(var(--maritime-primary)/0.1)]"}`}>
            {profile.companyType === "agent" ? (
              <Anchor className={`w-5 h-5 ${featured ? "text-amber-600" : "text-[hsl(var(--maritime-primary))]"}`} />
            ) : (
              <Building2 className={`w-5 h-5 ${featured ? "text-amber-600" : "text-[hsl(var(--maritime-primary))]"}`} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate" data-testid={`text-company-name-${profile.id}`}>{profile.companyName}</p>
              {featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {profile.companyType === "agent" ? "Agent" : "Provider"}
              </Badge>
              {profile.city && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" /> {profile.city}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {profile.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{profile.description}</p>
      )}

      {serviceTypes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {serviceTypes.slice(0, 4).map(s => (
            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
          ))}
          {serviceTypes.length > 4 && (
            <Badge variant="secondary" className="text-[10px]">+{serviceTypes.length - 4}</Badge>
          )}
        </div>
      )}

      {servedPorts.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{servedPorts.length} port{servedPorts.length > 1 ? "s" : ""}</span>
          {" · "}
          {servedPorts.slice(0, 3).map(id => getPortName(id)).join(", ")}
          {servedPorts.length > 3 && ` +${servedPorts.length - 3} more`}
        </div>
      )}

      <Separator />

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {profile.phone && (
          <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`link-phone-${profile.id}`}>
            <Phone className="w-3 h-3" /> {profile.phone}
          </a>
        )}
        {profile.email && (
          <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`link-email-${profile.id}`}>
            <Mail className="w-3 h-3" /> Email
          </a>
        )}
        {profile.website && (
          <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`link-website-${profile.id}`}>
            <ExternalLink className="w-3 h-3" /> Web
          </a>
        )}
      </div>
    </Card>
  );
}
