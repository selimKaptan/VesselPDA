import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, MapPin, Building2, Phone, Mail, Globe, Star, ChevronDown, ChevronUp, Ship, Users, X, ExternalLink, Anchor } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface ServicePortCompany {
  id: number;
  companyName: string;
  companyType: string;
  serviceTypes: string[];
  city: string | null;
  country: string | null;
  isFeatured: boolean;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
}

interface CompanyProfile {
  id: number;
  companyName: string;
  companyType: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  servedPorts: number[];
  serviceTypes: string[];
  logoUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  createdAt: string | null;
}

interface ServicePortEntry {
  port: { id: number; name: string; unlocode: string | null; region: string | null };
  companies: ServicePortCompany[];
}

export default function ServicePorts() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPort, setExpandedPort] = useState<number | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  const { data: servicePorts, isLoading } = useQuery<ServicePortEntry[]>({
    queryKey: ["/api/service-ports"],
  });

  const { data: companyDetail } = useQuery<CompanyProfile>({
    queryKey: ["/api/directory", selectedCompanyId],
    enabled: !!selectedCompanyId,
  });

  const filtered = servicePorts?.filter(entry => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.port.name.toLowerCase().includes(q) ||
      entry.port.unlocode?.toLowerCase().includes(q) ||
      entry.port.region?.toLowerCase().includes(q) ||
      entry.companies.some(c => c.companyName.toLowerCase().includes(q))
    );
  });

  const togglePort = (portId: number) => {
    setExpandedPort(prev => prev === portId ? null : portId);
  };

  return (
    <div className="min-h-screen bg-background">
      {!user && (
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2" data-testid="link-home">
              <img src="/logo-v2.png" alt="VesselPDA" className="w-9 h-9 rounded-md object-contain" />
              <span className="font-serif font-bold text-lg tracking-tight">VesselPDA</span>
            </a>
            <div className="hidden md:flex items-center gap-8">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-home">Home</a>
              <a href="/directory" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-nav-directory">Directory</a>
              <a href="/service-ports" className="text-sm font-medium text-foreground transition-colors" data-testid="link-nav-service-ports">Service Ports</a>
            </div>
            <div className="flex items-center gap-3">
              <a href="/api/login">
                <Button variant="outline" data-testid="button-service-ports-login">Log in</Button>
              </a>
              <a href="/api/login">
                <Button data-testid="button-service-ports-signup">Sign up</Button>
              </a>
            </div>
          </div>
        </nav>
      )}

      <div className={`border-b bg-gradient-to-r from-[hsl(var(--maritime-primary)/0.03)] to-transparent ${!user ? "mt-16" : ""}`}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
              <Anchor className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-service-ports-title">
                Service Ports
              </h1>
              <p className="text-sm text-muted-foreground">
                Ports where our registered agents and service providers operate
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search ports, regions, or companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-service-ports"
            />
          </div>
          {filtered && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-port-count">
              {filtered.length} port{filtered.length !== 1 ? "s" : ""} with services
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !filtered?.length ? (
          <Card className="p-12 text-center">
            <Anchor className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium mb-2">No Service Ports Found</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Try a different search term." : "No companies have registered their service ports yet."}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => {
              const isExpanded = expandedPort === entry.port.id;
              const agents = entry.companies.filter(c => c.companyType === "agent");
              const providers = entry.companies.filter(c => c.companyType === "provider");

              return (
                <div key={entry.port.id} data-testid={`card-service-port-${entry.port.id}`}>
                  <button
                    onClick={() => togglePort(entry.port.id)}
                    className="w-full text-left"
                    data-testid={`button-toggle-port-${entry.port.id}`}
                  >
                    <Card className={`p-4 transition-colors hover:bg-muted/50 ${isExpanded ? "border-[hsl(var(--maritime-primary)/0.3)] bg-muted/30" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
                            <MapPin className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{entry.port.name}</span>
                              {entry.port.unlocode && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                                  {entry.port.unlocode}
                                </Badge>
                              )}
                            </div>
                            {entry.port.region && (
                              <p className="text-xs text-muted-foreground">{entry.port.region}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {agents.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Ship className="w-3.5 h-3.5" />
                                {agents.length} agent{agents.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {providers.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                {providers.length} provider{providers.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </Card>
                  </button>

                  {isExpanded && (
                    <div className="mt-1 ml-6 space-y-3 pb-2" data-testid={`panel-port-companies-${entry.port.id}`}>
                      {agents.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2 mt-3">
                            <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Ship Agents ({agents.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {agents.map(company => (
                              <CompanyCard key={company.id} company={company} onSelect={() => setSelectedCompanyId(company.id)} />
                            ))}
                          </div>
                        </div>
                      )}

                      {providers.length > 0 && (
                        <div>
                          {agents.length > 0 && <Separator className="my-3" />}
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-[hsl(var(--maritime-secondary))]" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Service Providers ({providers.length})
                            </span>
                          </div>
                          <div className="space-y-2">
                            {providers.map(company => (
                              <CompanyCard key={company.id} company={company} onSelect={() => setSelectedCompanyId(company.id)} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedCompanyId} onOpenChange={(open) => { if (!open) setSelectedCompanyId(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {companyDetail ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  {companyDetail.logoUrl ? (
                    <div className="w-14 h-14 rounded-lg border overflow-hidden flex-shrink-0 bg-white flex items-center justify-center">
                      <img src={companyDetail.logoUrl} alt={companyDetail.companyName} className="w-full h-full object-contain" data-testid="img-detail-logo" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                      {companyDetail.companyType === "agent" ? (
                        <Ship className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
                      ) : (
                        <Building2 className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="font-serif text-lg" data-testid="text-detail-company-name">
                      {companyDetail.companyName}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {companyDetail.companyType === "agent" ? "Ship Agent" : "Service Provider"}
                      </Badge>
                      {companyDetail.isFeatured && (
                        <Badge className="bg-amber-500 text-white text-[10px] gap-1">
                          <Star className="w-2.5 h-2.5 fill-white" /> Featured
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {companyDetail.description && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">About</p>
                    <p className="text-sm text-foreground leading-relaxed" data-testid="text-detail-description">{companyDetail.description}</p>
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Information</p>
                  <div className="grid gap-2.5">
                    {companyDetail.address && (
                      <div className="flex items-start gap-3 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span data-testid="text-detail-address">
                          {companyDetail.address}
                          {companyDetail.city && `, ${companyDetail.city}`}
                          {companyDetail.country && `, ${companyDetail.country}`}
                        </span>
                      </div>
                    )}
                    {!companyDetail.address && (companyDetail.city || companyDetail.country) && (
                      <div className="flex items-center gap-3 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span>{[companyDetail.city, companyDetail.country].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {companyDetail.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <a href={`tel:${companyDetail.phone}`} className="hover:text-[hsl(var(--maritime-primary))] transition-colors" data-testid="link-detail-phone">
                          {companyDetail.phone}
                        </a>
                      </div>
                    )}
                    {companyDetail.email && (
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <a href={`mailto:${companyDetail.email}`} className="hover:text-[hsl(var(--maritime-primary))] transition-colors" data-testid="link-detail-email">
                          {companyDetail.email}
                        </a>
                      </div>
                    )}
                    {companyDetail.website && (
                      <div className="flex items-center gap-3 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <a href={companyDetail.website.startsWith("http") ? companyDetail.website : `https://${companyDetail.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-[hsl(var(--maritime-primary))] transition-colors flex items-center gap-1" data-testid="link-detail-website">
                          {companyDetail.website} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {companyDetail.serviceTypes && companyDetail.serviceTypes.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Services</p>
                      <div className="flex flex-wrap gap-1.5" data-testid="badges-detail-services">
                        {(companyDetail.serviceTypes as string[]).map(s => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {companyDetail.createdAt && (
                  <p className="text-[11px] text-muted-foreground text-right pt-2">
                    Member since {new Date(companyDetail.createdAt).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                  </p>
                )}
              </div>

              <DialogFooter className="mt-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setSelectedCompanyId(null);
                    navigate(`/directory/${companyDetail.id}`);
                  }}
                  data-testid="button-view-full-profile"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Profile
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-8 space-y-3">
              <Skeleton className="h-14 w-14 rounded-lg" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyCard({ company, onSelect }: { company: ServicePortCompany; onSelect: () => void }) {
  return (
    <Card
      className={`p-3 cursor-pointer transition-all hover:shadow-md hover:border-[hsl(var(--maritime-primary)/0.3)] ${company.isFeatured ? "border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10" : ""}`}
      onClick={onSelect}
      data-testid={`card-company-${company.id}`}
    >
      <div className="flex items-start gap-3">
        {company.logoUrl ? (
          <div className="w-9 h-9 rounded-md border overflow-hidden flex-shrink-0 bg-white flex items-center justify-center">
            <img src={company.logoUrl} alt={company.companyName} className="w-full h-full object-contain" data-testid={`img-service-logo-${company.id}`} />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-md bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0">
            {company.companyType === "agent" ? (
              <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
            ) : (
              <Building2 className="w-4 h-4 text-[hsl(var(--maritime-secondary))]" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm truncate">{company.companyName}</span>
            {company.isFeatured && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
            )}
          </div>
          {(company.city || company.country) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
              <MapPin className="w-3 h-3" />
              {[company.city, company.country].filter(Boolean).join(", ")}
            </p>
          )}
          {company.serviceTypes?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(company.serviceTypes as string[]).slice(0, 4).map(s => (
                <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">{s}</Badge>
              ))}
              {company.serviceTypes.length > 4 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{company.serviceTypes.length - 4}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {company.phone && (
            <span className="text-muted-foreground" data-testid={`icon-phone-${company.id}`}>
              <Phone className="w-3.5 h-3.5" />
            </span>
          )}
          {company.email && (
            <span className="text-muted-foreground" data-testid={`icon-email-${company.id}`}>
              <Mail className="w-3.5 h-3.5" />
            </span>
          )}
          {company.website && (
            <span className="text-muted-foreground" data-testid={`icon-website-${company.id}`}>
              <Globe className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
