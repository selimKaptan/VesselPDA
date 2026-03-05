import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft, FileSpreadsheet, Download, Mail, Globe, GlobeLock,
  Plus, Trash2, Loader2, CheckCircle2, AlertCircle, RefreshCw, Copy
} from "lucide-react";
import type { VesselQ88, InsertVesselQ88 } from "@shared/schema";

const COMM_OPTIONS = ["GMDSS", "INMARSAT-C", "VHF", "SSB Radio", "EPIRB", "SART", "AIS Class A", "Telex", "Fax"];
const NAV_OPTIONS = ["ECDIS", "GPS", "Radar X-Band", "Radar S-Band", "Gyro Compass", "Echo Sounder", "ARPA", "AIS", "LORAN-C"];
const CERT_OPTIONS = ["SOLAS", "MARPOL", "ISM", "ISPS", "MLC 2006", "CLC", "BWM Convention", "AFS Convention", "Bunker Convention", "Load Lines", "STCW"];

const formSchema = z.object({
  vesselName: z.string().optional(),
  exName: z.string().optional(),
  flag: z.string().optional(),
  portOfRegistry: z.string().optional(),
  imoNumber: z.string().optional(),
  callSign: z.string().optional(),
  mmsiNumber: z.string().optional(),
  vesselType: z.string().optional(),
  yearBuilt: z.number().int().optional().nullable(),
  builder: z.string().optional(),
  classificationSociety: z.string().optional(),
  classNotation: z.string().optional(),
  piClub: z.string().optional(),
  hullMaterial: z.string().optional(),
  grt: z.number().optional().nullable(),
  nrt: z.number().optional().nullable(),
  dwt: z.number().optional().nullable(),
  displacement: z.number().optional().nullable(),
  loa: z.number().optional().nullable(),
  lbp: z.number().optional().nullable(),
  beam: z.number().optional().nullable(),
  depth: z.number().optional().nullable(),
  maxDraft: z.number().optional().nullable(),
  summerDraft: z.number().optional().nullable(),
  tpc: z.number().optional().nullable(),
  lightShipWeight: z.number().optional().nullable(),
  grainCapacity: z.number().optional().nullable(),
  baleCapacity: z.number().optional().nullable(),
  numberOfHolds: z.number().int().optional().nullable(),
  numberOfHatches: z.number().int().optional().nullable(),
  holdDimensions: z.array(z.object({
    holdNumber: z.number(),
    length: z.number(),
    breadth: z.number(),
    depth: z.number(),
    grainCapacity: z.number().optional(),
    baleCapacity: z.number().optional(),
  })).optional(),
  hatchType: z.string().optional(),
  hatchCovers: z.string().optional(),
  numberOfCranes: z.number().int().optional().nullable(),
  craneCapacity: z.string().optional(),
  numberOfDerricks: z.number().int().optional().nullable(),
  derrickCapacity: z.string().optional(),
  grabsAvailable: z.boolean().optional(),
  grabCapacity: z.string().optional(),
  cargoGearDetails: z.string().optional(),
  mainEngine: z.string().optional(),
  enginePower: z.string().optional(),
  serviceSpeed: z.number().optional().nullable(),
  maxSpeed: z.number().optional().nullable(),
  fuelType: z.string().optional(),
  fuelConsumption: z.string().optional(),
  auxiliaryEngines: z.string().optional(),
  bowThruster: z.boolean().optional(),
  bowThrusterPower: z.string().optional(),
  heavyFuelCapacity: z.number().optional().nullable(),
  dieselOilCapacity: z.number().optional().nullable(),
  freshWaterCapacity: z.number().optional().nullable(),
  ballastCapacity: z.number().optional().nullable(),
  communicationEquipment: z.array(z.string()).optional(),
  navigationEquipment: z.array(z.string()).optional(),
  lifeboats: z.string().optional(),
  lifeRafts: z.string().optional(),
  fireExtinguishing: z.string().optional(),
  crewCapacity: z.number().int().optional().nullable(),
  officerCabins: z.number().int().optional().nullable(),
  crewCabins: z.number().int().optional().nullable(),
  certificatesOnBoard: z.array(z.string()).optional(),
  specialEquipment: z.string().optional(),
  iceClass: z.string().optional(),
  fittedForHeavyLifts: z.boolean().optional(),
  co2Fitted: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  status: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function numOrNull(v: any): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function q88ToForm(q88: VesselQ88): FormValues {
  return {
    ...q88,
    holdDimensions: (q88.holdDimensions as any[]) ?? [],
    communicationEquipment: (q88.communicationEquipment as string[]) ?? [],
    navigationEquipment: (q88.navigationEquipment as string[]) ?? [],
    certificatesOnBoard: (q88.certificatesOnBoard as string[]) ?? [],
  } as FormValues;
}

function calcCompletion(values: FormValues): { total: number; filled: number; pct: number } {
  const skip = new Set(["isPublic", "status", "holdDimensions", "communicationEquipment", "navigationEquipment", "certificatesOnBoard", "grabsAvailable", "bowThruster", "fittedForHeavyLifts", "co2Fitted"]);
  const keys = Object.keys(formSchema.shape).filter(k => !skip.has(k));
  let filled = 0;
  for (const k of keys) {
    const v = (values as any)[k];
    if (v !== null && v !== undefined && v !== "") filled++;
  }
  return { total: keys.length, filled, pct: Math.round((filled / keys.length) * 100) };
}

function sectionCompletion(values: FormValues, fields: string[]): number {
  let filled = 0;
  for (const f of fields) {
    const v = (values as any)[f];
    if (v !== null && v !== undefined && v !== "") filled++;
  }
  return Math.round((filled / fields.length) * 100);
}

const SECTION_FIELDS = {
  general: ["vesselName","flag","imoNumber","callSign","vesselType","yearBuilt","builder","classificationSociety","piClub"],
  dimensions: ["grt","nrt","dwt","loa","beam","depth","maxDraft","summerDraft"],
  holds: ["numberOfHolds","numberOfHatches","hatchType","hatchCovers"],
  gear: ["numberOfCranes","craneCapacity","cargoGearDetails"],
  engine: ["mainEngine","enginePower","serviceSpeed","fuelType","fuelConsumption"],
  tanks: ["heavyFuelCapacity","dieselOilCapacity","freshWaterCapacity","ballastCapacity"],
  equip: [],
  safety: ["lifeboats","lifeRafts","fireExtinguishing"],
  crew: ["crewCapacity","officerCabins","crewCabins"],
  special: ["iceClass","specialEquipment"],
};

function TabLabel({ label, pct }: { label: string; pct: number }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span>{label}</span>
      <span className={`text-[9px] font-semibold ${pct >= 80 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-slate-500"}`}>{pct}%</span>
    </span>
  );
}

function UnitSpan({ unit }: { unit: string }) {
  return <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{unit}</span>;
}

export default function VesselQ88Page() {
  const { vesselId } = useParams<{ vesselId: string }>();
  const vid = parseInt(vesselId ?? "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [targetVesselId, setTargetVesselId] = useState("");

  const { data: vessels } = useQuery<any[]>({ queryKey: ["/api/vessels"] });
  const vessel = vessels?.find((v: any) => v.id === vid);

  const { data: q88, isLoading, error } = useQuery<VesselQ88>({
    queryKey: ["/api/vessels", vid, "q88"],
    queryFn: () => fetch(`/api/vessels/${vid}/q88`).then(r => r.ok ? r.json() : null),
    retry: false,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      holdDimensions: [],
      communicationEquipment: [],
      navigationEquipment: [],
      certificatesOnBoard: [],
      grabsAvailable: false,
      bowThruster: false,
      fittedForHeavyLifts: false,
      co2Fitted: false,
      isPublic: false,
      status: "draft",
    },
  });

  useEffect(() => {
    if (q88) {
      form.reset(q88ToForm(q88));
    }
  }, [q88]);

  const { fields: holdFields, append: appendHold, remove: removeHold } = useFieldArray({
    control: form.control,
    name: "holdDimensions",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/vessels/${vid}/q88`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", vid, "q88"] });
      toast({ title: "Q88 created", description: "Auto-filled from vessel data." });
    },
    onError: async (err: any) => {
      if (err?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ["/api/vessels", vid, "q88"] });
      } else {
        toast({ title: "Error", description: "Failed to create Q88", variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<FormValues>) => apiRequest("PATCH", `/api/vessels/${vid}/q88`, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", vid, "q88"] });
      toast({ title: "Saved", description: "Q88 updated successfully." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save Q88", variant: "destructive" }),
  });

  const shareMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/vessels/${vid}/q88/share`, { email: shareEmail, message: shareMsg }),
    onSuccess: () => {
      setShareOpen(false);
      setShareEmail("");
      setShareMsg("");
      queryClient.invalidateQueries({ queryKey: ["/api/vessels", vid, "q88"] });
      toast({ title: "Shared", description: "Q88 sent via email." });
    },
    onError: () => toast({ title: "Error", description: "Failed to share Q88", variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/vessels/${vid}/q88/duplicate`, { targetVesselId: parseInt(targetVesselId) }),
    onSuccess: () => {
      setDuplicateOpen(false);
      toast({ title: "Duplicated", description: "Q88 copied to target vessel." });
    },
    onError: () => toast({ title: "Error", description: "Failed to duplicate Q88", variant: "destructive" }),
  });

  const onSave = (data: FormValues) => {
    if (!q88) {
      createMutation.mutate();
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleAutoFill = () => {
    createMutation.mutate();
  };

  const handleExportPDF = useCallback(async () => {
    const values = form.getValues();
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const w = 210, m = 14;
    let y = 14;

    const drawHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, w, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("VESSEL PARTICULARS QUESTIONNAIRE (Q88 v1.5.1)", m, 10);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated by VesselPDA  |  ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}  |  Version ${q88?.version ?? 1}`, m, 17);
      y = 28;
    };

    const drawSectionTitle = (title: string) => {
      if (y > 260) { doc.addPage(); drawHeader(); }
      doc.setFillColor(241, 245, 249);
      doc.rect(m - 2, y - 4, w - 2 * m + 4, 8, "F");
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(title, m, y);
      y += 6;
    };

    const drawRow = (label: string, value: string) => {
      if (y > 270) { doc.addPage(); drawHeader(); }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(label, m, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text(value || "—", m + 55, y);
      doc.setDrawColor(226, 232, 240);
      doc.line(m, y + 1.5, w - m, y + 1.5);
      y += 6;
    };

    drawHeader();

    drawSectionTitle("1. GENERAL INFORMATION");
    drawRow("Vessel Name", values.vesselName ?? "");
    drawRow("Ex-Name", values.exName ?? "");
    drawRow("Flag", values.flag ?? "");
    drawRow("Port of Registry", values.portOfRegistry ?? "");
    drawRow("IMO Number", values.imoNumber ?? "");
    drawRow("Call Sign", values.callSign ?? "");
    drawRow("MMSI Number", values.mmsiNumber ?? "");
    drawRow("Vessel Type", values.vesselType ?? "");
    drawRow("Year Built", values.yearBuilt?.toString() ?? "");
    drawRow("Builder", values.builder ?? "");
    drawRow("Classification Society", values.classificationSociety ?? "");
    drawRow("Class Notation", values.classNotation ?? "");
    drawRow("P&I Club", values.piClub ?? "");
    drawRow("Hull Material", values.hullMaterial ?? "Steel");
    y += 3;

    drawSectionTitle("2. DIMENSIONS & TONNAGE");
    drawRow("GRT", values.grt?.toString() ?? "");
    drawRow("NRT", values.nrt?.toString() ?? "");
    drawRow("DWT (MT)", values.dwt?.toString() ?? "");
    drawRow("Displacement (MT)", values.displacement?.toString() ?? "");
    drawRow("LOA (m)", values.loa?.toString() ?? "");
    drawRow("LBP (m)", values.lbp?.toString() ?? "");
    drawRow("Beam (m)", values.beam?.toString() ?? "");
    drawRow("Depth (m)", values.depth?.toString() ?? "");
    drawRow("Max Draft (m)", values.maxDraft?.toString() ?? "");
    drawRow("Summer Draft (m)", values.summerDraft?.toString() ?? "");
    drawRow("TPC", values.tpc?.toString() ?? "");
    drawRow("Light Ship Weight (MT)", values.lightShipWeight?.toString() ?? "");
    drawRow("Grain Capacity (cbm)", values.grainCapacity?.toString() ?? "");
    drawRow("Bale Capacity (cbm)", values.baleCapacity?.toString() ?? "");
    y += 3;

    drawSectionTitle("3. HOLDS & HATCHES");
    drawRow("Number of Holds", values.numberOfHolds?.toString() ?? "");
    drawRow("Number of Hatches", values.numberOfHatches?.toString() ?? "");
    drawRow("Hatch Type", values.hatchType ?? "");
    drawRow("Hatch Covers", values.hatchCovers ?? "");
    y += 3;

    drawSectionTitle("4. CARGO GEAR");
    drawRow("Number of Cranes", values.numberOfCranes?.toString() ?? "");
    drawRow("Crane Capacity", values.craneCapacity ?? "");
    drawRow("Number of Derricks", values.numberOfDerricks?.toString() ?? "");
    drawRow("Derrick Capacity", values.derrickCapacity ?? "");
    drawRow("Grabs Available", values.grabsAvailable ? "Yes" : "No");
    drawRow("Grab Capacity", values.grabCapacity ?? "");
    y += 3;

    drawSectionTitle("5. ENGINE & SPEED");
    drawRow("Main Engine", values.mainEngine ?? "");
    drawRow("Engine Power", values.enginePower ?? "");
    drawRow("Service Speed (knots)", values.serviceSpeed?.toString() ?? "");
    drawRow("Max Speed (knots)", values.maxSpeed?.toString() ?? "");
    drawRow("Fuel Type", values.fuelType ?? "");
    drawRow("Fuel Consumption", values.fuelConsumption ?? "");
    drawRow("Auxiliary Engines", values.auxiliaryEngines ?? "");
    drawRow("Bow Thruster", values.bowThruster ? "Yes" : "No");
    drawRow("Bow Thruster Power", values.bowThrusterPower ?? "");
    y += 3;

    drawSectionTitle("6. TANK CAPACITIES");
    drawRow("Heavy Fuel Oil (MT)", values.heavyFuelCapacity?.toString() ?? "");
    drawRow("Diesel Oil (MT)", values.dieselOilCapacity?.toString() ?? "");
    drawRow("Fresh Water (MT)", values.freshWaterCapacity?.toString() ?? "");
    drawRow("Ballast (MT)", values.ballastCapacity?.toString() ?? "");
    y += 3;

    drawSectionTitle("7. COMMUNICATION & NAVIGATION");
    drawRow("Comm. Equipment", (values.communicationEquipment ?? []).join(", "));
    drawRow("Nav. Equipment", (values.navigationEquipment ?? []).join(", "));
    y += 3;

    drawSectionTitle("8. SAFETY");
    drawRow("Lifeboats", values.lifeboats ?? "");
    drawRow("Life Rafts", values.lifeRafts ?? "");
    drawRow("Fire Extinguishing", values.fireExtinguishing ?? "");
    y += 3;

    drawSectionTitle("9. CREW");
    drawRow("Crew Capacity", values.crewCapacity?.toString() ?? "");
    drawRow("Officer Cabins", values.officerCabins?.toString() ?? "");
    drawRow("Crew Cabins", values.crewCabins?.toString() ?? "");
    y += 3;

    drawSectionTitle("10. CERTIFICATES & SPECIAL EQUIPMENT");
    drawRow("Certificates on Board", (values.certificatesOnBoard ?? []).join(", "));
    drawRow("Ice Class", values.iceClass ?? "");
    drawRow("Fitted for Heavy Lifts", values.fittedForHeavyLifts ? "Yes" : "No");
    drawRow("CO2 Fitted", values.co2Fitted ? "Yes" : "No");
    if (values.specialEquipment) {
      drawRow("Special Equipment", values.specialEquipment);
    }

    doc.save(`Q88_${values.vesselName ?? vessel?.name ?? "vessel"}.pdf`);
  }, [form, q88, vessel]);

  const values = form.watch();
  const completion = calcCompletion(values);

  const statusBadge = q88?.status === "complete"
    ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">Complete</Badge>
    : q88?.status === "shared"
    ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400">Shared</Badge>
    : q88
    ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400">Draft</Badge>
    : <Badge variant="outline" className="text-slate-500">No Q88</Badge>;

  const pct = (section: keyof typeof SECTION_FIELDS) =>
    SECTION_FIELDS[section].length > 0 ? sectionCompletion(values, SECTION_FIELDS[section]) : 0;

  if (isNaN(vid) || vid === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Invalid vessel ID.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/vessels">
            <Button variant="ghost" size="sm" data-testid="button-back-vessels">
              <ArrowLeft className="w-4 h-4 mr-1" /> Vessels
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-500" />
              <h1 className="text-xl font-bold text-foreground">Q88 Questionnaire</h1>
              {statusBadge}
              {q88 && <span className="text-xs text-muted-foreground">v{q88.version}</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {vessel?.name ?? `Vessel #${vid}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!q88 && (
            <Button
              onClick={handleAutoFill}
              disabled={createMutation.isPending}
              data-testid="button-autofill-q88"
              size="sm"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Auto-fill from Vessel
            </Button>
          )}
          {q88 && (
            <>
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                {values.isPublic ? <Globe className="w-3.5 h-3.5 text-emerald-500" /> : <GlobeLock className="w-3.5 h-3.5 text-slate-400" />}
                <span className="text-xs text-muted-foreground">{values.isPublic ? "Public" : "Private"}</span>
                <Switch
                  checked={values.isPublic ?? false}
                  onCheckedChange={(v) => {
                    form.setValue("isPublic", v);
                    updateMutation.mutate({ isPublic: v });
                  }}
                  data-testid="switch-q88-public"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => setDuplicateOpen(true)} data-testid="button-q88-duplicate">
                <Copy className="w-4 h-4 mr-1" /> Duplicate
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShareOpen(true)} data-testid="button-q88-share">
                <Mail className="w-4 h-4 mr-1" /> Share
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-q88-export-pdf">
                <Download className="w-4 h-4 mr-1" /> Export PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Completion progress */}
      {q88 && (
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Q88 Completeness</span>
            <span className={`text-sm font-bold ${completion.pct >= 80 ? "text-emerald-500" : completion.pct >= 50 ? "text-amber-500" : "text-rose-500"}`}>
              {completion.pct}%
            </span>
          </div>
          <Progress value={completion.pct} className="h-2" data-testid="progress-q88-completeness" />
          <p className="text-xs text-muted-foreground">{completion.filled} of {completion.total} fields completed</p>
        </div>
      )}

      {/* No Q88 state */}
      {!q88 && !isLoading && (
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <h2 className="text-lg font-semibold mb-2">No Q88 Questionnaire</h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            This vessel doesn't have a Q88 yet. Click "Auto-fill from Vessel" to create one pre-populated with the vessel's existing data.
          </p>
          <Button onClick={handleAutoFill} disabled={createMutation.isPending} data-testid="button-create-q88">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Q88
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Form */}
      {q88 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)}>
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {[
                  { value: "general", label: "General", section: "general" as const },
                  { value: "dimensions", label: "Dimensions", section: "dimensions" as const },
                  { value: "holds", label: "Holds", section: "holds" as const },
                  { value: "gear", label: "Cargo Gear", section: "gear" as const },
                  { value: "engine", label: "Engine", section: "engine" as const },
                  { value: "tanks", label: "Tanks", section: "tanks" as const },
                  { value: "equipment", label: "Equipment", section: "equip" as const },
                  { value: "safety", label: "Safety", section: "safety" as const },
                  { value: "crew", label: "Crew", section: "crew" as const },
                  { value: "special", label: "Special", section: "special" as const },
                ].map(({ value, label, section }) => (
                  <TabsTrigger key={value} value={value} className="text-xs px-3 py-2" data-testid={`tab-q88-${value}`}>
                    <TabLabel label={label} pct={pct(section)} />
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Tab 1: General */}
              <TabsContent value="general" className="bg-card border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">1. General Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "vesselName", label: "Vessel Name" },
                    { name: "exName", label: "Ex-Name (Previous Name)" },
                    { name: "flag", label: "Flag" },
                    { name: "portOfRegistry", label: "Port of Registry" },
                    { name: "imoNumber", label: "IMO Number" },
                    { name: "callSign", label: "Call Sign" },
                    { name: "mmsiNumber", label: "MMSI Number" },
                    { name: "vesselType", label: "Vessel Type" },
                    { name: "builder", label: "Shipbuilder / Yard" },
                    { name: "classificationSociety", label: "Classification Society" },
                    { name: "classNotation", label: "Class Notation" },
                    { name: "piClub", label: "P&I Club" },
                    { name: "hullMaterial", label: "Hull Material" },
                  ].map(({ name, label }) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{label}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} placeholder="—" data-testid={`input-q88-${name}`} />
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}
                  <FormField control={form.control} name="yearBuilt" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Year Built</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="e.g. 2015"
                          data-testid="input-q88-yearBuilt"
                        />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end mt-6">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-general">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Dimensions */}
              <TabsContent value="dimensions" className="bg-card border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">2. Dimensions &amp; Tonnage</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "grt", label: "GRT (Gross Register Tons)" },
                    { name: "nrt", label: "NRT (Net Register Tons)" },
                    { name: "dwt", label: "DWT", unit: "MT" },
                    { name: "displacement", label: "Displacement", unit: "MT" },
                    { name: "loa", label: "LOA (Length Overall)", unit: "m" },
                    { name: "lbp", label: "LBP (Length BP)", unit: "m" },
                    { name: "beam", label: "Beam", unit: "m" },
                    { name: "depth", label: "Depth", unit: "m" },
                    { name: "maxDraft", label: "Max Draft", unit: "m" },
                    { name: "summerDraft", label: "Summer Draft", unit: "m" },
                    { name: "tpc", label: "TPC (Tons Per Cm)" },
                    { name: "lightShipWeight", label: "Light Ship Weight", unit: "MT" },
                    { name: "grainCapacity", label: "Grain Capacity", unit: "cbm" },
                    { name: "baleCapacity", label: "Bale Capacity", unit: "cbm" },
                  ].map(({ name, label, unit }) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{label}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="any"
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="—"
                              className={unit ? "pr-12" : ""}
                              data-testid={`input-q88-${name}`}
                            />
                            {unit && <UnitSpan unit={unit} />}
                          </div>
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
                <div className="flex justify-end mt-6">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-dimensions">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 3: Holds & Hatches */}
              <TabsContent value="holds" className="bg-card border rounded-xl p-6 space-y-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">3. Holds &amp; Hatches</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { name: "numberOfHolds", label: "Number of Holds", type: "int" },
                    { name: "numberOfHatches", label: "Number of Hatches", type: "int" },
                    { name: "hatchType", label: "Hatch Type" },
                    { name: "hatchCovers", label: "Hatch Covers" },
                  ].map(({ name, label, type }) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">{label}</FormLabel>
                        <FormControl>
                          {type === "int" ? (
                            <Input
                              type="number"
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                              placeholder="—"
                              data-testid={`input-q88-${name}`}
                            />
                          ) : (
                            <Input {...field} value={field.value ?? ""} placeholder="—" data-testid={`input-q88-${name}`} />
                          )}
                        </FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Hold Dimensions</h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => appendHold({ holdNumber: holdFields.length + 1, length: 0, breadth: 0, depth: 0 })}
                      data-testid="button-add-hold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Hold
                    </Button>
                  </div>
                  {holdFields.length === 0 && (
                    <p className="text-xs text-muted-foreground">No holds added yet. Click "Add Hold" to begin.</p>
                  )}
                  {holdFields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-7 gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 items-end">
                      <div className="col-span-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">Hold #</label>
                        <Input
                          type="number"
                          {...form.register(`holdDimensions.${index}.holdNumber`, { valueAsNumber: true })}
                          className="h-8 text-sm"
                          data-testid={`input-hold-number-${index}`}
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">L (m)</label>
                        <Input type="number" step="any" {...form.register(`holdDimensions.${index}.length`, { valueAsNumber: true })} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">B (m)</label>
                        <Input type="number" step="any" {...form.register(`holdDimensions.${index}.breadth`, { valueAsNumber: true })} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">D (m)</label>
                        <Input type="number" step="any" {...form.register(`holdDimensions.${index}.depth`, { valueAsNumber: true })} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">Grain cbm</label>
                        <Input type="number" step="any" {...form.register(`holdDimensions.${index}.grainCapacity`, { valueAsNumber: true })} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">Bale cbm</label>
                        <Input type="number" step="any" {...form.register(`holdDimensions.${index}.baleCapacity`, { valueAsNumber: true })} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => removeHold(index)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-holds">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 4: Cargo Gear */}
              <TabsContent value="gear" className="bg-card border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">4. Cargo Gear</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="numberOfCranes" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Number of Cranes</FormLabel><FormControl>
                      <Input type="number" value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} placeholder="—" data-testid="input-q88-numberOfCranes" />
                    </FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="craneCapacity" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Crane Capacity (e.g. 25t × 4)</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="—" data-testid="input-q88-craneCapacity" />
                    </FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="numberOfDerricks" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Number of Derricks</FormLabel><FormControl>
                      <Input type="number" value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} placeholder="—" data-testid="input-q88-numberOfDerricks" />
                    </FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="derrickCapacity" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Derrick Capacity</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="—" data-testid="input-q88-derrickCapacity" />
                    </FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="grabCapacity" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Grab Capacity</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="—" data-testid="input-q88-grabCapacity" />
                    </FormControl></FormItem>
                  )} />
                  <div className="flex items-center gap-3 pt-5">
                    <FormField control={form.control} name="grabsAvailable" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-grabsAvailable" /></FormControl>
                        <FormLabel className="text-xs font-normal">Grabs Available</FormLabel>
                      </FormItem>
                    )} />
                  </div>
                </div>
                <div className="mt-4">
                  <FormField control={form.control} name="cargoGearDetails" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Additional Cargo Gear Details</FormLabel><FormControl>
                      <Textarea {...field} value={field.value ?? ""} placeholder="Describe additional gear..." rows={3} data-testid="textarea-q88-cargoGearDetails" />
                    </FormControl></FormItem>
                  )} />
                </div>
                <div className="flex justify-end mt-6">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-gear">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 5: Engine & Speed */}
              <TabsContent value="engine" className="bg-card border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">5. Engine &amp; Speed</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { name: "mainEngine", label: "Main Engine", type: "text" },
                    { name: "enginePower", label: "Engine Power (kW/HP)", type: "text" },
                    { name: "fuelType", label: "Fuel Type", type: "text" },
                    { name: "fuelConsumption", label: "Fuel Consumption (e.g. 28t/day)", type: "text" },
                    { name: "auxiliaryEngines", label: "Auxiliary Engines", type: "text" },
                    { name: "bowThrusterPower", label: "Bow Thruster Power", type: "text" },
                  ].map(({ name, label }) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl>
                        <Input {...field} value={field.value ?? ""} placeholder="—" data-testid={`input-q88-${name}`} />
                      </FormControl></FormItem>
                    )} />
                  ))}
                  {[
                    { name: "serviceSpeed", label: "Service Speed", unit: "knots" },
                    { name: "maxSpeed", label: "Max Speed", unit: "knots" },
                  ].map(({ name, label, unit }) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.1"
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="—"
                            className="pr-16"
                            data-testid={`input-q88-${name}`}
                          />
                          <UnitSpan unit={unit} />
                        </div>
                      </FormControl></FormItem>
                    )} />
                  ))}
                  <div className="flex items-center gap-3 pt-5">
                    <FormField control={form.control} name="bowThruster" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-bowThruster" /></FormControl>
                        <FormLabel className="text-xs font-normal">Bow Thruster Fitted</FormLabel>
                      </FormItem>
                    )} />
                  </div>
                </div>
                <div className="flex justify-end mt-6">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-engine">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 6: Tanks */}
              <TabsContent value="tanks" className="bg-card border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">6. Tank Capacities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { name: "heavyFuelCapacity", label: "Heavy Fuel Oil Capacity" },
                    { name: "dieselOilCapacity", label: "Diesel Oil Capacity" },
                    { name: "freshWaterCapacity", label: "Fresh Water Capacity" },
                    { name: "ballastCapacity", label: "Ballast Water Capacity" },
                  ].map(({ name, label }) => (
                    <FormField key={name} control={form.control} name={name as any} render={({ field }) => (
                      <FormItem><FormLabel className="text-xs">{label}</FormLabel><FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="any"
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                            placeholder="—"
                            className="pr-10"
                            data-testid={`input-q88-${name}`}
                          />
                          <UnitSpan unit="MT" />
                        </div>
                      </FormControl></FormItem>
                    )} />
                  ))}
                </div>
                <div className="flex justify-end mt-6">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-tanks">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 7: Equipment */}
              <TabsContent value="equipment" className="bg-card border rounded-xl p-6 space-y-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">7. Communication &amp; Navigation Equipment</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-medium mb-3">Communication Equipment</h3>
                    <div className="space-y-2">
                      {COMM_OPTIONS.map(opt => {
                        const commEq = form.watch("communicationEquipment") ?? [];
                        const checked = commEq.includes(opt);
                        return (
                          <div key={opt} className="flex items-center gap-2">
                            <Checkbox
                              id={`comm-${opt}`}
                              checked={checked}
                              data-testid={`checkbox-comm-${opt.replace(/\s+/g, "-")}`}
                              onCheckedChange={(v) => {
                                const current = form.getValues("communicationEquipment") ?? [];
                                form.setValue("communicationEquipment", v ? [...current, opt] : current.filter(x => x !== opt));
                              }}
                            />
                            <label htmlFor={`comm-${opt}`} className="text-sm cursor-pointer">{opt}</label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium mb-3">Navigation Equipment</h3>
                    <div className="space-y-2">
                      {NAV_OPTIONS.map(opt => {
                        const navEq = form.watch("navigationEquipment") ?? [];
                        const checked = navEq.includes(opt);
                        return (
                          <div key={opt} className="flex items-center gap-2">
                            <Checkbox
                              id={`nav-${opt}`}
                              checked={checked}
                              data-testid={`checkbox-nav-${opt.replace(/\s+/g, "-")}`}
                              onCheckedChange={(v) => {
                                const current = form.getValues("navigationEquipment") ?? [];
                                form.setValue("navigationEquipment", v ? [...current, opt] : current.filter(x => x !== opt));
                              }}
                            />
                            <label htmlFor={`nav-${opt}`} className="text-sm cursor-pointer">{opt}</label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-equipment">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 8: Safety */}
              <TabsContent value="safety" className="bg-card border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">8. Safety Equipment</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="lifeboats" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Lifeboats</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="e.g. 2 × 25 persons" data-testid="input-q88-lifeboats" />
                    </FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="lifeRafts" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Life Rafts</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="e.g. 4 × 20 persons" data-testid="input-q88-lifeRafts" />
                    </FormControl></FormItem>
                  )} />
                </div>
                <div className="mt-4">
                  <FormField control={form.control} name="fireExtinguishing" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Fire Extinguishing Systems</FormLabel><FormControl>
                      <Textarea {...field} value={field.value ?? ""} placeholder="Describe fire extinguishing systems..." rows={3} data-testid="textarea-q88-fireExtinguishing" />
                    </FormControl></FormItem>
                  )} />
                </div>
                <div className="flex justify-end mt-6">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-safety">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 9: Crew */}
              <TabsContent value="crew" className="bg-card border rounded-xl p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">9. Crew &amp; Accommodation</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField control={form.control} name="crewCapacity" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Total Crew Capacity</FormLabel><FormControl>
                      <Input type="number" value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} placeholder="—" data-testid="input-q88-crewCapacity" />
                    </FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="officerCabins" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Officer Cabins</FormLabel><FormControl>
                      <Input type="number" value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} placeholder="—" data-testid="input-q88-officerCabins" />
                    </FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name="crewCabins" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Crew Cabins</FormLabel><FormControl>
                      <Input type="number" value={field.value ?? ""} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} placeholder="—" data-testid="input-q88-crewCabins" />
                    </FormControl></FormItem>
                  )} />
                </div>
                <div className="flex justify-end mt-6">
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-crew">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 10: Special */}
              <TabsContent value="special" className="bg-card border rounded-xl p-6 space-y-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">10. Certificates &amp; Special Equipment</h2>

                <div>
                  <h3 className="text-sm font-medium mb-3">Certificates on Board</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CERT_OPTIONS.map(opt => {
                      const certs = form.watch("certificatesOnBoard") ?? [];
                      const checked = certs.includes(opt);
                      return (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox
                            id={`cert-${opt}`}
                            checked={checked}
                            data-testid={`checkbox-cert-${opt.replace(/\s+/g, "-")}`}
                            onCheckedChange={(v) => {
                              const current = form.getValues("certificatesOnBoard") ?? [];
                              form.setValue("certificatesOnBoard", v ? [...current, opt] : current.filter(x => x !== opt));
                            }}
                          />
                          <label htmlFor={`cert-${opt}`} className="text-sm cursor-pointer">{opt}</label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="iceClass" render={({ field }) => (
                    <FormItem><FormLabel className="text-xs">Ice Class</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="e.g. 1A, 1B, None" data-testid="input-q88-iceClass" />
                    </FormControl></FormItem>
                  )} />
                  <div className="flex flex-col gap-4 pt-2">
                    <FormField control={form.control} name="fittedForHeavyLifts" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-fittedForHeavyLifts" /></FormControl>
                        <FormLabel className="text-xs font-normal">Fitted for Heavy Lifts</FormLabel>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="co2Fitted" render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl><Switch checked={field.value ?? false} onCheckedChange={field.onChange} data-testid="switch-co2Fitted" /></FormControl>
                        <FormLabel className="text-xs font-normal">CO2 Fire System Fitted</FormLabel>
                      </FormItem>
                    )} />
                  </div>
                </div>

                <FormField control={form.control} name="specialEquipment" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Special Equipment / Remarks</FormLabel><FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Describe any special equipment or remarks..." rows={4} data-testid="textarea-q88-specialEquipment" />
                  </FormControl></FormItem>
                )} />

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Mark as Complete</label>
                    <Switch
                      checked={form.watch("status") === "complete"}
                      onCheckedChange={(v) => form.setValue("status", v ? "complete" : "draft")}
                      data-testid="switch-q88-status-complete"
                    />
                  </div>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-special">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      )}

      {/* Share Dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Q88 via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Recipient Email</label>
              <Input
                type="email"
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                placeholder="charter@company.com"
                data-testid="input-share-email"
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Message (optional)</label>
              <Textarea
                value={shareMsg}
                onChange={e => setShareMsg(e.target.value)}
                placeholder="Please find the Q88 vessel particulars attached..."
                rows={3}
                data-testid="textarea-share-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button onClick={() => shareMutation.mutate()} disabled={!shareEmail || shareMutation.isPending} data-testid="button-send-share">
              {shareMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Send Q88
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Q88 to Another Vessel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select the target vessel to copy this Q88 to. The copy will be saved as a draft.</p>
            <div>
              <label className="text-sm font-medium block mb-1.5">Target Vessel</label>
              <select
                value={targetVesselId}
                onChange={e => setTargetVesselId(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                data-testid="select-duplicate-vessel"
              >
                <option value="">Select vessel...</option>
                {vessels?.filter((v: any) => v.id !== vid).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>Cancel</Button>
            <Button onClick={() => duplicateMutation.mutate()} disabled={!targetVesselId || duplicateMutation.isPending} data-testid="button-confirm-duplicate">
              {duplicateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
