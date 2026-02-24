import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Building2, Phone, Mail, Globe, MapPin, Save, Loader2, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Port, CompanyProfile } from "@shared/schema";

const SERVICE_TYPES = [
  "Ship Agency", "Port Agency", "Husbandry Agency", "Protective Agency",
  "Ship Chandler", "Bunker Supply", "Provisions", "Technical Supply",
  "Spare Parts", "Ship Repair", "Diving Services", "Survey & Inspection",
  "Crew Services", "Legal Services", "Insurance", "Customs Clearance",
  "Freight Forwarding", "Stevedoring", "Towage", "Pilotage",
];

export default function CompanyProfilePage() {
  const { toast } = useToast();
  const { data: profile, isLoading: profileLoading } = useQuery<CompanyProfile | null>({ queryKey: ["/api/company-profile/me"] });
  const { data: ports } = useQuery<Port[]>({ queryKey: ["/api/ports"] });

  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("agent");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Turkey");
  const [selectedPorts, setSelectedPorts] = useState<number[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [portSearch, setPortSearch] = useState("");

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.companyName || "");
      setCompanyType(profile.companyType || "agent");
      setDescription(profile.description || "");
      setPhone(profile.phone || "");
      setEmail(profile.email || "");
      setWebsite(profile.website || "");
      setAddress(profile.address || "");
      setCity(profile.city || "");
      setCountry(profile.country || "Turkey");
      setSelectedPorts((profile.servedPorts as number[]) || []);
      setSelectedServices((profile.serviceTypes as string[]) || []);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (profile) {
        const res = await apiRequest("PATCH", `/api/company-profile/${profile.id}`, data);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/company-profile", data);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profile/me"] });
      toast({ title: "Profile saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save profile", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!companyName.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      companyName,
      companyType,
      description: description || null,
      phone: phone || null,
      email: email || null,
      website: website || null,
      address: address || null,
      city: city || null,
      country: country || "Turkey",
      servedPorts: selectedPorts,
      serviceTypes: selectedServices,
    });
  };

  const toggleService = (service: string) => {
    setSelectedServices(prev =>
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  const togglePort = (portId: number) => {
    setSelectedPorts(prev =>
      prev.includes(portId) ? prev.filter(p => p !== portId) : [...prev, portId]
    );
  };

  const filteredPorts = ports?.filter(p =>
    p.name.toLowerCase().includes(portSearch.toLowerCase()) ||
    p.code?.toLowerCase().includes(portSearch.toLowerCase())
  ).slice(0, 50);

  if (profileLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-profile-title">Company Profile</h1>
        <p className="text-muted-foreground text-sm">
          {profile ? "Update your company information visible to shipowners." : "Set up your company profile to appear in the directory."}
        </p>
      </div>

      <Card className="p-6 space-y-6">
        <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          Company Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Aegean Maritime Agency"
              data-testid="input-company-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Company Type</Label>
            <Select value={companyType} onValueChange={setCompanyType}>
              <SelectTrigger data-testid="select-company-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Ship Agent (Acente)</SelectItem>
                <SelectItem value="provider">Service Provider (Tedarikçi)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell shipowners about your services, experience, and expertise..."
            rows={3}
            data-testid="input-description"
          />
        </div>

        <Separator />

        <h3 className="font-semibold flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Contact Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 555 123 4567" data-testid="input-phone" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@company.com" data-testid="input-email" />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.company.com" data-testid="input-website" />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Istanbul" data-testid="input-city" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full office address" data-testid="input-address" />
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
          <Globe className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          Service Areas
        </h2>

        <div className="space-y-3">
          <Label>Service Types</Label>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TYPES.map((service) => (
              <Badge
                key={service}
                variant={selectedServices.includes(service) ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${selectedServices.includes(service) ? "bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)]" : "hover:bg-muted"}`}
                onClick={() => toggleService(service)}
                data-testid={`badge-service-${service.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {selectedServices.includes(service) && <Check className="w-3 h-3 mr-1" />}
                {service}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>Served Ports ({selectedPorts.length} selected)</Label>
          <Input
            placeholder="Search ports..."
            value={portSearch}
            onChange={(e) => setPortSearch(e.target.value)}
            data-testid="input-port-search"
          />
          {selectedPorts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPorts.map((portId) => {
                const port = ports?.find(p => p.id === portId);
                return (
                  <Badge key={portId} variant="secondary" className="gap-1 text-xs">
                    <MapPin className="w-3 h-3" />
                    {port?.name || `Port #${portId}`}
                    <button onClick={() => togglePort(portId)} className="ml-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
          <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
            {filteredPorts?.map((port) => (
              <label
                key={port.id}
                className="flex items-center gap-3 p-2.5 hover:bg-muted/50 cursor-pointer text-sm"
                data-testid={`port-option-${port.id}`}
              >
                <input
                  type="checkbox"
                  checked={selectedPorts.includes(port.id)}
                  onChange={() => togglePort(port.id)}
                  className="rounded border-gray-300"
                />
                <span className="truncate">{port.name}</span>
                {port.code && <span className="text-xs text-muted-foreground ml-auto">{port.code}</span>}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="gap-2 min-w-[180px]"
          data-testid="button-save-profile"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {profile ? "Update Profile" : "Create Profile"}
        </Button>
      </div>
    </div>
  );
}
