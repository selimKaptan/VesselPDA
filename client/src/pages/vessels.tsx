import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Ship, Plus, Trash2, Edit2, Search, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { PageMeta } from "@/components/page-meta";
import type { Vessel } from "@shared/schema";
import { useLocation } from "wouter";

const vesselTypes = [
  "Bulk Carrier", "Container Ship", "General Cargo", "Tanker", "Ro-Ro",
  "Passenger", "Chemical Tanker", "LPG Carrier", "LNG Carrier", "Reefer",
];

const flags = [
  "Turkey", "Malta", "Panama", "Liberia", "Marshall Islands", "Bahamas",
  "Greece", "Cyprus", "Singapore", "Hong Kong", "Norway", "United Kingdom",
];

type VesselFormData = {
  name: string; flag: string; vesselType: string; imoNumber: string;
  callSign: string; grt: string; nrt: string; dwt: string; loa: string; beam: string;
};

const emptyForm = (): VesselFormData => ({
  name: "", flag: "", vesselType: "", imoNumber: "", callSign: "",
  grt: "", nrt: "", dwt: "", loa: "", beam: "",
});

const vesselToForm = (v: Vessel): VesselFormData => ({
  name: v.name || "", flag: v.flag || "", vesselType: v.vesselType || "",
  imoNumber: v.imoNumber || "", callSign: v.callSign || "",
  grt: v.grt != null ? String(v.grt) : "", nrt: v.nrt != null ? String(v.nrt) : "",
  dwt: v.dwt != null ? String(v.dwt) : "", loa: v.loa != null ? String(v.loa) : "",
  beam: v.beam != null ? String(v.beam) : "",
});

type LookupResult = {
  name: string; flag: string; vesselType: string; imoNumber: string;
  callSign: string; grt: number | null; nrt: number | null;
  dwt: number | null; loa: number | null; beam: number | null;
};

function VesselForm({
  vessel, onSave, onCancel, isSaving,
}: {
  vessel?: Vessel | null;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<VesselFormData>(vessel ? vesselToForm(vessel) : emptyForm());
  const [lookupDone, setLookupDone] = useState(false);

  const set = (field: keyof VesselFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const lookupMutation = useMutation({
    mutationFn: async (imo: string) => {
      const res = await apiRequest("GET", `/api/vessels/lookup?imo=${encodeURIComponent(imo)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Lookup failed");
      }
      return res.json() as Promise<LookupResult>;
    },
    onSuccess: (data) => {
      setForm({
        name: data.name || form.name,
        flag: flags.includes(data.flag) ? data.flag : form.flag,
        vesselType: vesselTypes.includes(data.vesselType) ? data.vesselType : form.vesselType,
        imoNumber: data.imoNumber || form.imoNumber,
        callSign: data.callSign || form.callSign,
        grt: data.grt != null ? String(data.grt) : form.grt,
        nrt: data.nrt != null ? String(data.nrt) : form.nrt,
        dwt: data.dwt != null ? String(data.dwt) : form.dwt,
        loa: data.loa != null ? String(data.loa) : form.loa,
        beam: data.beam != null ? String(data.beam) : form.beam,
      });
      setLookupDone(true);
      const filled = [data.name, data.grt, data.nrt].filter(Boolean).length;
      toast({
        title: "Vessel details loaded",
        description: `${data.name || "Vessel"} — ${filled} fields auto-filled from registry.`,
      });
    },
    onError: (err: Error) => {
      const isNoKey = err.message.includes("not configured");
      toast({
        title: isNoKey ? "Lookup not configured" : "Vessel not found",
        description: isNoKey
          ? "Add a RapidAPI key as VESSEL_API_KEY to enable auto-fill."
          : err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: form.name,
      flag: form.flag,
      vesselType: form.vesselType,
      grt: parseFloat(form.grt),
      nrt: parseFloat(form.nrt),
      dwt: form.dwt ? parseFloat(form.dwt) : null,
      loa: form.loa ? parseFloat(form.loa) : null,
      beam: form.beam ? parseFloat(form.beam) : null,
      imoNumber: form.imoNumber || null,
      callSign: form.callSign || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="imoNumber">
            IMO Number
            {lookupDone && <Badge variant="secondary" className="ml-2 text-[10px]">Auto-filled</Badge>}
          </Label>
          <div className="flex gap-2">
            <Input
              id="imoNumber"
              placeholder="e.g. 9321483"
              value={form.imoNumber}
              onChange={(e) => { set("imoNumber", e.target.value); setLookupDone(false); }}
              className="flex-1"
              data-testid="input-imo"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Auto-fill from vessel registry"
              disabled={!form.imoNumber.trim() || lookupMutation.isPending}
              onClick={() => lookupMutation.mutate(form.imoNumber.trim())}
              data-testid="button-lookup-imo"
            >
              {lookupMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Enter IMO and click <Search className="w-3 h-3 inline" /> to auto-fill details</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Vessel Name *</Label>
          <Input
            id="name"
            placeholder="MV CHELSEA 2"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            data-testid="input-vessel-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flag">Flag *</Label>
          <Select value={form.flag} onValueChange={(v) => set("flag", v)} required>
            <SelectTrigger data-testid="select-flag"><SelectValue placeholder="Select flag" /></SelectTrigger>
            <SelectContent>
              {flags.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vesselType">Vessel Type *</Label>
          <Select value={form.vesselType} onValueChange={(v) => set("vesselType", v)} required>
            <SelectTrigger data-testid="select-vessel-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {vesselTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="grt">GRT (Gross Tonnage) *</Label>
          <Input
            id="grt"
            type="number"
            step="0.01"
            placeholder="5166"
            value={form.grt}
            onChange={(e) => set("grt", e.target.value)}
            required
            data-testid="input-grt"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nrt">NRT (Net Tonnage) *</Label>
          <Input
            id="nrt"
            type="number"
            step="0.01"
            placeholder="2906"
            value={form.nrt}
            onChange={(e) => set("nrt", e.target.value)}
            required
            data-testid="input-nrt"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dwt">DWT</Label>
          <Input
            id="dwt"
            type="number"
            step="0.01"
            placeholder="8500"
            value={form.dwt}
            onChange={(e) => set("dwt", e.target.value)}
            data-testid="input-dwt"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loa">LOA (m)</Label>
          <Input
            id="loa"
            type="number"
            step="0.01"
            placeholder="118.5"
            value={form.loa}
            onChange={(e) => set("loa", e.target.value)}
            data-testid="input-loa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="beam">Beam (m)</Label>
          <Input
            id="beam"
            type="number"
            step="0.01"
            placeholder="17.2"
            value={form.beam}
            onChange={(e) => set("beam", e.target.value)}
            data-testid="input-beam"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="callSign">Call Sign</Label>
          <Input
            id="callSign"
            placeholder="9HA4567"
            value={form.callSign}
            onChange={(e) => set("callSign", e.target.value)}
            data-testid="input-callsign"
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-vessel">
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} data-testid="button-save-vessel">
          {isSaving ? "Saving..." : vessel ? "Update Vessel" : "Add Vessel"}
        </Button>
      </div>
    </form>
  );
}

export default function Vessels() {
  const [showForm, setShowForm] = useState(false);
  const [editingVessel, setEditingVessel] = useState<Vessel | null>(null);
  const { toast } = useToast();
  const [location] = useLocation();

  useEffect(() => {
    if (location.includes("new=true")) setShowForm(true);
  }, [location]);

  const { data: vessels, isLoading } = useQuery<Vessel[]>({ queryKey: ["/api/vessels"] });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/vessels", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      setShowForm(false);
      toast({ title: "Vessel added successfully" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Please login again", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Failed to add vessel", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/vessels/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      setEditingVessel(null);
      toast({ title: "Vessel updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update vessel", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/vessels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels"] });
      toast({ title: "Vessel removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete vessel", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = (data: Record<string, unknown>) => {
    if (editingVessel) {
      updateMutation.mutate({ id: editingVessel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageMeta title="My Fleet | VesselPDA" description="Manage your vessel fleet and track vessel specifications." />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-vessels-title">Fleet Management</h1>
          <p className="text-muted-foreground text-sm">Manage your vessel fleet and specifications.</p>
        </div>
        <Button onClick={() => { setEditingVessel(null); setShowForm(true); }} className="gap-2" data-testid="button-add-vessel">
          <Plus className="w-4 h-4" /> Add Vessel
        </Button>
      </div>

      <Dialog
        open={showForm || !!editingVessel}
        onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingVessel(null); } }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{editingVessel ? "Edit Vessel" : "Add New Vessel"}</DialogTitle>
          </DialogHeader>
          <VesselForm
            key={editingVessel?.id ?? "new"}
            vessel={editingVessel}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingVessel(null); }}
            isSaving={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : vessels && vessels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vessels.map((vessel) => (
            <Card key={vessel.id} className="p-4 space-y-3" data-testid={`card-vessel-${vessel.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Ship className="w-4 h-4 text-[hsl(var(--maritime-primary))] shrink-0" />
                  <div>
                    <p className="font-semibold text-sm leading-tight" data-testid={`text-vessel-name-${vessel.id}`}>{vessel.name}</p>
                    <p className="text-xs text-muted-foreground">{vessel.vesselType}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingVessel(vessel)}
                    data-testid={`button-edit-vessel-${vessel.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(vessel.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-vessel-${vessel.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-muted/40 rounded p-2 text-center">
                  <p className="text-muted-foreground">GRT</p>
                  <p className="font-mono font-medium">{vessel.grt?.toLocaleString()}</p>
                </div>
                <div className="bg-muted/40 rounded p-2 text-center">
                  <p className="text-muted-foreground">NRT</p>
                  <p className="font-mono font-medium">{vessel.nrt?.toLocaleString()}</p>
                </div>
                <div className="bg-muted/40 rounded p-2 text-center">
                  <p className="text-muted-foreground">DWT</p>
                  <p className="font-mono font-medium">{vessel.dwt?.toLocaleString() ?? "—"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-xs">{vessel.flag}</Badge>
                {vessel.imoNumber && <Badge variant="secondary" className="text-xs font-mono">IMO {vessel.imoNumber}</Badge>}
                {vessel.callSign && <Badge variant="outline" className="text-xs">{vessel.callSign}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground" data-testid="text-no-vessels">
          <Ship className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No vessels in your fleet yet</p>
          <p className="text-sm mt-1">Add your first vessel to get started with proforma generation.</p>
          <Button className="mt-4 gap-2" onClick={() => setShowForm(true)} data-testid="button-add-first-vessel">
            <Plus className="w-4 h-4" /> Add First Vessel
          </Button>
        </div>
      )}
    </div>
  );
}
