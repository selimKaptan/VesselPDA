import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  FileBarChart2, Ship, MapPin, Calendar, ArrowRight, 
  CheckCircle2, Clock, Package, Filter, Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDate } from "@/lib/formatDate";
import { useState } from "react";
import type { Voyage } from "@shared/schema";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planned:    { label: "Planlandı",  color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  in_progress:{ label: "Devam Ediyor", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  completed:  { label: "Tamamlandı", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled:  { label: "İptal",      color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function AgentReports() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: voyages, isLoading } = useQuery<Voyage[]>({
    queryKey: ["/api/voyages"],
  });

  const filtered = (voyages || []).filter(v => {
    const matchSearch = !search || 
      (v.vesselName || "").toLowerCase().includes(search.toLowerCase()) ||
      (v.purposeOfCall || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: (voyages || []).length,
    completed: (voyages || []).filter(v => v.status === "completed").length,
    inProgress: (voyages || []).filter(v => v.status === "in_progress").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-sky-500/10">
          <FileBarChart2 className="h-6 w-6 text-sky-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Acente Raporları</h1>
          <p className="text-slate-400 text-sm">Sefer bazlı acente raporu görüntüle ve dışa aktar</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-slate-400">Toplam Sefer</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-emerald-400">{stats.completed}</div>
            <div className="text-sm text-slate-400">Tamamlanan</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-amber-400">{stats.inProgress}</div>
            <div className="text-sm text-slate-400">Devam Eden</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                data-testid="input-search-reports"
                placeholder="Gemi adı veya sefer ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-slate-900/50 border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-2">
              {["all", "in_progress", "completed", "planned"].map(s => (
                <Button
                  key={s}
                  data-testid={`filter-status-${s}`}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className={statusFilter !== s ? "border-slate-600 text-slate-300" : ""}
                >
                  {s === "all" ? "Tümü" : STATUS_LABELS[s]?.label || s}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full bg-slate-700" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileBarChart2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Rapor bulunamadı</p>
              <p className="text-sm">Önce sefer ekleyin veya filtreyi değiştirin</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(voyage => {
                const statusInfo = STATUS_LABELS[voyage.status] || { label: voyage.status, color: "" };
                return (
                  <div
                    key={voyage.id}
                    data-testid={`row-report-${voyage.id}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-900/50 border border-slate-700/50 hover:border-sky-500/30 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-sky-500/10 mt-0.5">
                        <Ship className="h-4 w-4 text-sky-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {voyage.vesselName || `Sefer #${voyage.id}`}
                          </span>
                          <Badge className={`text-xs border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {voyage.purposeOfCall || "—"}
                          </span>
                          {voyage.eta && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {fmtDate(voyage.eta)}
                            </span>
                          )}
                          {voyage.cargoType && (
                            <span className="text-slate-500">{voyage.cargoType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`/agent-report/${voyage.id}`}>
                      <Button
                        data-testid={`btn-view-report-${voyage.id}`}
                        size="sm"
                        className="bg-sky-600 hover:bg-sky-500 text-white gap-1"
                      >
                        Raporu Gör
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
