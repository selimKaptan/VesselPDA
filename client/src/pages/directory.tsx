import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Phone, Mail, Globe, MapPin, Star, Search, Filter, ExternalLink, ArrowRight, ChevronDown, ChevronUp, Ship, Anchor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import type { CompanyProfile, Port } from "@shared/schema";

const SERVICE_CATEGORIES = [
  "Ship Agency", "Port Agency", "Husbandry Agency", "Protective Agency",
  "Ship Chandler", "Bunker Supply", "Provisions", "Technical Supply",
  "Spare Parts", "Ship Repair", "Diving Services", "Survey & Inspection",
  "Crew Services", "Legal Services", "Insurance", "Customs Clearance",
  "Freight Forwarding", "Stevedoring", "Towage", "Pilotage",
];

export default function Directory() {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [portFilter, setPortFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [portSearch, setPortSearch] = useState("");
  const [showAllServices, setShowAllServices] = useState(false);

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

  const serviceCounts: Record<string, number> = {};
  profiles?.forEach(p => {
    const services = (p.serviceTypes as string[]) || [];
    services.forEach(s => {
      serviceCounts[s] = (serviceCounts[s] || 0) + 1;
    });
  });

  const filtered = profiles?.filter(p => {
    if (serviceFilter && !(p.serviceTypes as string[])?.includes(serviceFilter)) return false;
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
  const allResults = [...featured, ...regular];

  const filteredPorts = ports?.filter(p =>
    p.name.toLowerCase().includes(portSearch.toLowerCase())
  ).slice(0, 50);

  const visibleServices = showAllServices ? SERVICE_CATEGORIES : SERVICE_CATEGORIES.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      {!user && (
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2">
              <img src="/logo-v2.png" alt="VesselPDA" className="w-9 h-9 rounded-md object-contain" />
              <span className="font-serif font-bold text-lg tracking-tight">VesselPDA</span>
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</a>
              <a href="/directory" className="text-sm font-medium text-foreground transition-colors">Directory</a>
              <a href="/service-ports" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Service Ports</a>
              <a href="/forum" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Forum</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/login">
                <Button variant="outline" data-testid="button-directory-login">Log in</Button>
              </a>
              <a href="/api/login">
                <Button data-testid="button-directory-signup">Sign up</Button>
              </a>
            </div>
          </div>
        </nav>
      )}

      <div className={`max-w-7xl mx-auto px-6 ${!user ? "pt-24 pb-12" : "py-6"}`}>
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4" data-testid="breadcrumb-directory">
            <a href="/" className="hover:text-foreground transition-colors">VesselPDA</a>
            <span>/</span>
            <span className="text-foreground">
              {typeFilter === "agent" ? "Ship Agents" : typeFilter === "provider" ? "Service Providers" : "Maritime Directory"}
            </span>
          </div>
        </div>

        <div className="flex gap-8">
          <aside className="hidden lg:block w-64 flex-shrink-0 space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Filter className="w-4 h-4" />
                Filters
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Company Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full" data-testid="select-directory-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    <SelectItem value="agent">Ship Agents</SelectItem>
                    <SelectItem value="provider">Service Providers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Port(s)</label>
                <Input
                  placeholder="Search port(s)"
                  value={portSearch}
                  onChange={(e) => setPortSearch(e.target.value)}
                  className="text-sm"
                  data-testid="input-port-search-sidebar"
                />
                {portSearch && filteredPorts && filteredPorts.length > 0 && (
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y text-sm">
                    {filteredPorts.map(port => (
                      <button
                        key={port.id}
                        className={`w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm ${portFilter === String(port.id) ? "bg-[hsl(var(--maritime-primary)/0.1)] font-medium" : ""}`}
                        onClick={() => { setPortFilter(String(port.id)); setPortSearch(""); }}
                        data-testid={`port-filter-${port.id}`}
                      >
                        {port.name}
                      </button>
                    ))}
                  </div>
                )}
                {portFilter && portFilter !== "all" && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <MapPin className="w-3 h-3" />
                      {getPortName(parseInt(portFilter))}
                      <button onClick={() => setPortFilter("")} className="ml-1 hover:text-destructive">&times;</button>
                    </Badge>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">Service Categories</span>
              </div>
              <div className="space-y-1">
                {visibleServices.map(service => (
                  <button
                    key={service}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors ${serviceFilter === service ? "bg-[hsl(var(--maritime-primary)/0.1)] text-[hsl(var(--maritime-primary))] font-medium" : "hover:bg-muted/50 text-muted-foreground"}`}
                    onClick={() => setServiceFilter(serviceFilter === service ? "" : service)}
                    data-testid={`filter-service-${service.replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    <span className="truncate">{service}</span>
                    {serviceCounts[service] && (
                      <span className="text-xs text-muted-foreground ml-2">{serviceCounts[service]}</span>
                    )}
                  </button>
                ))}
              </div>
              {SERVICE_CATEGORIES.length > 8 && (
                <button
                  onClick={() => setShowAllServices(!showAllServices)}
                  className="flex items-center gap-1 text-xs text-[hsl(var(--maritime-primary))] hover:underline"
                >
                  {showAllServices ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllServices ? "Show less" : `Show all (${SERVICE_CATEGORIES.length})`}
                </button>
              )}
              {serviceFilter && (
                <button
                  onClick={() => setServiceFilter("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear filter
                </button>
              )}
            </Card>
          </aside>

          <div className="flex-1 min-w-0 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight" data-testid="text-directory-title">
                  {typeFilter === "agent" ? "Ship Agents" : typeFilter === "provider" ? "Service Providers" : "Maritime Directory"}
                </h1>
                {allResults.length > 0 && (
                  <p className="text-muted-foreground text-sm mt-1" data-testid="text-directory-count">
                    Showing <strong>{allResults.length}</strong> {allResults.length === 1 ? "company" : "companies"}
                    {serviceFilter && <> in <strong>{serviceFilter}</strong></>}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-directory-search"
                />
              </div>
              <Button variant="default" className="gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)]" data-testid="button-search">
                <Search className="w-4 h-4" />
                Search
              </Button>
            </div>

            <div className="lg:hidden flex flex-wrap gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40" data-testid="select-directory-type-mobile">
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
                <SelectTrigger className="w-40" data-testid="select-directory-port">
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
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40" />)}
              </div>
            ) : allResults.length > 0 ? (
              <div className="space-y-4">
                {allResults.map(profile => (
                  <CompanyCard key={profile.id} profile={profile} getPortName={getPortName} isFeatured={profile.isFeatured} />
                ))}
              </div>
            ) : (
              <Card className="p-12 text-center space-y-4">
                <Building2 className="w-16 h-16 text-muted-foreground/20 mx-auto" />
                <div>
                  <h3 className="font-serif font-semibold text-lg">No Companies Found</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {searchQuery || serviceFilter ? "Try adjusting your search criteria or filters." : "No companies have registered yet. Be the first!"}
                  </p>
                  {!user && (
                    <a href="/api/login">
                      <Button className="mt-4 gap-2" data-testid="button-register-cta">
                        Register Your Company
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyCard({ profile, getPortName, isFeatured }: { profile: CompanyProfile; getPortName: (id: number) => string; isFeatured: boolean }) {
  const servedPorts = (profile.servedPorts as number[]) || [];
  const serviceTypes = (profile.serviceTypes as string[]) || [];

  return (
    <Card
      className={`overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${isFeatured ? "ring-1 ring-amber-300/60 dark:ring-amber-700/60" : ""}`}
      data-testid={`card-company-${profile.id}`}
    >
      {isFeatured && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-1.5 flex items-center gap-2">
          <Star className="w-3 h-3 text-white fill-white flex-shrink-0" />
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">Featured Company</span>
        </div>
      )}
      <div className="p-5 flex items-start gap-4">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border ${isFeatured ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/40" : "bg-[hsl(var(--maritime-primary)/0.06)] border-[hsl(var(--maritime-primary)/0.12)]"}`}>
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt={profile.companyName} className="w-full h-full object-contain" data-testid={`img-company-logo-${profile.id}`} />
          ) : profile.companyType === "agent" ? (
            <Anchor className={`w-7 h-7 ${isFeatured ? "text-amber-600" : "text-[hsl(var(--maritime-primary))]"}`} />
          ) : (
            <Building2 className={`w-7 h-7 ${isFeatured ? "text-amber-600" : "text-[hsl(var(--maritime-primary))]"}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base" data-testid={`text-company-name-${profile.id}`}>{profile.companyName}</h3>
              </div>
              {serviceTypes.length > 0 && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  <span className="font-medium text-foreground/80">Services provided: </span>
                  {serviceTypes.join(", ")}
                </p>
              )}
              {profile.description && serviceTypes.length === 0 && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{profile.description}</p>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="flex-shrink-0 gap-1.5 hover:border-[hsl(var(--maritime-primary)/0.4)] hover:text-[hsl(var(--maritime-primary))]"
              data-testid={`button-view-${profile.id}`}
              onClick={() => {}}
            >
              {profile.companyType === "agent" ? "View Agent" : "View Provider"}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
            {servedPorts.length > 0 && (
              <span className="flex items-center gap-1">
                <Ship className="w-3.5 h-3.5" />
                {servedPorts.length} port{servedPorts.length > 1 ? "s" : ""}
              </span>
            )}
            {profile.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.city}{profile.country ? `, ${profile.country}` : ""}
              </span>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`link-phone-${profile.id}`}>
                <Phone className="w-3.5 h-3.5" /> {profile.phone}
              </a>
            )}
            {profile.email && (
              <a href={`mailto:${profile.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`link-email-${profile.id}`}>
                <Mail className="w-3.5 h-3.5" /> {profile.email}
              </a>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors" data-testid={`link-website-${profile.id}`}>
                <Globe className="w-3.5 h-3.5" /> Website
              </a>
            )}
          </div>

          {servedPorts.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              <span className="font-medium">Served Ports: </span>
              {servedPorts.slice(0, 4).map(id => getPortName(id)).join(", ")}
              {servedPorts.length > 4 && ` and +${servedPorts.length - 4} more`}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
