import { useState } from "react";
import { ShieldCheck, ShieldAlert, Search, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageMeta } from "@/components/page-meta";

interface SanctionsResult {
  clear: boolean;
  query: string;
  matches: Array<{
    name: string;
    type?: string;
    programs?: string[];
    remarks?: string;
  }>;
}

export default function SanctionsCheck() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SanctionsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    const name = query.trim();
    if (!name) return;
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const res = await fetch(`/api/sanctions/check?name=${encodeURIComponent(name)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Sunucu hatası, lütfen tekrar deneyin.");
      const data: SanctionsResult = await res.json();
      setResult(data);
      setSearched(true);
    } catch (e: any) {
      setError(e.message || "Sorgu sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <>
      <PageMeta title="OFAC Yaptırım Sorgulama | VesselPDA" description="ABD Hazine Bakanlığı OFAC SDN listesinde şirket ve kişi sorgulama" />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-xl text-foreground">OFAC Yaptırım Listesi Sorgulama</h1>
              <p className="text-sm text-muted-foreground">ABD Hazine Bakanlığı SDN (Specially Designated Nationals) listesi</p>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/25 border border-blue-200/60 dark:border-blue-800/40">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Bu araç, şirket ve kişi isimlerini ABD Hazine Bakanlığı OFAC SDN yaptırım listesiyle karşılaştırır.
            Ticaret ortağı veya iş birliği yapacağınız tarafları sorgulamak için kullanabilirsiniz.
            Liste düzenli olarak güncellenmektedir.
          </p>
        </div>

        {/* Search box */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Sorgulanacak Ad</CardTitle>
            <CardDescription>Şirket adı veya kişi adı girin</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="örn. Barbaro Shipping Co."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                  data-testid="input-sanctions-query"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white"
                data-testid="button-sanctions-search"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Sorgulanıyor...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Sorgula
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading skeleton */}
        {loading && (
          <Card className="p-5 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Result — Clear */}
        {!loading && searched && result?.clear && (
          <Card className="border-emerald-200/80 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/20" data-testid="result-clear">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">Listede Kayıt Bulunamadı</p>
                  <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                    <span className="font-medium">"{result.query}"</span> için OFAC SDN listesinde herhangi bir eşleşme tespit edilmedi.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result — Matches found */}
        {!loading && searched && result && !result.clear && (
          <div className="space-y-3" data-testid="result-matches">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300">Yaptırım Listesinde Eşleşme Bulundu!</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
                  <span className="font-medium">"{result.query}"</span> sorgusu için {result.matches.length} kayıt bulundu.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {result.matches.map((match, i) => (
                <Card key={i} className="border-red-200/70 dark:border-red-800/40" data-testid={`match-card-${i}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <p className="font-semibold text-foreground">{match.name}</p>
                        {match.type && (
                          <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 flex-shrink-0">
                            {match.type}
                          </Badge>
                        )}
                      </div>
                      {match.programs && match.programs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {match.programs.map((prog, j) => (
                            <Badge key={j} className="text-[10px] bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">
                              {prog}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {match.remarks && (
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{match.remarks}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Pre-search placeholder */}
        {!loading && !searched && !error && (
          <div className="text-center py-10 text-muted-foreground">
            <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-15" />
            <p className="text-sm">Sorgulamak istediğiniz şirket veya kişi adını girin ve "Sorgula"ya tıklayın.</p>
          </div>
        )}
      </div>
    </>
  );
}
