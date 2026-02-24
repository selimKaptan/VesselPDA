import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer, Ship, Globe, FileText, Calendar, Package } from "lucide-react";
import vesselPdaLogo from "@assets/image_1771971772715.png";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Link, useParams } from "wouter";
import type { Proforma, Vessel, Port } from "@shared/schema";

export default function ProformaView() {
  const params = useParams<{ id: string }>();
  const { data: proforma, isLoading } = useQuery<Proforma & { vessel?: Vessel; port?: Port }>({
    queryKey: ["/api/proformas", params.id],
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!proforma) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <FileText className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
        <h2 className="font-serif text-xl font-bold">Proforma Not Found</h2>
        <Link href="/proformas">
          <Button variant="outline" className="mt-4">Back to Proformas</Button>
        </Link>
      </div>
    );
  }

  const exchangeRate = proforma.exchangeRate || 1.1593;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/proformas">
            <Button variant="ghost" size="icon" data-testid="button-back-view">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-proforma-ref">
              {proforma.referenceNumber}
            </h1>
            <Badge variant="secondary" className="capitalize">{proforma.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => window.print()} data-testid="button-print">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            data-testid="button-download"
            onClick={() => {
              const doc = document.getElementById("proforma-document");
              if (!doc) return;
              const printWindow = window.open("", "_blank");
              if (!printWindow) return;
              const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(el => el.outerHTML).join("\n");
              printWindow.document.write(`<!DOCTYPE html><html><head><title>${proforma.referenceNumber || "Proforma"}</title>${styles}<style>
                body { padding: 32px; font-family: system-ui, -apple-system, sans-serif; }
                @media print { body { padding: 0; } }
                .print-hide { display: none !important; }
              </style></head><body>${doc.outerHTML}</body></html>`);
              printWindow.document.close();
              setTimeout(() => {
                printWindow.print();
                setTimeout(() => printWindow.close(), 1000);
              }, 500);
            }}
          >
            <Download className="w-4 h-4" /> Download PDF
          </Button>
        </div>
      </div>

      <Card className="p-8 space-y-8 print:shadow-none print:border-none" id="proforma-document" data-testid="card-proforma-document">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <img src={vesselPdaLogo} alt="VesselPDA" className="w-10 h-10 rounded-md object-contain" />
              <div>
                <h2 className="font-serif font-bold text-lg">PROFORMA D/A - INVOICE</h2>
                <p className="text-xs text-muted-foreground">VesselPDA Professional</p>
              </div>
            </div>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{proforma.createdAt ? new Date(proforma.createdAt).toLocaleDateString("en-GB") : ""}</p>
            <p className="text-muted-foreground">{proforma.referenceNumber}</p>
          </div>
        </div>

        <Separator />

        {proforma.toCompany && (
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">To</p>
              <p className="font-medium">{proforma.toCompany}</p>
              {proforma.toCountry && <p className="text-muted-foreground">{proforma.toCountry}</p>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md bg-muted/50">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Ship className="w-3 h-3" /> Vessel</p>
            <p className="font-medium text-sm" data-testid="text-vessel-info">{proforma.vessel?.name || `Vessel #${proforma.vesselId}`}</p>
            <p className="text-xs text-muted-foreground">
              Flag: {proforma.vessel?.flag || "-"} | NRT/GRT: {proforma.vessel?.nrt?.toLocaleString()}/{proforma.vessel?.grt?.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Globe className="w-3 h-3" /> Port</p>
            <p className="font-medium text-sm">{proforma.port?.name || `Port #${proforma.portId}`}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" /> Cargo</p>
            <p className="font-medium text-sm">{proforma.purposeOfCall}: {proforma.cargoType || "-"}</p>
            <p className="text-xs text-muted-foreground">
              {proforma.cargoQuantity ? `${proforma.cargoQuantity.toLocaleString()} ${proforma.cargoUnit}` : "-"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Stay</p>
            <p className="font-medium text-sm">{proforma.berthStayDays} Day(s)</p>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-sm text-muted-foreground text-right mb-2">
            $1 = €{(1 / exchangeRate).toFixed(4)}
          </div>
          <div className="border rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium text-xs uppercase tracking-wider">Description</th>
                  <th className="text-right p-3 font-medium text-xs uppercase tracking-wider">USD</th>
                  <th className="text-right p-3 font-medium text-xs uppercase tracking-wider">EUR</th>
                </tr>
              </thead>
              <tbody>
                {(proforma.lineItems as any[])?.map((item: any, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-3">
                      {item.description}
                      {item.notes && <span className="text-xs text-muted-foreground ml-2">({item.notes})</span>}
                    </td>
                    <td className="p-3 text-right font-mono">{item.amountUsd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right font-mono">{(item.amountEur || (item.amountUsd / exchangeRate))?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[hsl(var(--maritime-primary)/0.05)] font-bold">
                  <td className="p-3">Total Port Expenses</td>
                  <td className="p-3 text-right font-mono">${proforma.totalUsd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right font-mono">€{(proforma.totalEur || proforma.totalUsd / exchangeRate)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {proforma.notes && (
          <div className="text-sm space-y-1">
            <p className="font-medium">Notes:</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{proforma.notes}</p>
          </div>
        )}

        {proforma.bankDetails && (
          <>
            <Separator />
            <div className="text-sm space-y-2">
              <p className="font-medium">Bank Details</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground text-xs">
                <p>Bank: {(proforma.bankDetails as any).bankName}</p>
                <p>Branch: {(proforma.bankDetails as any).branch}</p>
                <p>SWIFT: {(proforma.bankDetails as any).swiftCode}</p>
                <p>USD IBAN: {(proforma.bankDetails as any).usdIban}</p>
                <p>EUR IBAN: {(proforma.bankDetails as any).eurIban}</p>
                <p>Beneficiary: {(proforma.bankDetails as any).beneficiary}</p>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
