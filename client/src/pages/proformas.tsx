import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Plus, Eye, Trash2, Search, Copy, Gavel, Trophy, ExternalLink, DollarSign, Zap, Loader2, Calculator, Ship, Anchor } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState, useMemo } from "react";
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

  const { data: proformas, isLoading } = useQuery<Proforma[]>({ queryKey: ["/api/proformas"] });
  const { data: vessels } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });
  const { data: allPorts } = useQuery<Port[]>({ queryKey: ["/api/ports"], enabled: showQuickDialog });
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
        notes: `Proforma DA ${pda.referenceNumber} üzerinden otomatik oluşturuldu.`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Final DA oluşturuldu", description: "Finansal Akış sayfasına yönlendiriliyorsunuz" });
      navigate("/invoices");
    },
    onError: () => toast({ title: "Hata", description: "Final DA oluşturulamadı", variant: "destructive" }),
  });

  const filteredQuickPorts = useMemo(() => {
    if (!allPorts || !quickPortSearch || quickPortSearch.length < 2) return [];
    const q = quickPortSearch.toLowerCase();
    return allPorts.filter(p => p.name.toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q)).slice(0, 40);
  }, [allPorts, quickPortSearch]);

  const handleQuickCalculate = async () => {
    if (!quickVesselId || !quickPortId) {
      toast({ title: "Lütfen gemi ve liman seçin", variant: "destructive" }); return;
    }
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const res = await apiRequest("POST", "/api/proformas/quick-estimate", {
        vesselId: parseInt(quickVesselId),
        portId: parseInt(quickPortId),
        berthStayDays: quickDays,
      });
      if (res.ok) { setQuickResult(await res.json()); }
      else { toast({ title: "Hesaplama başarısız", variant: "destructive" }); }
    } catch (_) { toast({ title: "Bağlantı hatası", variant: "destructive" }); }
    setQuickLoading(false);
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!quickResult) throw new Error("No result");
      const res = await apiRequest("POST", "/api/proformas", {
        vesselId: parseInt(quickVesselId),
        portId: parseInt(quickPortId),
        purposeOfCall: "Loading",
        berthStayDays: quickDays,
        lineItems: quickResult.lineItems,
        totalUsd: quickResult.totalUsd,
        totalEur: quickResult.totalEur,
        exchangeRate: quickResult.exchangeRates.eurUsd,
        status: "draft",
        notes: "Anlık tahmin ile oluşturuldu. Lütfen detayları gözden geçiriniz.",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proformas"] });
      toast({ title: "Taslak kaydedildi" });
      setShowQuickDialog(false);
      navigate(`/proformas/${data.id}`);
    },
    onError: () => toast({ title: "Kaydetme başarısız", variant: "destructive" }),
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
    if (won) return { label: "Kazandı 🏆", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" };
    if (bid.status === "selected") return { label: "Seçildi", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
    if (bid.status === "rejected") return { label: "Reddedildi", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
    return { label: "İnceleniyor", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" };
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
                        title="Final DA Oluştur"
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
              {wonBids.length} Kazanılan Tender
            </p>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Tekliflerinizden {wonBids.length} tanesi resmi olarak kabul edildi.
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
                <TableHead>Liman</TableHead>
                <TableHead className="hidden md:table-cell">Gemi</TableHead>
                <TableHead>Teklif</TableHead>
                <TableHead className="hidden sm:table-cell">Gönderim Tarihi</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="hidden lg:table-cell">Kazanma Tarihi</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
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
            <h3 className="font-serif font-semibold text-lg">Henüz Teklif Gönderilmedi</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Tender'lara teklif gönderdiğinizde burada görünecek.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate("/tenders")} data-testid="button-go-tenders">
            <Gavel className="w-4 h-4" /> Tender'lara Git
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
            {isAgent ? "Proformalar & Teklifler" : "Proforma Invoices"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAgent
              ? "Proforma faturalarınız ve tender teklifleriniz."
              : "Manage your proforma disbursement accounts."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
            onClick={() => { setShowQuickDialog(true); setQuickResult(null); setQuickVesselId(""); setQuickPortId(""); setQuickPortSearch(""); setQuickDays(3); }}
            data-testid="button-quick-proforma"
          >
            <Zap className="w-4 h-4" /> Anlık Proforma Al
          </Button>
          <Link href="/proformas/new">
            <Button className="gap-2" data-testid="button-new-proforma">
              <Plus className="w-4 h-4" /> New Proforma
            </Button>
          </Link>
        </div>
      </div>

      <Dialog open={showQuickDialog} onOpenChange={setShowQuickDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-quick-proforma">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Zap className="w-5 h-5 text-blue-600" />
              Anlık Proforma Al
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gemi ve liman seçin — tarifeler otomatik uygulanarak anlık tahmini DA hesaplanır.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gemi Seç</Label>
                <Select value={quickVesselId} onValueChange={setQuickVesselId} data-testid="select-vessel-quick">
                  <SelectTrigger data-testid="trigger-vessel-quick">
                    <SelectValue placeholder="Gemi seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(vessels || []).map((v) => (
                      <SelectItem key={v.id} value={String(v.id)} data-testid={`option-quick-vessel-${v.id}`}>
                        <span className="flex items-center gap-2">
                          <Ship className="w-3 h-3" /> {v.name} ({v.flag})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tahmini Kalış (Gün)</Label>
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
            </div>

            <div className="space-y-2">
              <Label>Liman Ara</Label>
              <Popover open={quickPortOpen} onOpenChange={setQuickPortOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-start font-normal"
                    data-testid="trigger-port-quick"
                  >
                    <Anchor className="w-4 h-4 mr-2 text-muted-foreground" />
                    {quickPortId && allPorts ? (allPorts.find(p => String(p.id) === quickPortId)?.name || "Liman seçin...") : "Liman adı yazın..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Liman ara... (en az 2 karakter)"
                      value={quickPortSearch}
                      onValueChange={setQuickPortSearch}
                      data-testid="input-port-quick"
                    />
                    <CommandList>
                      <CommandEmpty>
                        {quickPortSearch.length < 2 ? "En az 2 karakter girin." : "Liman bulunamadı."}
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

            <Button
              className="w-full gap-2"
              onClick={handleQuickCalculate}
              disabled={quickLoading || !quickVesselId || !quickPortId}
              data-testid="button-calculate-quick"
            >
              {quickLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              {quickLoading ? "Hesaplanıyor..." : "Tahmini Hesapla"}
            </Button>

            {quickResult && (
              <Card className="p-4 space-y-3 bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Ship className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">
                    {quickResult.vesselName} — {quickResult.portName}
                  </span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">Tahmini DA</Badge>
                </div>

                <div className="border rounded-md overflow-hidden bg-white dark:bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs py-2">Kalem</TableHead>
                        <TableHead className="text-xs py-2 text-right">USD ($)</TableHead>
                        <TableHead className="text-xs py-2 text-right hidden sm:table-cell">EUR (€)</TableHead>
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

                <div className="flex items-center justify-between pt-1 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Tahmini Toplam</p>
                    <p className="text-xl font-bold font-serif text-blue-700 dark:text-blue-300" data-testid="text-quick-total-usd">
                      ~${quickResult.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                    </p>
                    <p className="text-sm text-muted-foreground">~€{quickResult.totalEur.toLocaleString(undefined, { maximumFractionDigits: 0 })} EUR</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>TCMB: 1 USD = {quickResult.exchangeRates.usdTry} TRY</p>
                    <p>{quickDays} gün kalış · {(quickResult.lineItems || []).length} kalem</p>
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  * Bu tahmini bir değerdir. Kesin rakam için tam proforma oluşturunuz.
                </p>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => saveDraftMutation.mutate()}
                    disabled={saveDraftMutation.isPending}
                    data-testid="button-save-draft-quick"
                  >
                    {saveDraftMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                    Taslak Kaydet
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => { setShowQuickDialog(false); navigate(`/proformas/new?vesselId=${quickVesselId}&portId=${quickPortId}&days=${quickDays}`); }}
                    data-testid="button-go-full-form"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tam Proformaya Geç
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
              Tender Tekliflerim
              {wonBids.length > 0 && (
                <Badge className="ml-1 text-[10px] bg-emerald-100 text-emerald-700 border-0">{wonBids.length} kazandı</Badge>
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
