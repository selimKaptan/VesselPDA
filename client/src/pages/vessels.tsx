import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Ship, Plus, Flag, Ruler, Weight, Trash2, Edit2, X } from "lucide-react";
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {
      name: formData.get("name"),
      flag: formData.get("flag"),
      vesselType: formData.get("vesselType"),
      grt: parseFloat(formData.get("grt") as string),
      nrt: parseFloat(formData.get("nrt") as string),
      dwt: formData.get("dwt") ? parseFloat(formData.get("dwt") as string) : null,
      loa: formData.get("loa") ? parseFloat(formData.get("loa") as string) : null,
      beam: formData.get("beam") ? parseFloat(formData.get("beam") as string) : null,
      imoNumber: formData.get("imoNumber") || null,
      callSign: formData.get("callSign") || null,
    };

    if (editingVessel) {
      updateMutation.mutate({ id: editingVessel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const VesselForm = ({ vessel }: { vessel?: Vessel | null }) => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Vessel Name *</Label>
          <Input id="name" name="name" placeholder="MV CHELSEA 2" defaultValue={vessel?.name || ""} required data-testid="input-vessel-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="flag">Flag *</Label>
          <Select name="flag" defaultValue={vessel?.flag || ""} required>
            <SelectTrigger data-testid="select-flag"><SelectValue placeholder="Select flag" /></SelectTrigger>
            <SelectContent>
              {flags.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="vesselType">Vessel Type *</Label>
          <Select name="vesselType" defaultValue={vessel?.vesselType || ""} required>
            <SelectTrigger data-testid="select-vessel-type"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {vesselTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="imoNumber">IMO Number</Label>
          <Input id="imoNumber" name="imoNumber" placeholder="9876543" defaultValue={vessel?.imoNumber || ""} data-testid="input-imo" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grt">GRT (Gross Tonnage) *</Label>
          <Input id="grt" name="grt" type="number" step="0.01" placeholder="5166" defaultValue={vessel?.grt || ""} required data-testid="input-grt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nrt">NRT (Net Tonnage) *</Label>
          <Input id="nrt" name="nrt" type="number" step="0.01" placeholder="2906" defaultValue={vessel?.nrt || ""} required data-testid="input-nrt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dwt">DWT</Label>
          <Input id="dwt" name="dwt" type="number" step="0.01" placeholder="8500" defaultValue={vessel?.dwt || ""} data-testid="input-dwt" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loa">LOA (m)</Label>
          <Input id="loa" name="loa" type="number" step="0.01" placeholder="118.5" defaultValue={vessel?.loa || ""} data-testid="input-loa" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="beam">Beam (m)</Label>
          <Input id="beam" name="beam" type="number" step="0.01" placeholder="17.2" defaultValue={vessel?.beam || ""} data-testid="input-beam" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="callSign">Call Sign</Label>
          <Input id="callSign" name="callSign" placeholder="9HA4567" defaultValue={vessel?.callSign || ""} data-testid="input-callsign" />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => { setShowForm(false); setEditingVessel(null); }}
          data-testid="button-cancel-vessel"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-vessel">
          {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : vessel ? "Update Vessel" : "Add Vessel"}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-vessels-title">Fleet Management</h1>
          <p className="text-muted-foreground text-sm">Manage your vessel fleet and specifications.</p>
        </div>
        <Button onClick={() => { setEditingVessel(null); setShowForm(true); }} className="gap-2" data-testid="button-add-vessel">
          <Plus className="w-4 h-4" /> Add Vessel
        </Button>
      </div>

      <Dialog open={showForm || !!editingVessel} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingVessel(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{editingVessel ? "Edit Vessel" : "Add New Vessel"}</DialogTitle>
          </DialogHeader>
          <VesselForm vessel={editingVessel} />
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : vessels && vessels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vessels.map((vessel) => (
            <Card key={vessel.id} className="p-6 space-y-4 hover-elevate" data-testid={`card-vessel-${vessel.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-md bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center flex-shrink-0">
                    <Ship className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate" data-testid={`text-vessel-name-${vessel.id}`}>{vessel.name}</p>
                    <Badge variant="secondary" className="text-xs">{vessel.vesselType}</Badge>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setEditingVessel(vessel)} data-testid={`button-edit-vessel-${vessel.id}`}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(vessel.id)} data-testid={`button-delete-vessel-${vessel.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Flag className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Flag:</span>
                  <span className="font-medium truncate">{vessel.flag}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Weight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">GRT:</span>
                  <span className="font-medium">{vessel.grt?.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">NRT:</span>
                  <span className="font-medium">{vessel.nrt?.toLocaleString()}</span>
                </div>
                {vessel.dwt && (
                  <div className="flex items-center gap-2">
                    <Weight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">DWT:</span>
                    <span className="font-medium">{vessel.dwt?.toLocaleString()}</span>
                  </div>
                )}
              </div>
              {vessel.imoNumber && (
                <p className="text-xs text-muted-foreground">IMO: {vessel.imoNumber}</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center space-y-4">
          <Ship className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <div>
            <h3 className="font-serif font-semibold text-lg">No Vessels Added</h3>
            <p className="text-muted-foreground text-sm mt-1">Add your first vessel to start generating proformas.</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2" data-testid="button-add-first-vessel">
            <Plus className="w-4 h-4" /> Add Your First Vessel
          </Button>
        </Card>
      )}
    </div>
  );
}
