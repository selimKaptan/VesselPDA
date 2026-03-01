import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageMeta } from "@/components/page-meta";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Gavel, Plus, Clock, FileText, Ship, MapPin, ChevronRight,
  AlertCircle, CheckCircle2, XCircle, Inbox, Send, Anchor, Upload, X, Search,
  Building2, Trophy, Calendar
} from "lucide-react";
import type { Vessel } from "@shared/schema";

function useCountdown(createdAt: string, expiryHours: number) {
  const [remaining, setRemaining] = useState("");
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const expiresAt = new Date(createdAt).getTime() + expiryHours * 3600000;
    const update = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        setExpired(true);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}m left`);
      setExpired(false);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [createdAt, expiryHours]);

  return { remaining, expired };
}

function TenderCard({ tender, role, myBidStatus, isOwnTender }: { tender: any; role: string; myBidStatus?: string; isOwnTender?: boolean }) {
  const [, navigate] = useLocation();
  const { remaining, expired } = useCountdown(tender.createdAt, tender.expiryHours);

  const hasNewBids = role === "shipowner" && tender.status === "open" && tender.pendingBidCount > 0;

  const statusColor = {
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-blue-100 text-blue-700",
    cancelled: "bg-red-100 text-red-700",
    nominated: "bg-purple-100 text-purple-700",
  }[tender.status as string] || "bg-gray-100 text-gray-700";

  const statusLabel = {
    open: "Open",
    closed: "Closed",
    cancelled: "Cancelled",
    nominated: "Nominated",
  }[tender.status as string] || tender.status;

  const bidStatusIcon = myBidStatus === "selected"
    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
    : myBidStatus === "rejected"
    ? <XCircle className="w-4 h-4 text-red-500" />
    : myBidStatus === "pending"
    ? <Clock className="w-4 h-4 text-amber-500" />
    : null;

  return (
    <Card
      className={`p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer ${hasNewBids ? "border-amber-300 ring-1 ring-amber-300 dark:border-amber-600 dark:ring-amber-600" : "border-border/60"}`}
      onClick={() => navigate(`/tenders/${tender.id}`)}
      data-testid={`card-tender-${tender.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${hasNewBids ? "bg-amber-100 dark:bg-amber-900/30" : "bg-[hsl(var(--maritime-primary)/0.08)]"}`}>
            <Gavel className={`w-5 h-5 ${hasNewBids ? "text-amber-600" : "text-[hsl(var(--maritime-primary))]"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              {tender.vesselName && (
                <span className="font-bold text-base" data-testid={`text-tender-vessel-${tender.id}`}>
                  {tender.vesselName}
                </span>
              )}
              <Badge className={`text-[10px] border-0 ${statusColor}`}>{statusLabel}</Badge>
              {isOwnTender && (
                <Badge className="text-[10px] border-0 bg-amber-100 text-amber-700">Your Tender</Badge>
              )}
              {myBidStatus && (
                <div className="flex items-center gap-1">
                  {bidStatusIcon}
                  <span className="text-xs text-muted-foreground">
                    {myBidStatus === "selected" ? "Your bid was selected!" : myBidStatus === "rejected" ? "Rejected" : "Under Review"}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Ship className="w-3 h-3" />
              <span data-testid={`text-tender-port-${tender.id}`}>{tender.portName}</span>
            </div>
            {hasNewBids && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 text-white animate-pulse" data-testid={`badge-new-bids-${tender.id}`}>
                  🔔 {tender.pendingBidCount} Yeni Teklif
                </span>
              </div>
            )}
            {!hasNewBids && tender.cargoInfo && (
              <p className="text-xs text-muted-foreground line-clamp-1">{tender.cargoInfo}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className={`flex items-center gap-1 text-xs font-medium ${expired || tender.status !== "open" ? "text-muted-foreground" : "text-amber-600"}`}>
            <Clock className="w-3.5 h-3.5" />
            {tender.status === "open" ? remaining : statusLabel}
          </div>
          {role === "shipowner" && !hasNewBids && tender.bidCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {tender.bidCount} bids
            </Badge>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Card>
  );
}

const EMPTY_FORM = {
  portId: "", vesselName: "", description: "", cargoInfo: "",
  grt: "", nrt: "", flag: "", cargoType: "", cargoQuantity: "",
  previousPort: "", q88Base64: "", q88FileName: "", expiryHours: "24",
};

function CreateTenderDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [portSearch, setPortSearch] = useState("");
  const [showPortDropdown, setShowPortDropdown] = useState(false);
  const [vesselSearch, setVesselSearch] = useState("");
  const [showVesselDropdown, setShowVesselDropdown] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const portRef = useRef<HTMLDivElement>(null);
  const vesselRef = useRef<HTMLDivElement>(null);
  const q88Ref = useRef<HTMLInputElement>(null);

  const { data: portResults } = useQuery<any[]>({
    queryKey: ["/api/ports", portSearch],
    queryFn: async () => {
      if (portSearch.trim().length < 2) return [];
      const res = await fetch(`/api/ports?q=${encodeURIComponent(portSearch.trim())}`);
      return res.json();
    },
    enabled: portSearch.trim().length >= 2,
  });
  const filteredPorts = portResults || [];
  const { data: myVessels } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });

  const filteredVessels = (myVessels || []).filter((v: Vessel) =>
    v.name.toLowerCase().includes(vesselSearch.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (portRef.current && !portRef.current.contains(e.target as Node)) setShowPortDropdown(false);
      if (vesselRef.current && !vesselRef.current.contains(e.target as Node)) setShowVesselDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tenders", data),
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({ title: "Tender created!", description: `Sent to ${data.agentCount} agents.` });
      setOpen(false);
      setForm(EMPTY_FORM);
      setPortSearch(""); setVesselSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
    },
    onError: async (err: any) => {
      const data = await err.response?.json().catch(() => ({}));
      toast({ title: "Error", description: data.message || "Could not create tender", variant: "destructive" });
    },
  });

  const handleQ88Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "File must be under 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, q88Base64: ev.target?.result as string, q88FileName: file.name }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    const required: [string, string][] = [
      [form.portId, "Please select a port"],
      [form.vesselName, "Please enter vessel name"],
      [form.flag, "Please enter flag"],
      [form.grt, "Please enter GRT"],
      [form.nrt, "Please enter NRT"],
      [form.cargoType, "Please enter cargo type"],
      [form.cargoQuantity, "Please enter cargo quantity"],
      [form.previousPort, "Please enter previous port"],
    ];
    for (const [val, msg] of required) {
      if (!val) { toast({ title: "Missing Field", description: msg, variant: "destructive" }); return; }
    }
    mutation.mutate({
      portId: Number(form.portId),
      vesselName: form.vesselName,
      flag: form.flag,
      grt: Number(form.grt),
      nrt: Number(form.nrt),
      cargoType: form.cargoType,
      cargoQuantity: form.cargoQuantity,
      previousPort: form.previousPort,
      q88Base64: form.q88Base64 || null,
      description: form.description || null,
      expiryHours: Number(form.expiryHours),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-tender">
          <Plus className="w-4 h-4" /> Create New Tender
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-tender">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
            Port Proforma Tender
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">

          {/* PORT SEARCH */}
          <div className="space-y-1.5" ref={portRef}>
            <Label>Destination Port <span className="text-red-500">*</span></Label>
            <div className="relative">
              <Input
                placeholder="Search destination port..."
                value={portSearch}
                onChange={e => { setPortSearch(e.target.value); setShowPortDropdown(true); setForm(f => ({ ...f, portId: "" })); }}
                onFocus={() => { if (portSearch) setShowPortDropdown(true); }}
                data-testid="input-port-search"
              />
              {showPortDropdown && portSearch.trim().length >= 2 && (
                <div className="absolute z-50 w-full border rounded-md shadow-lg bg-popover max-h-64 overflow-y-auto divide-y mt-1">
                  {filteredPorts.length === 0 && <p className="p-3 text-sm text-muted-foreground">No results — try a different name or LOCODE</p>}
                  {filteredPorts.map((p: any) => {
                    const flag = p.country === "Turkey" ? "🇹🇷"
                      : p.country?.length === 2
                        ? String.fromCodePoint(0x1F1E6 + p.country.charCodeAt(0) - 65) + String.fromCodePoint(0x1F1E6 + p.country.charCodeAt(1) - 65)
                        : "🌍";
                    const countryLabel = p.country === "Turkey" ? "Turkey (TR)"
                      : p.country?.length === 2 ? `(${p.country})`
                      : p.country || "";
                    return (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors flex items-center gap-3"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setForm(f => ({ ...f, portId: String(p.id) }));
                          setPortSearch(p.name);
                          setShowPortDropdown(false);
                        }}
                        data-testid={`option-port-${p.id}`}
                      >
                        <span className="text-xl flex-shrink-0 leading-none">{flag}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {countryLabel}{p.code ? `, Unlocode: ${p.code}` : ""}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {form.portId && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Port selected
              </p>
            )}
          </div>

          {/* VESSEL NAME + FLAG */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5" ref={vesselRef}>
              <Label>Vessel Name <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  placeholder="MV EXAMPLE"
                  value={vesselSearch}
                  onChange={e => {
                    setVesselSearch(e.target.value);
                    setForm(f => ({ ...f, vesselName: e.target.value }));
                    setShowVesselDropdown(true);
                  }}
                  onFocus={() => { if (myVessels?.length) setShowVesselDropdown(true); }}
                  data-testid="input-vessel-name"
                />
                {showVesselDropdown && filteredVessels.length > 0 && (
                  <div className="absolute z-50 w-full border rounded-md shadow-lg bg-popover max-h-40 overflow-y-auto divide-y mt-1">
                    {filteredVessels.map((v: Vessel) => (
                      <button
                        key={v.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setVesselSearch(v.name);
                          setForm(f => ({
                            ...f,
                            vesselName: v.name,
                            grt: String(v.grt || ""),
                            nrt: String(v.nrt || ""),
                            flag: v.flag || "",
                          }));
                          setShowVesselDropdown(false);
                        }}
                        data-testid={`option-vessel-${v.id}`}
                      >
                        <span className="font-medium">{v.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">{v.flag}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Flag <span className="text-red-500">*</span></Label>
              <Input
                placeholder="Turkey"
                value={form.flag}
                onChange={e => setForm(f => ({ ...f, flag: e.target.value }))}
                data-testid="input-flag"
              />
            </div>
          </div>

          {/* GRT + NRT */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>GRT <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. 5000"
                type="number"
                value={form.grt}
                onChange={e => setForm(f => ({ ...f, grt: e.target.value }))}
                data-testid="input-grt"
              />
            </div>
            <div className="space-y-1.5">
              <Label>NRT <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. 3000"
                type="number"
                value={form.nrt}
                onChange={e => setForm(f => ({ ...f, nrt: e.target.value }))}
                data-testid="input-nrt"
              />
            </div>
          </div>

          {/* CARGO TYPE + CARGO QUANTITY */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cargo Type <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Grain, Coal, Steel"
                value={form.cargoType}
                onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))}
                data-testid="input-cargo-type"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo Quantity <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. 15,000 MT"
                value={form.cargoQuantity}
                onChange={e => setForm(f => ({ ...f, cargoQuantity: e.target.value }))}
                data-testid="input-cargo-quantity"
              />
            </div>
          </div>

          {/* PREVIOUS PORT */}
          <div className="space-y-1.5">
            <Label>Previous Port <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. Novorossiysk, Russia"
              value={form.previousPort}
              onChange={e => setForm(f => ({ ...f, previousPort: e.target.value }))}
              data-testid="input-previous-port"
            />
          </div>

          {/* Q88 UPLOAD (optional) */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Q88 Form
              <span className="text-[10px] text-muted-foreground font-normal">(optional, PDF / JPG, max 5MB)</span>
            </Label>
            <input ref={q88Ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleQ88Upload} />
            {form.q88Base64 ? (
              <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm text-emerald-700 dark:text-emerald-400 truncate flex-1">{form.q88FileName}</span>
                <button onClick={() => setForm(f => ({ ...f, q88Base64: "", q88FileName: "" }))} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => q88Ref.current?.click()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-3 text-sm text-muted-foreground hover:border-[hsl(var(--maritime-primary)/0.4)] hover:text-[hsl(var(--maritime-primary))] transition-colors"
                data-testid="button-upload-q88"
              >
                <Upload className="w-4 h-4" />
                Upload Q88 Form
              </button>
            )}
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-1.5">
            <Label>Description / Notes</Label>
            <Textarea
              placeholder="Additional information and requirements..."
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              data-testid="input-description"
            />
          </div>

          {/* EXPIRY */}
          <div className="space-y-2">
            <Label>Tender Duration <span className="text-red-500">*</span></Label>
            <RadioGroup value={form.expiryHours} onValueChange={v => setForm(f => ({ ...f, expiryHours: v }))} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="24" id="exp-24" data-testid="radio-24h" />
                <Label htmlFor="exp-24" className="cursor-pointer font-normal">24 Hours</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="48" id="exp-48" data-testid="radio-48h" />
                <Label htmlFor="exp-48" className="cursor-pointer font-normal">48 Hours</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-400">
              When the tender is created, it will automatically be sent to all agents registered at your selected port.
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="w-full"
            data-testid="button-submit-tender"
          >
            {mutation.isPending ? "Creating..." : "Create & Send Tender"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TendersPage() {
  const { data, isLoading } = useQuery<{ role: string; tenders: any[]; ownUserId?: string }>({ queryKey: ["/api/tenders"] });
  const { data: myBids } = useQuery<any[]>({ queryKey: ["/api/tenders/my-bids"] });
  const [searchText, setSearchText] = useState("");
  const [cargoFilter, setCargoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");

  const role = data?.role || "shipowner";
  const tenders = data?.tenders || [];
  const ownUserId = data?.ownUserId;

  const filtered = tenders.filter(t => {
    const q = searchText.toLowerCase();
    const matchesSearch = !q || (t.vesselName || "").toLowerCase().includes(q) || (t.portName || "").toLowerCase().includes(q);
    const matchesCargo = !cargoFilter || (t.cargoType || "").toLowerCase().includes(cargoFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "open" ? t.status === "open" : t.status !== "open");
    return matchesSearch && matchesCargo && matchesStatus;
  });

  const openTenders = filtered.filter(t => t.status === "open");
  const closedTenders = filtered.filter(t => t.status !== "open").sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const activeFilters = [searchText, cargoFilter, statusFilter !== "all" ? statusFilter : ""].filter(Boolean).length;

  const getMyBidStatus = (tenderId: number) => {
    if (!myBids) return undefined;
    const bid = myBids.find((b: any) => b.tenderId === tenderId);
    return bid?.status;
  };

  const clearFilters = () => { setSearchText(""); setCargoFilter(""); setStatusFilter("all"); };

  return (
    <div className="flex flex-col gap-6 px-3 py-5 max-w-6xl mx-auto">
      <PageMeta title="Port Call Tenders | VesselPDA" description="Create and manage port call tenders, receive bids from agents worldwide." />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="w-6 h-6 text-[hsl(var(--maritime-primary))]" />
            {role === "agent" ? "Port Tenders" : "Proforma Tenders"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === "agent"
              ? "Open tenders at ports you serve"
              : "Your submitted tender requests"}
          </p>
        </div>
        {role !== "agent" && <CreateTenderDialog />}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search vessel or port..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-tender-search"
          />
        </div>
        <Input
          placeholder="Cargo type..."
          value={cargoFilter}
          onChange={e => setCargoFilter(e.target.value)}
          className="h-9 w-36"
          data-testid="input-cargo-filter"
        />
        <div className="flex rounded-md border text-xs overflow-hidden">
          {(["all", "open", "closed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 capitalize transition-colors ${statusFilter === s ? "bg-[hsl(var(--maritime-primary))] text-white" : "bg-background hover:bg-muted"}`}
              data-testid={`filter-status-${s}`}
            >
              {s}
            </button>
          ))}
        </div>
        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-clear-filters"
          >
            <X className="w-3.5 h-3.5" />
            Clear ({activeFilters})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : role === "agent" ? (
        <Tabs defaultValue="available">
          <TabsList>
            <TabsTrigger value="available" data-testid="tab-available">
              Open Tenders
              {openTenders.length > 0 && (
                <Badge className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-0">{openTenders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="my-bids" data-testid="tab-my-bids">My Bids</TabsTrigger>
          </TabsList>

          <TabsContent value="available" className="space-y-3 mt-4">
            {openTenders.length === 0 ? (
              <EmptyState icon={Inbox} title="No open tenders" desc="New tenders for the ports you serve will appear here." />
            ) : (
              openTenders.map(t => (
                <TenderCard key={t.id} tender={t} role="agent" myBidStatus={getMyBidStatus(t.id)} isOwnTender={ownUserId ? t.userId === ownUserId : false} />
              ))
            )}
          </TabsContent>

          <TabsContent value="my-bids" className="space-y-3 mt-4">
            {!myBids || myBids.length === 0 ? (
              <EmptyState icon={Send} title="No bids submitted yet" desc="You can submit bids from the Open Tenders tab." />
            ) : (
              myBids.map((bid: any) => (
                <MyBidCard key={bid.id} bid={bid} />
              ))
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active" data-testid="tab-active">
              Active Tenders
              {openTenders.length > 0 && (
                <Badge className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 border-0">{openTenders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" data-testid="tab-past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3 mt-4">
            {openTenders.length === 0 ? (
              <EmptyState icon={Gavel} title="No active tenders" desc="Click 'Create New Tender' to get started." />
            ) : (
              openTenders.map(t => <TenderCard key={t.id} tender={t} role="shipowner" />)
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-3 mt-4">
            {closedTenders.length === 0 ? (
              <EmptyState icon={FileText} title="No past tenders" />
            ) : (
              closedTenders.map(t => <TenderCard key={t.id} tender={t} role="shipowner" />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function MyBidCard({ bid }: { bid: any }) {
  const [, navigate] = useLocation();
  const { remaining } = useCountdown(bid.tenderCreatedAt, bid.expiryHours);

  const statusConfig = {
    selected: { label: "Won 🏆", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    pending: { label: "Under Review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  }[bid.status as string] || { label: bid.status, cls: "bg-gray-100 text-gray-700" };

  const shipownerName = bid.shipownerCompany ||
    [bid.shipownerFirstName, bid.shipownerLastName].filter(Boolean).join(" ") ||
    "—";

  const bidDate = bid.createdAt
    ? new Date(bid.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const wonDate = bid.status === "selected" && bid.nominatedAt
    ? new Date(bid.nominatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-all"
      onClick={() => navigate(`/tenders/${bid.tenderId}`)}
      data-testid={`card-bid-${bid.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--maritime-primary)/0.08)] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Anchor className="w-4 h-4 text-[hsl(var(--maritime-primary))]" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{bid.portName}</p>
            {bid.vesselName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Ship className="w-3 h-3 flex-shrink-0" /> {bid.vesselName}
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{shipownerName}</span>
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {bid.totalAmount && (
                <span className="text-xs text-[hsl(var(--maritime-primary))] font-semibold">
                  {bid.totalAmount} {bid.currency}
                </span>
              )}
              {bidDate && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {bidDate}
                </span>
              )}
              {wonDate && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {wonDate}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Badge className={`text-[10px] border-0 ${statusConfig.cls}`}>{statusConfig.label}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {bid.tenderStatus === "open" ? remaining : "Closed"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="font-medium text-muted-foreground">{title}</p>
      {desc && <p className="text-sm text-muted-foreground max-w-xs">{desc}</p>}
    </div>
  );
}
