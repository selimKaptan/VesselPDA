import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Package, Plus, Trash2, X, Loader2, ArrowRight, Mail, User, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageMeta } from "@/components/page-meta";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/empty-state";
import { fmtDate } from "@/lib/formatDate";

const UNIT_OPTIONS = ["MT", "CBM", "TEU", "Units", "BBL", "Lot"];

function formatDate(dt: string | null) {
  if (!dt) return null;
  return fmtDate(dt);
}

const defaultForm = {
  positionType: "cargo" as "cargo" | "vessel",
  title: "",
  description: "",
  vesselType: "",
  cargoType: "",
  quantity: "",
  quantityUnit: "MT",
  loadingPort: "",
  dischargePort: "",
  laycanFrom: "",
  laycanTo: "",
  contactName: "",
  contactEmail: "",
  expiresAt: "",
};

type FilterType = "all" | "cargo" | "vessel";

export default function CargoPositions() {
  const { toast } = useToast();
  const { user } = useAuth();
  const userId = (user as any)?.id || (user as any)?.claims?.sub;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [form, setForm] = useState({ ...defaultForm });

  const { data: positions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/cargo-positions"],
  });

  const { data: freightData } = useQuery<any>({
    queryKey: ["/api/market/freight-indices"],
    staleTime: 15 * 60 * 1000,
  });

  const { data: myPositions = [] } = useQuery<any[]>({
    queryKey: ["/api/cargo-positions/mine"],
    queryFn: async () => {
      const res = await fetch("/api/cargo-positions/mine");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/cargo-positions", {
        ...form,
        quantity: form.quantity ? parseFloat(form.quantity) : null,
        vesselType: form.vesselType || null,
        cargoType: form.cargoType || null,
        quantityUnit: form.quantityUnit || null,
        description: form.description || null,
        laycanFrom: form.laycanFrom || null,
        laycanTo: form.laycanTo || null,
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || null,
        expiresAt: form.expiresAt || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions/mine"] });
      toast({ title: "Listing published" });
      setDialogOpen(false);
      setForm({ ...defaultForm });
    },
    onError: () => toast({ title: "Error", description: "Could not publish listing", variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("PATCH", `/api/cargo-positions/${id}`, { status: "closed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions/mine"] });
      toast({ title: "Listing closed" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/cargo-positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cargo-positions/mine"] });
      toast({ title: "Listing deleted" });
      setDeleteTarget(null);
    },
  });

  const myPositionIds = new Set(myPositions.map((p: any) => p.id));

  const filtered = positions.filter((p: any) => {
    if (filter === "cargo") return p.positionType === "cargo";
    if (filter === "vessel") return p.positionType === "vessel";
    return true;
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <PageMeta title="Cargo & Position Board | VesselPDA" description="Cargo and vessel position listings board" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Package className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground font-serif">Cargo & Position Board</h1>
            <p className="text-sm text-muted-foreground">Find cargo or vessels, post position listings</p>
          </div>
        </div>
        <Button onClick={() => { setForm({ ...defaultForm }); setDialogOpen(true); }} data-testid="button-new-position">
          <Plus className="w-4 h-4 mr-1" />Post Listing
        </Button>
      </div>

      {/* BDI Ticker Banner */}
      {freightData?.indices && (
        <div data-testid="banner-freight-indices" className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium overflow-x-auto whitespace-nowrap">
          {freightData.indices.map((idx: any) => {
            const positive = idx.change > 0;
            const neutral = idx.change === 0;
            return (
              <span key={idx.code} className="flex items-center gap-1.5">
                <span className="font-bold">{idx.code}:</span>
                <span>{idx.value.toLocaleString("en-GB")}</span>
                {neutral ? <Minus className="w-3 h-3 opacity-60" /> : positive ? <TrendingUp className="w-3 h-3 text-emerald-300" /> : <TrendingDown className="w-3 h-3 text-red-300" />}
                <span className={positive ? "text-emerald-300" : neutral ? "opacity-70" : "text-red-300"}>
                  {positive ? "+" : ""}{idx.changePct.toFixed(1)}%
                </span>
                <span className="opacity-40 mx-1">|</span>
              </span>
            );
          })}
          <Link href="/market-data" className="underline underline-offset-2 opacity-80 hover:opacity-100 ml-1">
            Market details →
          </Link>
        </div>
      )}

      <div className="flex items-center gap-2">
        {(["all", "cargo", "vessel"] as FilterType[]).map(f => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            data-testid={`filter-${f}`}
          >
            {f === "all" ? "All" : f === "cargo" ? "Cargo Listing" : "Vessel Listing"}
          </Button>
        ))}
        <span className="text-sm text-muted-foreground ml-2">{filtered.length} listing(s)</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No Cargo Positions"
          description="Post cargo or vessel positions to find matching opportunities."
          actionLabel="+ Add Position"
          onAction={() => setDialogOpen(true)}
          tips={[
            "Cargo positions are seen by shipowners looking for freight",
            "Vessel positions help brokers find suitable cargo",
            "Include a laycan range for better matching"
          ]}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((pos: any) => {
            const isMine = myPositionIds.has(pos.id);
            return (
              <Card key={pos.id} className="p-4 flex flex-col gap-3" data-testid={`position-card-${pos.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={pos.positionType === "cargo"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}>
                        {pos.positionType === "cargo" ? "Cargo Listing" : "Vessel Listing"}
                      </Badge>
                      {isMine && <Badge variant="outline" className="text-xs">Mine</Badge>}
                    </div>
                    <h3 className="font-semibold text-sm leading-snug">{pos.title}</h3>
                  </div>
                  {isMine && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => closeMutation.mutate(pos.id)} title="Close Listing" data-testid={`button-close-pos-${pos.id}`}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(pos.id)} data-testid={`button-delete-pos-${pos.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span>{pos.loadingPort}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{pos.dischargePort}</span>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {pos.cargoType && <div>Cargo: <span className="text-foreground">{pos.cargoType}{pos.quantity ? ` — ${pos.quantity} ${pos.quantityUnit || ""}` : ""}</span></div>}
                  {pos.vesselType && <div>Vessel Type: <span className="text-foreground">{pos.vesselType}</span></div>}
                  {(pos.laycanFrom || pos.laycanTo) && (
                    <div>Laycan: <span className="text-foreground">{formatDate(pos.laycanFrom)}{pos.laycanTo ? ` – ${formatDate(pos.laycanTo)}` : ""}</span></div>
                  )}
                  {pos.expiresAt && <div>Expires: <span className="text-foreground">{formatDate(pos.expiresAt)}</span></div>}
                </div>

                {pos.description && <p className="text-xs text-muted-foreground line-clamp-2">{pos.description}</p>}

                {(pos.contactName || pos.contactEmail) && (
                  <div className="pt-2 mt-auto border-t border-border/50 space-y-1">
                    {pos.contactName && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span>{pos.contactName}</span>
                      </div>
                    )}
                    {pos.contactEmail && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <a href={`mailto:${pos.contactEmail}`} className="text-primary hover:underline">{pos.contactEmail}</a>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Position Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Listing Type</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={form.positionType === "cargo" ? "default" : "outline"}
                  onClick={() => setForm(f => ({ ...f, positionType: "cargo" }))}
                  data-testid="toggle-cargo"
                >
                  Cargo Listing
                </Button>
                <Button
                  size="sm"
                  variant={form.positionType === "vessel" ? "default" : "outline"}
                  onClick={() => setForm(f => ({ ...f, positionType: "vessel" }))}
                  data-testid="toggle-vessel"
                >
                  Vessel Listing
                </Button>
              </div>
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 3000 MT Wheat seeking, Izmir - Hamburg" data-testid="input-position-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Loading Port *</Label>
                <Input value={form.loadingPort} onChange={e => setForm(f => ({ ...f, loadingPort: e.target.value }))} placeholder="e.g. Izmir" data-testid="input-pos-loading-port" />
              </div>
              <div>
                <Label>Discharge Port *</Label>
                <Input value={form.dischargePort} onChange={e => setForm(f => ({ ...f, dischargePort: e.target.value }))} placeholder="e.g. Hamburg" data-testid="input-pos-discharge-port" />
              </div>
              {form.positionType === "cargo" && (
                <>
                  <div>
                    <Label>Cargo Type</Label>
                    <Input value={form.cargoType} onChange={e => setForm(f => ({ ...f, cargoType: e.target.value }))} placeholder="e.g. Wheat, Corn..." data-testid="input-pos-cargo-type" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Quantity</Label>
                      <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" data-testid="input-pos-qty" />
                    </div>
                    <div className="w-24">
                      <Label>Unit</Label>
                      <Select value={form.quantityUnit} onValueChange={v => setForm(f => ({ ...f, quantityUnit: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
              {form.positionType === "vessel" && (
                <div>
                  <Label>Vessel Type</Label>
                  <Input value={form.vesselType} onChange={e => setForm(f => ({ ...f, vesselType: e.target.value }))} placeholder="e.g. Bulk Carrier, Tanker..." data-testid="input-vessel-type" />
                </div>
              )}
              <div>
                <Label>Laycan From</Label>
                <Input type="date" value={form.laycanFrom} onChange={e => setForm(f => ({ ...f, laycanFrom: e.target.value }))} data-testid="input-pos-laycan-from" />
              </div>
              <div>
                <Label>Laycan To</Label>
                <Input type="date" value={form.laycanTo} onChange={e => setForm(f => ({ ...f, laycanTo: e.target.value }))} data-testid="input-pos-laycan-to" />
              </div>
              <div>
                <Label>Contact Name</Label>
                <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="optional" data-testid="input-contact-name" />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="optional" data-testid="input-contact-email" />
              </div>
              <div>
                <Label>Listing Expiry Date</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} data-testid="input-pos-expires" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Additional information, special conditions, etc. (optional)" data-testid="textarea-pos-description" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.title || !form.loadingPort || !form.dischargePort || createMutation.isPending} data-testid="button-save-position">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listing</AlertDialogTitle>
            <AlertDialogDescription>This listing will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteTarget !== null && deleteMutation.mutate(deleteTarget)} data-testid="button-confirm-delete-pos">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
