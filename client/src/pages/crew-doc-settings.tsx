import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings2, Plus, Trash2, Save, Users, Car, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageMeta } from "@/components/page-meta";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import type { CrewDocConfig } from "@shared/schema";

const INP = "bg-slate-800/60 border-slate-700 text-white text-sm h-8";
const LBL = "text-xs text-slate-400 font-medium";

type AgentPerson = { name: string; tcId: string; birthPlace?: string; birthDate?: string };
type AgentVehicle = { plate: string; model?: string };

export default function CrewDocSettingsPage() {
  const { toast } = useToast();
  const { data: config, isLoading } = useQuery<CrewDocConfig | null>({
    queryKey: ["/api/crew-doc-config"],
  });

  const [portName, setPortName] = useState("");
  const [customsAuthority, setCustomsAuthority] = useState("");
  const [customsUnit, setCustomsUnit] = useState("");
  const [policeAuthority, setPoliceAuthority] = useState("");
  const [agentPersonnel, setAgentPersonnel] = useState<AgentPerson[]>([]);
  const [agentVehicles, setAgentVehicles] = useState<AgentVehicle[]>([]);
  const [ekimTurPersonnel, setEkimTurPersonnel] = useState<Array<{ name: string; tcId: string }>>([]);
  const [ekimTurVehicles, setEkimTurVehicles] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  if (config !== undefined && !initialized) {
    setInitialized(true);
    if (config) {
      setPortName(config.portName || "");
      setCustomsAuthority(config.customsAuthority || "");
      setCustomsUnit(config.customsUnit || "");
      setPoliceAuthority(config.policeAuthority || "");
      setAgentPersonnel((config.agentPersonnel as AgentPerson[]) || []);
      setAgentVehicles((config.agentVehicles as AgentVehicle[]) || []);
      setEkimTurPersonnel((config.ekimTurPersonnel as any[]) || []);
      setEkimTurVehicles((config.ekimTurVehicles as string[]) || []);
    } else {
      setPortName("STAR RAFİNERİ / ALİAĞA");
      setCustomsAuthority("ALİAĞA GÜMRÜK MÜDÜRLÜGÜ");
      setCustomsUnit("TÜPRAŞ GÜMRÜK MUHAFAZA KISIM AMİRLİĞİ");
      setPoliceAuthority("ALİAĞA DENİZ LİMANI ŞUBE MÜDÜRLÜĞÜ");
      setAgentPersonnel([
        { name: "MURAT ÖZVEREN", tcId: "20596432078", birthPlace: "AYDIN SÖKE", birthDate: "18.03.1973" },
        { name: "SELİM HEKİMOĞLU", tcId: "37204688318", birthPlace: "İZMİR KARŞIYAKA", birthDate: "11.04.1996" },
      ]);
      setAgentVehicles([
        { plate: "35 BFS 391", model: "FIAT EGEA" },
        { plate: "35 TH 488", model: "MERCEDES C200" },
        { plate: "35 CPE 445", model: "FORD TOURNEO COURIER" },
      ]);
      setEkimTurPersonnel([
        { name: "HAKKI KÜLCÜ", tcId: "40105762892" },
        { name: "ERKİN KÜLCÜ", tcId: "40021765656" },
        { name: "İSMET KÜLCÜ", tcId: "40117762446" },
        { name: "CENGİZ ÖZÇETİN", tcId: "53275161112" },
        { name: "YASİR SEZER", tcId: "10544927046" },
      ]);
      setEkimTurVehicles(["35 EKT 01", "35 AUC 222", "35 BTY 704", "35 AGP 679", "35 BKH 522", "35 BCL 435", "35 CBD 314", "35 AFG 429"]);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/crew-doc-config", {
        portName,
        customsAuthority,
        customsUnit,
        policeAuthority,
        agentPersonnel,
        agentVehicles,
        ekimTurPersonnel,
        ekimTurVehicles,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crew-doc-config"] });
      toast({ title: "Ayarlar kaydedildi" });
    },
  });

  const addAgentPerson = () => setAgentPersonnel(p => [...p, { name: "", tcId: "", birthPlace: "", birthDate: "" }]);
  const removeAgentPerson = (i: number) => setAgentPersonnel(p => p.filter((_, idx) => idx !== i));
  const updateAgentPerson = (i: number, field: keyof AgentPerson, val: string) =>
    setAgentPersonnel(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const addAgentVehicle = () => setAgentVehicles(v => [...v, { plate: "", model: "" }]);
  const removeAgentVehicle = (i: number) => setAgentVehicles(v => v.filter((_, idx) => idx !== i));
  const updateAgentVehicle = (i: number, field: keyof AgentVehicle, val: string) =>
    setAgentVehicles(v => v.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const addEkimTurPerson = () => setEkimTurPersonnel(p => [...p, { name: "", tcId: "" }]);
  const removeEkimTurPerson = (i: number) => setEkimTurPersonnel(p => p.filter((_, idx) => idx !== i));
  const updateEkimTurPerson = (i: number, field: string, val: string) =>
    setEkimTurPersonnel(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const addEkimTurVehicle = () => setEkimTurVehicles(v => [...v, ""]);
  const removeEkimTurVehicle = (i: number) => setEkimTurVehicles(v => v.filter((_, idx) => idx !== i));
  const updateEkimTurVehicle = (i: number, val: string) =>
    setEkimTurVehicles(v => v.map((item, idx) => idx === i ? val : item));

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageMeta title="Belge Yapılandırması | VesselPDA" description="Personel değişikliği belge ayarları" />

      <div className="max-w-3xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href="/husbandry">
              <Button size="sm" variant="ghost" className="text-xs gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Husbandry
              </Button>
            </Link>
            <div className="p-2.5 rounded-xl bg-blue-500/10">
              <Settings2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Belge Yapılandırması</h1>
              <p className="text-xs text-muted-foreground">Personel değişikliği belgelerinde kullanılacak sabit veriler</p>
            </div>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid="button-save-config"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-2"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>

        {/* Genel Bilgiler */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Genel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LBL}>Liman Adı</label>
                <Input value={portName} onChange={e => setPortName(e.target.value)} placeholder="STAR RAFİNERİ / ALİAĞA" className={`${INP} mt-1`} data-testid="input-port-name" />
              </div>
              <div>
                <label className={LBL}>Polis Birimi</label>
                <Input value={policeAuthority} onChange={e => setPoliceAuthority(e.target.value)} placeholder="ALİAĞA DENİZ LİMANI ŞUBE MÜDÜRLÜĞÜ" className={`${INP} mt-1`} data-testid="input-police-authority" />
              </div>
              <div>
                <label className={LBL}>Gümrük Müdürlüğü</label>
                <Input value={customsAuthority} onChange={e => setCustomsAuthority(e.target.value)} placeholder="ALİAĞA GÜMRÜK MÜDÜRLÜGÜ" className={`${INP} mt-1`} />
              </div>
              <div>
                <label className={LBL}>Gümrük Birimi (Muhafaza)</label>
                <Input value={customsUnit} onChange={e => setCustomsUnit(e.target.value)} placeholder="TÜPRAŞ GÜMRÜK MUHAFAZA KISIM AMİRLİĞİ" className={`${INP} mt-1`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acente Personeli */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" />
                Acente Personeli (Selim Denizcilik)
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addAgentPerson} className="text-xs h-7" data-testid="button-add-agent-person">
                <Plus className="w-3 h-3 mr-1" /> Kişi Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {agentPersonnel.map((p, i) => (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-center" data-testid={`agent-person-row-${i}`}>
                <Input value={p.name} onChange={e => updateAgentPerson(i, "name", e.target.value)} placeholder="Ad Soyad" className={INP} />
                <Input value={p.tcId} onChange={e => updateAgentPerson(i, "tcId", e.target.value)} placeholder="T.C. No" className={INP} />
                <Input value={p.birthPlace || ""} onChange={e => updateAgentPerson(i, "birthPlace", e.target.value)} placeholder="Doğum Yeri" className={INP} />
                <div className="flex gap-1">
                  <Input value={p.birthDate || ""} onChange={e => updateAgentPerson(i, "birthDate", e.target.value)} placeholder="Doğum Tarihi" className={`${INP} flex-1`} />
                  <Button size="icon" variant="ghost" onClick={() => removeAgentPerson(i)} className="w-8 h-8 text-destructive/60 hover:text-destructive flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {agentPersonnel.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-3">Acente personeli eklenmemiş</p>
            )}
          </CardContent>
        </Card>

        {/* Acente Araçları */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Car className="w-4 h-4 text-blue-400" />
                Acente Araçları
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addAgentVehicle} className="text-xs h-7" data-testid="button-add-agent-vehicle">
                <Plus className="w-3 h-3 mr-1" /> Araç Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {agentVehicles.map((v, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={v.plate} onChange={e => updateAgentVehicle(i, "plate", e.target.value)} placeholder="35 BFS 391" className={`${INP} w-36`} />
                <Input value={v.model || ""} onChange={e => updateAgentVehicle(i, "model", e.target.value)} placeholder="Araç Modeli" className={`${INP} flex-1`} />
                <Button size="icon" variant="ghost" onClick={() => removeAgentVehicle(i)} className="w-8 h-8 text-destructive/60 hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {agentVehicles.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-3">Araç eklenmemiş</p>
            )}
          </CardContent>
        </Card>

        {/* Ekim Tur Personeli */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Ekim Tur Personeli
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addEkimTurPerson} className="text-xs h-7" data-testid="button-add-ekim-person">
                <Plus className="w-3 h-3 mr-1" /> Kişi Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {ekimTurPersonnel.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={p.name} onChange={e => updateEkimTurPerson(i, "name", e.target.value)} placeholder="Ad Soyad" className={`${INP} flex-1`} />
                <Input value={p.tcId} onChange={e => updateEkimTurPerson(i, "tcId", e.target.value)} placeholder="T.C. No" className={`${INP} w-40`} />
                <Button size="icon" variant="ghost" onClick={() => removeEkimTurPerson(i)} className="w-8 h-8 text-destructive/60 hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {ekimTurPersonnel.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-3">Ekim Tur personeli eklenmemiş</p>
            )}
          </CardContent>
        </Card>

        {/* Ekim Tur Araçları */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Car className="w-4 h-4 text-emerald-400" />
                Ekim Tur Araçları
              </CardTitle>
              <Button size="sm" variant="outline" onClick={addEkimTurVehicle} className="text-xs h-7" data-testid="button-add-ekim-vehicle">
                <Plus className="w-3 h-3 mr-1" /> Araç Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {ekimTurVehicles.map((v, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={v} onChange={e => updateEkimTurVehicle(i, e.target.value)} placeholder="35 EKT 01" className={`${INP} flex-1`} />
                <Button size="icon" variant="ghost" onClick={() => removeEkimTurVehicle(i)} className="w-8 h-8 text-destructive/60 hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            {ekimTurVehicles.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-3">Araç eklenmemiş</p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end pb-4">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
            data-testid="button-save-config-bottom"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Kaydediliyor..." : "Tüm Ayarları Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}
