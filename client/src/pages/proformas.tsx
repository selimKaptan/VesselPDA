import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Eye, Trash2, Search, Copy, Gavel, Trophy, ExternalLink, DollarSign, Zap, Loader2, Calculator, Ship, Anchor, Globe, Package, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import type { Proforma, Vessel, Port } from "@shared/schema";

export default function Proformas() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vesselFilter, setVesselFilter] = useState("all");
  const { toast } = useToast();
  const { user } = useAuth();

  const userRole = (user as any)?.userRole;
  const activeRole = (user as any)?.activeRole;
  const effectiveRole = userRole === "admin" ? (activeRole || "shipowner") : userRole;
  const isAgent = effectiveRole === "agent";

  const [showQuickDialog, setShowQuickDialog] = useState(false);
  const [quickVesselId, setQuickVesselId] = useState<string>("");
  const [quickPortId, setQuickPortId] = useState<string>("");
  const [quickPortOpen, setQuickPortOpen] = useState(false);
  const [quickPortSearch, setQuickPortSearch] = useState("");
  const [quickDays, setQuickDays] = useState<number>(3);
  const [quickResult, setQuickResult] = useState<any>(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickPurpose, setQuickPurpose] = useState<string>("Discharging");
  const [quickCargoType, setQuickCargoType] = useState<string>("bulk_dry");
  const [quickCargoQty, setQuickCargoQty] = useState<string>("5000");
  const [quickCargoUnit, setQuickCargoUnit] = useState<string>("MT");
  const [quickDangerous, setQuickDangerous] = useState<boolean>(false);
  const [quickVoyageType, setQuickVoyageType] = useState<string>("international");
  const [quickVesselOpen, setQuickVesselOpen] = useState(false);
  const [quickVesselSearch, setQuickVesselSearch] = useState("");
  const [quickExternalVessel, setQuickExternalVessel] = useState<{ name: string; grt: number; nrt: number; flag: string; imoNumber: string } | null>(null);
  const [quickImoResult, setQuickImoResult] = useState<{ name: string; grt: number; nrt: number; flag: string; imoNumber: string } | null>(null);
  const [quickImoLoading, setQuickImoLoading] = useState(false);
  const [quickManualGrt, setQuickManualGrt] = useState<string>("");
  const [quickManualNrt, setQuickManualNrt] = useState<string>("");
  const [quickManualFlag, setQuickManualFlag] = useState<string>("Panama");
  const [quickManualVesselName, setQuickManualVesselName] = useState<string>("");

  const CARGO_TYPE_OPTIONS = [
    { value: "bulk_dry", label: "🌾 Bulk Dry Cargo", unit: "MT", examples: "Grain, coal, ore, fertilizer, scrap, cement" },
    { value: "general", label: "📦 General Cargo / Breakbulk", unit: "MT", examples: "Steel, timber, project cargo, bagged goods" },
    { value: "container", label: "🚢 Container", unit: "TEU", examples: "FCL, LCL, ISO containers" },
    { value: "roro", label: "🚗 Ro-Ro / Vehicles", unit: "Units", examples: "Automobiles, trucks, heavy machinery" },
    { value: "liquid", label: "⛽ Tanker / Liquid Cargo", unit: "MT", examples: "Crude oil, fuel oil, vegetable oil, molasses" },
    { value: "chemical", label: "⚗️ Chemical Tanker", unit: "MT", examples: "Chemicals, acids, methanol, solvents" },
    { value: "gas", label: "💨 LPG / LNG / Gas", unit: "MT", examples: "Liquefied petroleum / natural gas, ammonia" },
  ];

  const { data: proformas, isLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"] });
  const { data: vessels } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: turkishPorts } = useQuery<Port[]>({ queryKey: ["/api/ports?country=Turkey"], enabled: showQuickDialog });

  const selectedVessel = vessels?.find(v => String(v.id) === quickVesselId);
  const showManualTonnage = quickVesselId === "external" || quickVesselId === "";
  const effectiveVesselFlag = quickVesselId === "external" || quickVesselId === ""
    ? (quickManualFlag || "")
    : (selectedVessel?.flag || "");
  const isTurkishFlagVessel = (() => {
    const flag = effectiveVesselFlag.toLowerCase().trim();
    return ["turkey", "turkish", "türk", "türkiye", "tr", "turk"].includes(flag);
  })();

  useEffect(() => {
    if (quickVesselId && !isTurkishFlagVessel) {
      setQuickVoyageType("international");
    }
  }, [quickVesselId, isTurkishFlagVessel]);

  useEffect(() => {
    setQuickImoResult(null);
    if (!/^\d{5,8}$/.test(quickVesselSearch)) return;
    setQuickImoLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vessels/lookup?imo=${quickVesselSearch}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setQuickImoResult({
            name: data.name || "Unknown",
            grt: data.grt || 2000,
            nrt: data.nrt || 1000,
            flag: data.flag || "Unknown",
            imoNumber: data.imoNumber || quickVesselSearch,
          });
        }
      } catch (_) {}
      setQuickImoLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [quickVesselSearch]);

  const { data: myBids, isLoading: bidsLoading } = useQuery<any[]>({
    queryKey: ["/api/tenders/my-bids"],
    enabled: isAgent,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/proformas/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      toast({ title: "Proforma deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/proformas/${id}/duplicate`);
      return res.json();
    },
    onSuccess: (data: Proforma) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      toast({ title: "Proforma duplicated", description: "A draft copy has been created." });
      navigate(`/proformas/${data.id}`);
    },
    onError: () => {
      toast({ title: "Failed to duplicate", variant: "destructive" });
    },
  });

  const finalDaMutation = useMutation({
    mutationFn: async (pda: Proforma) => {
      const res = await apiRequest("POST", "/api/invoices", {
        title: `${pda.referenceNumber} Final DA`,
        invoiceType: "final_da",
        amount: (pda as any).totalUsd || 0,
        currency: "USD",
        linkedProformaId: pda.id,
        notes: `Auto-generated from Proforma DA ${pda.referenceNumber}.`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Final DA created", description: "Redirecting to Financial Flow page" });
      navigate("/invoices");
    },
    onError: () => toast({ title: "Error", description: "Failed to create Final DA", variant: "destructive" }),
  });

  const normalizeTR = (s: string) =>
    s.replace(/İ/g, "i").replace(/ı/g, "i").replace(/I/g, "i").toLowerCase()
      .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c");

  const filteredQuickPorts = useMemo(() => {
    if (!turkishPorts || !quickPortSearch || quickPortSearch.length < 2) return [];
    const q = normalizeTR(quickPortSearch);
    return turkishPorts.filter(p =>
      normalizeTR(p.name).includes(q) || normalizeTR(p.code || "").includes(q)
    ).slice(0, 40);
  }, [turkishPorts, quickPortSearch]);

  const handleQuickCalculate = async () => {
    const useManual = quickVesselId === "external" || quickVesselId === "";
    if (!useManual && !quickVesselId) {
      toast({ title: "Please select a vessel", variant: "destructive" }); return;
    }
    if (useManual && !quickManualGrt) {
      toast({ title: "Please enter a GRT value", variant: "destructive" }); return;
    }
    if (!quickPortId) {
      toast({ title: "Please select a port", variant: "destructive" }); return;
    }
    if (!quickCargoQty || parseFloat(quickCargoQty) <= 0) {
      toast({ title: "Please enter a valid cargo quantity", variant: "destructive" }); return;
    }
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const basePayload = {
        portId: parseInt(quickPortId),
        berthStayDays: quickDays,
        purposeOfCall: quickPurpose,
        cargoType: quickCargoType,
        cargoQuantity: parseFloat(quickCargoQty) || 5000,
        isDangerousCargo: quickDangerous,
        voyageType: quickVoyageType,
      };
      const payload = useManual
        ? {
            ...basePayload,
            vesselId: 0,
            externalGrt: parseFloat(quickManualGrt) || 2000,
            externalNrt: parseFloat(quickManualNrt) || Math.round((parseFloat(quickManualGrt) || 2000) * 0.7),
            externalFlag: quickManualFlag || "Panama",
            externalVesselName: quickManualVesselName || "Unknown Vessel",
          }
        : { ...basePayload, vesselId: parseInt(quickVesselId) };
      const res = await apiRequest("POST", "/api/proformas/quick-estimate", payload);
      if (res.ok) { setQuickResult(await res.json()); }
      else { toast({ title: "Calculation failed", variant: "destructive" }); }
    } catch (_) { toast({ title: "Connection error", variant: "destructive" }); }
    setQuickLoading(false);
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!quickResult) throw new Error("No result");
      if (!quickVesselId || quickVesselId === "external" || quickVesselId === "" || isNaN(parseInt(quickVesselId))) {
        throw new Error("Please select a vessel from your fleet to save as a draft.");
      }
      if (!quickPortId || isNaN(parseInt(quickPortId))) {
        throw new Error("Please select a port to save as a draft.");
      }
      const selectedCargoOption = CARGO_TYPE_OPTIONS.find(o => o.value === quickCargoType);
      const res = await apiRequest("POST", "/api/proformas", {
        vesselId: parseInt(quickVesselId),
        portId: parseInt(quickPortId),
        purposeOfCall: quickPurpose,
        cargoType: selectedCargoOption?.label.replace(/^[^\s]+\s/, "") || quickCargoType,
        cargoQuantity: parseFloat(quickCargoQty) || 5000,
        cargoUnit: quickCargoUnit,
        berthStayDays: quickDays,
        lineItems: quickResult.lineItems,
        totalUsd: quickResult.totalUsd,
        totalEur: quickResult.totalEur,
        exchangeRate: quickResult.exchangeRates.eurUsd,
        status: "draft",
        notes: "Created from quick estimate. Please review the details.",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      toast({ title: "Draft saved" });
      setShowQuickDialog(false);
      navigate(`/proformas/${data.id}`);
    },
    onError: (err: any) => {
      const msg = err?.message || "";
      if (msg.includes("400:") || msg.includes("required")) {
        toast({ title: "Missing fields", description: "Ensure a fleet vessel and port are selected.", variant: "destructive" });
      } else if (msg.includes("403:") || msg.includes("LIMIT_REACHED") || msg.includes("limit")) {
        toast({ title: "Proforma limit reached", description: "Upgrade your plan to save more proformas.", variant: "destructive" });
      } else if (msg.includes("Please select")) {
        toast({ title: "Cannot save", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
      }
    },
  });

  const filteredProformas = (proformas || []).filter((p) => {
    const matchesSearch =
      p.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.toCompany || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.cargoType || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesVessel = vesselFilter === "all" || String(p.vesselId) === vesselFilter;
    return matchesSearch && matchesStatus && matchesVessel;
  });

  const statusBadge: Record<string, "secondary" | "default" | "outline"> = {
    draft: "secondary",
    final: "default",
    sent: "default",
    approved: "default",
  };

  const getBidStatusBadge = (bid: any) => {
    const won = bid.status === "selected" && bid.tenderStatus === "nominated";
    if (won) return { label: "Won 🏆", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    if (bid.status === "selected") return { label: "Selected", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
    if (bid.status === "rejected") return { label: "Rejected", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
    return { label: "Under Review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
  };

  const handleViewPdf = (bid: any) => {
    if (!bid.proformaPdfBase64) return;
    const win = window.open();
    if (win) {
      win.document.write(
        `<iframe src="${bid.proformaPdfBase64}" width="100%" height="100%" style="border:none;margin:0;padding:0;height:100vh;"></iframe>`
      );
    }
  };

  const wonBids = (myBids || []).filter(b => b.status === "selected" && b.tenderStatus === "nominated");

  const proformaList = (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search reference, company, cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-proformas"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
          <SelectTrigger className="w-36" data-testid="trigger-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="final">Final</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
          </SelectContent>
        </Select>
        {vessels && vessels.length > 0 && (
          <Select value={vesselFilter} onValueChange={setVesselFilter} data-testid="select-vessel-filter">
            <SelectTrigger className="w-44" data-testid="trigger-vessel-filter">
              <SelectValue placeholder="Vessel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vessels</SelectItem>
              {vessels.map((v) => (
                <SelectItem key={v.id} value={String(v.id)} data-testid={`option-vessel-${v.id}`}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {(searchTerm || statusFilter !== "all" || vesselFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setStatusFilter("all"); setVesselFilter("all"); }} data-testid="button-clear-filters">
            Clear filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filteredProformas.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead className="hidden md:table-cell">To</TableHead>
                <TableHead className="hidden sm:table-cell">Purpose</TableHead>
                <TableHead>Total (USD)</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProformas.map((pda) => (
                <TableRow key={pda.id} data-testid={`row-proforma-list-${pda.id}`}>
                  <TableCell className="font-medium">{pda.referenceNumber}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{pda.toCompany || "-"}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="text-xs">{pda.purposeOfCall}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">${pda.totalUsd?.toLocaleString()}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant={statusBadge[pda.status] || "secondary"} className="text-xs capitalize">{pda.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {pda.createdAt ? new Date(pda.createdAt).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/proformas/${pda.id}`}>
                        <Button size="icon" variant="ghost" data-testid={`button-view-proforma-${pda.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => duplicateMutation.mutate(pda.id)}
                        disabled={duplicateMutation.isPending}
                        title="Duplicate proforma"
                        data-testid={`button-duplicate-proforma-${pda.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => finalDaMutation.mutate(pda)}
                        disabled={finalDaMutation.isPending}
                        title="Create Final DA"
                        data-testid={`button-final-da-${pda.id}`}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                      >
                        <DollarSign className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(pda.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-proforma-${pda.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center space-y-4">
          <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <div>
            <h3 className="font-serif font-semibold text-lg">No Proformas Found</h3>
            <p className="text-muted-foreground text-sm mt-1">
              {searchTerm || statusFilter !== "all" || vesselFilter !== "all"
                ? "No proformas match your filters."
                : "Create your first proforma to get started."}
            </p>
          </div>
          {!searchTerm && statusFilter === "all" && vesselFilter === "all" && (
            <Link href="/proformas/new">
              <Button className="gap-2" data-testid="button-create-first-proforma-list">
                <Plus className="w-4 h-4" /> Create Proforma
              </Button>
            </Link>
          )}
        </Card>
      )}
    </div>
  );

  const bidsList = (
    <div className="space-y-4">
      {wonBids.length > 0 && (
        <Card className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-emerald-600" />
            <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
              {wonBids.length} Won Tender{wonBids.length !== 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            {wonBids.length} of your bids have been officially accepted.
          </p>
        </Card>
      )}

      {bidsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (myBids || []).length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Port</TableHead>
                <TableHead className="hidden md:table-cell">Vessel</TableHead>
                <TableHead>Bid</TableHead>
                <TableHead className="hidden sm:table-cell">Submission Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Win Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(myBids || []).map((bid: any) => {
                const badge = getBidStatusBadge(bid);
                return (
                  <TableRow key={bid.id} data-testid={`row-bid-${bid.id}`}>
                    <TableCell className="font-medium">{bid.portName || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {bid.vesselName || "-"}
                    </TableCell>
                    <TableCell className="font-semibold text-[hsl(var(--maritime-primary))]">
                      {bid.totalAmount
                        ? `${bid.totalAmount} ${bid.currency || "USD"}`
                        : "-"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {bid.createdAt ? new Date(bid.createdAt).toLocaleDateString("tr-TR") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] border-0 ${badge.cls}`}>
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {bid.nominatedAt
                        ? new Date(bid.nominatedAt).toLocaleDateString("tr-TR")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {bid.proformaPdfBase64 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs h-8"
                            onClick={() => handleViewPdf(bid)}
                            data-testid={`button-view-bid-pdf-${bid.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" /> PDF
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs h-8"
                          onClick={() => navigate(`/tenders/${bid.tenderId}`)}
                          data-testid={`button-view-tender-${bid.id}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Tender
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center space-y-4">
          <Gavel className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <div>
            <h3 className="font-serif font-semibold text-lg">No Bids Submitted Yet</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Your tender bids will appear here once submitted.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/tenders")} data-testid="button-go-tenders">
            <Gavel className="w-4 h-4" /> Go to Tenders
          </Button>
        </Card>
      )}
    </div>
  );

  return (
    <div className="px-3 py-5 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="Proformas | VesselPDA" description="Manage your proforma disbursement accounts." />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-proformas-title">
            {isAgent ? "Proformas & Bids" : "Proforma Invoices"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAgent
              ? "Your proforma invoices and tender bids."
              : "Manage your proforma disbursement accounts."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
            onClick={() => { setShowQuickDialog(true); setQuickResult(null); setQuickVesselId(""); setQuickVesselSearch(""); setQuickVesselOpen(false); setQuickExternalVessel(null); setQuickImoResult(null); setQuickImoLoading(false); setQuickManualGrt(""); setQuickManualNrt(""); setQuickManualFlag("Panama"); setQuickManualVesselName(""); setQuickPortId(""); setQuickPortSearch(""); setQuickDays(3); setQuickPurpose("Discharging"); setQuickCargoType("bulk_dry"); setQuickCargoQty("5000"); setQuickCargoUnit("MT"); setQuickDangerous(false); setQuickVoyageType("international"); }}
            data-testid="button-quick-proforma"
          >
            <Zap className="w-4 h-4" /> Quick Estimate
          </Button>
          <Link href="/proformas/new">
            <Button className="gap-2" data-testid="button-new-proforma">
              <Plus className="w-4 h-4" /> New Proforma
            </Button>
          </Link>
        </div>
      </div>

      <Dialog open={showQuickDialog} onOpenChange={setShowQuickDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-quick-proforma">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Zap className="w-5 h-5 text-blue-600" />
              Quick Proforma Estimate
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Enter vessel, port and cargo details — 2026 official tariffs are applied automatically for an instant DA estimate.
            </p>

            {/* ── SECTION 1: Vessel & Port ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Ship className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Vessel & Port</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Vessel</Label>
                  <Popover open={quickVesselOpen} onOpenChange={setQuickVesselOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-start font-normal"
                        data-testid="trigger-vessel-quick"
                      >
                        {quickVesselId === "external"
                          ? <Globe className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                          : <Ship className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />}
                        <span className="truncate">
                          {quickVesselId === "external" && quickExternalVessel
                            ? `${quickExternalVessel.name} (IMO ${quickExternalVessel.imoNumber})`
                            : quickVesselId && vessels
                              ? (vessels.find(v => String(v.id) === quickVesselId)?.name || "Select vessel...")
                              : "Search by vessel name or IMO..."}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[340px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Vessel name or IMO number..."
                          value={quickVesselSearch}
                          onValueChange={(v) => {
                            setQuickVesselSearch(v);
                            if (quickVesselId === "external") {
                              setQuickVesselId("");
                              setQuickExternalVessel(null);
                            }
                          }}
                          data-testid="input-vessel-quick"
                        />
                        <CommandList>
                          {(vessels || []).filter(v => {
                            const q = quickVesselSearch.toLowerCase();
                            return !q || v.name.toLowerCase().includes(q) || (v.imoNumber || "").toLowerCase().includes(q);
                          }).length === 0 && !quickImoLoading && !quickImoResult && (
                            <CommandEmpty>
                              {quickVesselSearch.length >= 5
                                ? "Not found in fleet. Waiting for IMO lookup..."
                                : "Enter vessel name or IMO."}
                            </CommandEmpty>
                          )}
                          <CommandGroup>
                            {(vessels || [])
                              .filter(v => {
                                const q = quickVesselSearch.toLowerCase();
                                return !q || v.name.toLowerCase().includes(q) || (v.imoNumber || "").toLowerCase().includes(q);
                              })
                              .map((v) => (
                                <CommandItem
                                  key={v.id}
                                  value={String(v.id)}
                                  onSelect={() => {
                                    setQuickVesselId(String(v.id));
                                    setQuickExternalVessel(null);
                                    setQuickManualGrt("");
                                    setQuickManualNrt("");
                                    setQuickManualFlag("Panama");
                                    setQuickManualVesselName("");
                                    setQuickVesselSearch("");
                                    setQuickVesselOpen(false);
                                  }}
                                  data-testid={`option-quick-vessel-${v.id}`}
                                >
                                  <Ship className="w-3 h-3 mr-2 text-muted-foreground flex-shrink-0" />
                                  <span className="flex-1 font-medium">{v.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {v.flag}{v.imoNumber ? ` · IMO ${v.imoNumber}` : ""}
                                </span>
                              </CommandItem>
                            ))}
                          {quickImoLoading && (
                            <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Looking up IMO...
                            </div>
                          )}
                          {quickImoResult && !quickImoLoading && (
                            <CommandItem
                              key="external-api"
                              value="external-api"
                              onSelect={() => {
                                setQuickVesselId("external");
                                setQuickExternalVessel(quickImoResult);
                                setQuickManualVesselName(quickImoResult!.name);
                                setQuickManualGrt(quickImoResult!.grt ? String(quickImoResult!.grt) : "");
                                setQuickManualNrt(quickImoResult!.nrt ? String(quickImoResult!.nrt) : "");
                                setQuickManualFlag(quickImoResult!.flag || "Panama");
                                setQuickVesselSearch("");
                                setQuickImoResult(null);
                                setQuickVesselOpen(false);
                              }}
                              data-testid="option-quick-vessel-external"
                              className="border-t border-dashed border-blue-200 dark:border-blue-800 mt-1"
                            >
                              <Globe className="w-3 h-3 mr-2 text-blue-500 flex-shrink-0" />
                              <span className="flex-1 font-medium">{quickImoResult.name}</span>
                              <span className="text-xs text-blue-500 ml-2 flex-shrink-0">
                                {quickImoResult.flag} · IMO {quickImoResult.imoNumber}
                              </span>
                            </CommandItem>
                          )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Port combobox — second column of the Vessel & Port grid */}
              <div className="space-y-2">
                <Label>Port</Label>
                <Popover open={quickPortOpen} onOpenChange={setQuickPortOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-start font-normal"
                      data-testid="trigger-port-quick"
                    >
                      <Anchor className="w-4 h-4 mr-2 text-muted-foreground" />
                      {quickPortId && turkishPorts ? (turkishPorts.find(p => String(p.id) === quickPortId)?.name || "Select port...") : "Enter port name..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search Turkish port... (min. 2 chars)"
                        value={quickPortSearch}
                        onValueChange={setQuickPortSearch}
                        data-testid="input-port-quick"
                      />
                      <CommandList>
                        <CommandEmpty>
                          {quickPortSearch.length < 2 ? "Enter at least 2 characters." : "No Turkish port found."}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredQuickPorts.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.name}
                              onSelect={() => { setQuickPortId(String(p.id)); setQuickPortSearch(p.name); setQuickPortOpen(false); }}
                              data-testid={`option-quick-port-${p.id}`}
                            >
                              <Anchor className="w-3 h-3 mr-2 text-muted-foreground" />
                              {p.name}
                              {p.code && <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              </div>{/* end vessel+port grid */}
            </div>{/* end Section 1 */}

            {/* Manual Tonnage Entry — shown for external or unselected vessel */}
            {showManualTonnage && (
              <div className="rounded-lg border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/20 p-3 space-y-3">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  {quickVesselId === "external" ? "Tonnage data from API — you may edit" : "Enter vessel details manually"}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Vessel Name</Label>
                    <Input
                      placeholder="e.g. ALSU"
                      value={quickManualVesselName}
                      onChange={(e) => setQuickManualVesselName(e.target.value)}
                      className="h-8 text-sm"
                      data-testid="input-manual-vessel-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">GRT</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 8000"
                      value={quickManualGrt}
                      onChange={(e) => setQuickManualGrt(e.target.value)}
                      className="h-8 text-sm"
                      min={0}
                      data-testid="input-manual-grt"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NRT</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 6000"
                      value={quickManualNrt}
                      onChange={(e) => setQuickManualNrt(e.target.value)}
                      className="h-8 text-sm"
                      min={0}
                      data-testid="input-manual-nrt"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Flag</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {["Turkey", "Panama", "Malta", "Marshall Islands", "Liberia", "Bahamas"].map(flag => (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => setQuickManualFlag(flag)}
                        className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                          quickManualFlag === flag
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-input bg-background hover:bg-muted text-muted-foreground"
                        }`}
                        data-testid={`button-flag-${flag.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {flag}
                      </button>
                    ))}
                  </div>
                  <Input
                    placeholder="Enter a different flag..."
                    value={quickManualFlag}
                    onChange={(e) => setQuickManualFlag(e.target.value)}
                    className="h-7 text-xs mt-1"
                    data-testid="input-manual-flag"
                  />
                </div>
              </div>
            )}

            {/* ── SECTION 2: Voyage Details ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Voyage Details</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Stay (Days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={quickDays}
                    onChange={(e) => setQuickDays(parseInt(e.target.value) || 3)}
                    className="w-full"
                    data-testid="input-days-quick"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Purpose of Call</Label>
                  <Select value={quickPurpose} onValueChange={setQuickPurpose} data-testid="select-purpose-quick">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Discharging">🔽 Discharging</SelectItem>
                      <SelectItem value="Loading">🔼 Loading</SelectItem>
                      <SelectItem value="Loading/Discharging">🔄 Loading + Discharging</SelectItem>
                      <SelectItem value="Transit">➡️ Transit</SelectItem>
                      <SelectItem value="Bunkering">⛽ Bunkering</SelectItem>
                      <SelectItem value="Repair">🔧 Repair</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isTurkishFlagVessel && (
                  <div className="space-y-2" data-testid="section-voyage-type">
                    <Label>Voyage Type</Label>
                    <div className="grid grid-cols-2 gap-1.5" data-testid="select-voyage-type">
                      <button
                        type="button"
                        onClick={() => setQuickVoyageType("international")}
                        className={`px-2 py-2 rounded-md border text-xs font-medium transition-colors ${quickVoyageType === "international" ? "bg-blue-600 text-white border-blue-600" : "border-input bg-background hover:bg-muted"}`}
                        data-testid="button-voyage-international"
                      >🌍 International</button>
                      <button
                        type="button"
                        onClick={() => setQuickVoyageType("cabotage")}
                        className={`px-2 py-2 rounded-md border text-xs font-medium transition-colors ${quickVoyageType === "cabotage" ? "bg-blue-600 text-white border-blue-600" : "border-input bg-background hover:bg-muted"}`}
                        data-testid="button-voyage-cabotage"
                      >🇹🇷 Cabotage</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── SECTION 3: Cargo ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-[hsl(var(--maritime-primary))]" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Cargo</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cargo Type</Label>
                  <Select
                    value={quickCargoType}
                    onValueChange={(v) => {
                      setQuickCargoType(v);
                      const opt = CARGO_TYPE_OPTIONS.find(o => o.value === v);
                      if (opt) setQuickCargoUnit(opt.unit);
                    }}
                    data-testid="select-cargo-type-quick"
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CARGO_TYPE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div>
                            <div>{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.examples}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Cargo Quantity
                    <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                      ({quickCargoUnit === "TEU" ? "TEU" : quickCargoUnit === "Units" ? "Units" : "MT"})
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={quickCargoQty}
                      onChange={(e) => setQuickCargoQty(e.target.value)}
                      className="flex-1"
                      placeholder={quickCargoUnit === "TEU" ? "200" : quickCargoUnit === "Units" ? "50" : "5000"}
                      data-testid="input-cargo-qty-quick"
                    />
                    <div className="flex items-center px-3 rounded-md border bg-muted text-sm font-medium min-w-[56px] justify-center">
                      {quickCargoUnit}
                    </div>
                  </div>
                  {(quickCargoType === "liquid" || quickCargoType === "chemical" || quickCargoType === "gas") && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">ℹ️ Supervision fee is fixed-rate for this cargo type.</p>
                  )}
                </div>
              </div>

              {/* Dangerous Goods toggle with Switch */}
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-md border transition-colors ${quickDangerous ? "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/20" : "border-input bg-background"}`}
                data-testid="switch-dangerous-quick"
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 ${quickDangerous ? "text-orange-500" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <div className={`text-sm font-medium ${quickDangerous ? "text-orange-700 dark:text-orange-300" : ""}`}>IMDG Dangerous Cargo</div>
                  <div className="text-xs text-muted-foreground">+30% surcharge on Pilotage, Tugboat & Mooring</div>
                </div>
                <Switch
                  checked={quickDangerous}
                  onCheckedChange={setQuickDangerous}
                  className={quickDangerous ? "data-[state=checked]:bg-orange-500" : ""}
                />
              </div>
            </div>

            {/* Port is now in Section 1. Nothing here. */}

            <Button
              className="w-full gap-2"
              onClick={handleQuickCalculate}
              disabled={quickLoading || (!quickVesselId && !quickManualGrt) || !quickPortId}
              data-testid="button-calculate-quick"
            >
              {quickLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {quickLoading ? "Calculating..." : "Calculate Estimate"}
            </Button>

            {quickResult && (
              <Card className="p-4 space-y-3 bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                {/* Header strip */}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <Ship className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                        {quickResult.vesselName} — {quickResult.portName}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <Badge className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                        {CARGO_TYPE_OPTIONS.find(o => o.value === quickCargoType)?.label || quickCargoType}
                      </Badge>
                      <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-0">
                        {parseFloat(quickCargoQty).toLocaleString()} {quickCargoUnit}
                      </Badge>
                      <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-0">
                        {quickPurpose} · {quickDays}d
                      </Badge>
                      <Badge className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-0">
                        {quickVoyageType === "cabotage" ? "🇹🇷 Cabotage" : "🌍 International"}
                      </Badge>
                      {quickDangerous && (
                        <Badge className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-0">
                          ⚠️ +30% IMDG
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">Estimated DA</Badge>
                </div>

                {/* Tariff source badge */}
                {quickResult.tariffSource === "database" ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-md" data-testid="badge-tariff-real">
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm">✓</span>
                    <div>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">2026 Official Tariffs Applied</span>
                      {quickResult.portTariffName && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1.5">({quickResult.portTariffName} official tariff)</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md" data-testid="badge-tariff-estimate">
                    <span className="text-amber-600 dark:text-amber-400 text-sm">~</span>
                    <div>
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Estimated Values</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 ml-1.5">(No DB tariff for this port)</span>
                    </div>
                  </div>
                )}

                {/* Two-column layout: table + breakdown bars */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                  {/* Line items table */}
                  <div className="sm:col-span-3 border rounded-md overflow-hidden bg-white dark:bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs py-2">Line Item</TableHead>
                          <TableHead className="text-xs py-2 text-right">USD</TableHead>
                          <TableHead className="text-xs py-2 text-right hidden sm:table-cell">EUR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(quickResult.lineItems || []).map((item: any, i: number) => (
                          <TableRow key={i} className="text-xs" data-testid={`row-quick-item-${i}`}>
                            <TableCell className="py-1.5">{item.description}</TableCell>
                            <TableCell className="py-1.5 text-right font-mono">{item.amountUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="py-1.5 text-right font-mono hidden sm:table-cell">{(item.amountEur || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Cost breakdown bars */}
                  <div className="sm:col-span-2 space-y-2 py-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cost Breakdown</p>
                    {(() => {
                      const palette = ["bg-blue-500","bg-indigo-500","bg-violet-500","bg-sky-500","bg-teal-500","bg-cyan-500","bg-blue-600","bg-indigo-600","bg-purple-500","bg-blue-400"];
                      const items = (quickResult.lineItems || []).filter((it: any) => it.amountUsd > 0);
                      return items.map((item: any, i: number) => {
                        const pct = quickResult.totalUsd > 0 ? (item.amountUsd / quickResult.totalUsd * 100) : 0;
                        const label = item.description.split(" ")[0];
                        return (
                          <div key={i} className="space-y-0.5">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span className="truncate max-w-[100px]">{label}</span>
                              <span className="font-mono">{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full ${palette[i % palette.length]} rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Total */}
                <div className="flex items-end justify-between pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Estimated Total</p>
                    <p className="text-3xl font-bold font-serif text-blue-700 dark:text-blue-300 tracking-tight" data-testid="text-quick-total-usd">
                      ~${quickResult.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm text-muted-foreground font-mono">~€{quickResult.totalEur.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground pb-1">
                    <p>TCMB: 1 USD = {quickResult.exchangeRates.usdTry} TRY</p>
                    <p>{(quickResult.lineItems || []).length} expense items</p>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  * Estimate only. Create a full proforma for exact figures.
                </p>

                <div className="flex gap-2 pt-1">
                  {(quickVesselId === "external" || quickVesselId === "") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      disabled
                      title="Select a vessel from your fleet to save as draft"
                      data-testid="button-save-draft-quick"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Save as Draft (Select Fleet Vessel First)
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => saveDraftMutation.mutate()}
                      disabled={saveDraftMutation.isPending || !quickPortId}
                      data-testid="button-save-draft-quick"
                    >
                      {saveDraftMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      Save as Draft
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => { setShowQuickDialog(false); navigate(`/proformas/new?vesselId=${quickVesselId}&portId=${quickPortId}&days=${quickDays}`); }}
                    disabled={quickVesselId === "external"}
                    data-testid="button-go-full-form"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Full Proforma
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isAgent ? (
        <Tabs defaultValue="proformas">
          <TabsList className="mb-4">
            <TabsTrigger value="proformas" className="gap-2" data-testid="tab-proformas">
              <FileText className="w-4 h-4" />
              Proformalar
              {(proformas || []).length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px]">{(proformas || []).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bids" className="gap-2" data-testid="tab-bids">
              <Gavel className="w-4 h-4" />
              My Tender Bids
              {wonBids.length > 0 && (
                <Badge className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 border-0">{wonBids.length} won</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="proformas">{proformaList}</TabsContent>
          <TabsContent value="bids">{bidsList}</TabsContent>
        </Tabs>
      ) : (
        proformaList
      )}
    </div>
  );
}
