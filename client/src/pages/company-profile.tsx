import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Building2, Phone, Mail, Globe, MapPin, Save, Loader2, Check, X, Upload, Trash2, Image, Landmark } from "lucide-react";
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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [bankCurrency, setBankCurrency] = useState("USD");
  const [bankBranchName, setBankBranchName] = useState("");

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
      setLogoPreview(profile.logoUrl || null);
      setBankName((profile as any).bankName || "");
      setBankAccountName((profile as any).bankAccountName || "");
      setBankIban((profile as any).bankIban || "");
      setBankSwift((profile as any).bankSwift || "");
      setBankCurrency((profile as any).bankCurrency || "USD");
      setBankBranchName((profile as any).bankBranchName || "");
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

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);
      const res = await fetch("/api/company-profile/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLogoPreview(data.logoUrl);
      queryClient.invalidateQueries({ queryKey: ["/api/company-profile/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/directory"] });
      toast({ title: "Logo uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to upload logo", description: error.message, variant: "destructive" });
    },
  });

  const logoDeleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/company-profile/logo");
      return res.json();
    },
    onSuccess: () => {
      setLogoPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/company-profile/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/directory"] });
      toast({ title: "Logo removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove logo", description: error.message, variant: "destructive" });
    },
  });

  const saveBankMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/company-profile/bank-details", {
        bankName: bankName || null,
        bankAccountName: bankAccountName || null,
        bankIban: bankIban || null,
        bankSwift: bankSwift || null,
        bankCurrency: bankCurrency || "USD",
        bankBranchName: bankBranchName || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profile/me"] });
      toast({ title: "Bank details saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save bank details", description: error.message, variant: "destructive" });
    },
  });

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 2MB", variant: "destructive" });
      return;
    }
    if (!profile) {
      toast({ title: "Save your profile first", description: "Create your company profile before uploading a logo", variant: "destructive" });
      return;
    }
    logoUploadMutation.mutate(file);
  };

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
      <div className="px-3 py-5 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="px-3 py-5 space-y-6 max-w-6xl mx-auto">
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

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Image className="w-4 h-4" />
            Company Logo
          </Label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/30 flex-shrink-0">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Company logo"
                  className="w-full h-full object-contain"
                  data-testid="img-logo-preview"
                />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground/30" />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoSelect}
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  className="hidden"
                  data-testid="input-logo-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploadMutation.isPending || !profile}
                  className="gap-1.5"
                  data-testid="button-upload-logo"
                >
                  {logoUploadMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {logoPreview ? "Change Logo" : "Upload Logo"}
                </Button>
                {logoPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => logoDeleteMutation.mutate()}
                    disabled={logoDeleteMutation.isPending}
                    className="gap-1.5 text-destructive hover:text-destructive"
                    data-testid="button-remove-logo"
                  >
                    {logoDeleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WEBP, or SVG. Max 2MB.{!profile && " Save your profile first to upload a logo."}
              </p>
            </div>
          </div>
        </div>

        <Separator />

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
                <SelectItem value="agent">Ship Agent</SelectItem>
                <SelectItem value="provider">Service Provider</SelectItem>
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

      <Card className="p-6 space-y-6">
        <h2 className="font-serif font-semibold text-lg flex items-center gap-2">
          <Landmark className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          Bank Details
        </h2>
        <p className="text-sm text-muted-foreground -mt-4">Used for auto-fill in Proforma, SOF and FDA PDF exports.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bank Name</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Ziraat Bank" data-testid="input-bank-name" />
          </div>
          <div className="space-y-2">
            <Label>Account Name / Beneficiary</Label>
            <Input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} placeholder="Company or person name" data-testid="input-bank-account-name" />
          </div>
          <div className="space-y-2">
            <Label>IBAN</Label>
            <Input value={bankIban} onChange={(e) => setBankIban(e.target.value)} placeholder="TR00 0000 0000 0000 0000 0000 00" data-testid="input-bank-iban" />
          </div>
          <div className="space-y-2">
            <Label>SWIFT / BIC Code</Label>
            <Input value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} placeholder="e.g. TCZBTR2A" data-testid="input-bank-swift" />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={bankCurrency} onValueChange={setBankCurrency}>
              <SelectTrigger data-testid="select-bank-currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — US Dollar</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
                <SelectItem value="TRY">TRY — Turkish Lira</SelectItem>
                <SelectItem value="GBP">GBP — British Pound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Branch Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input value={bankBranchName} onChange={(e) => setBankBranchName(e.target.value)} placeholder="e.g. Istanbul Main Branch" data-testid="input-bank-branch" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => saveBankMutation.mutate()}
            disabled={saveBankMutation.isPending || profileLoading}
            className="gap-2"
            data-testid="button-save-bank-details"
          >
            {saveBankMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Bank Details
          </Button>
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
