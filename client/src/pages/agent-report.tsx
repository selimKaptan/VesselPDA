import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  ArrowLeft, Download, Printer, Ship, MapPin, Calendar, 
  Package, Anchor, Clock, DollarSign, Receipt, Info,
  CheckCircle2, AlertCircle, FileText, Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, fmtDateTime } from "@/lib/formatDate";
import { useState } from "react";

export default function AgentReport() {
  const { voyageId } = useParams<{ voyageId: string }>();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const { data: reportData, isLoading, error } = useQuery<any>({
    queryKey: [`/api/agent-report/${voyageId}`],
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      
      const element = document.getElementById("report-content");
      if (!element) return;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Agent_Report_${reportData?.vessel?.name || "Voyage"}_${voyageId}.pdf`);
      
      toast({
        title: "Success",
        description: "Report exported to PDF successfully.",
      });
    } catch (err) {
      console.error("PDF export error:", err);
      toast({
        title: "Error",
        description: "Failed to export PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="p-8 text-center max-w-5xl mx-auto">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Error Loading Report</h1>
        <p className="text-muted-foreground mb-6">We couldn't load the agent report data for this voyage.</p>
        <Link href={`/voyages/${voyageId}`}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Voyage
          </Button>
        </Link>
      </div>
    );
  }

  const { voyage, vessel, port, agent, portCall, proformas, fdas, sof, nor, invoices, expenses, husbandry } = reportData;

  const totalDues = expenses
    ?.filter((e: any) => ["port_dues", "pilotage", "towage", "mooring", "anchorage"].includes(e.category))
    .reduce((sum: number, e: any) => sum + (e.amountUsd || 0), 0) || 0;

  const totalServices = expenses
    ?.filter((e: any) => ["agency_fee", "launch_hire", "garbage", "fresh_water", "survey", "customs"].includes(e.category))
    .reduce((sum: number, e: any) => sum + (e.amountUsd || 0), 0) || 0;

  const totalOther = expenses
    ?.filter((e: any) => !["port_dues", "pilotage", "towage", "mooring", "anchorage", "agency_fee", "launch_hire", "garbage", "fresh_water", "survey", "customs"].includes(e.category))
    .reduce((sum: number, e: any) => sum + (e.amountUsd || 0), 0) || 0;

  const totalActual = (totalDues + totalServices + totalOther);
  const totalAdvances = invoices
    ?.filter((i: any) => i.invoiceType === "advance" && i.status === "paid")
    .reduce((sum: number, i: any) => sum + (i.amount || 0), 0) || 0;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div className="flex items-center gap-4">
          <Link href={`/voyages/${voyageId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold font-serif">Port Agent's Report</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? <Clock className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Export PDF
          </Button>
          <Button size="sm" className="bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)]">
            <Mail className="w-4 h-4 mr-2" /> Send to Principal
          </Button>
        </div>
      </div>

      <div id="report-content" className="bg-white dark:bg-slate-950 p-8 shadow-sm border rounded-lg space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b pb-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-serif font-bold text-[hsl(var(--maritime-primary))]">PORT AGENT'S REPORT</h2>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-semibold text-foreground">{agent?.companyName || "Ship Agent Services"}</span>
              <span>•</span>
              <span>{fmtDate(new Date())}</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-sm font-medium">Ref: {voyage?.referenceNumber || `#${voyageId}`}</p>
            <p className="text-sm text-muted-foreground">Status: {voyage?.status?.toUpperCase()}</p>
          </div>
        </div>

        {/* Vessel & Voyage Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Ship className="w-3 h-3" /> Vessel Information
            </h3>
            <div className="space-y-1">
              <p className="font-bold text-lg">{vessel?.name}</p>
              <p className="text-sm">IMO: {vessel?.imoNumber || "N/A"}</p>
              <p className="text-sm">Flag: {vessel?.flag || "N/A"}</p>
              <p className="text-sm">GRT/NRT: {vessel?.grt?.toLocaleString() || "0"} / {vessel?.nrt?.toLocaleString() || "0"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-3 h-3" /> Port Information
            </h3>
            <div className="space-y-1">
              <p className="font-bold text-lg">{port?.name}</p>
              <p className="text-sm">Country: {port?.country || "N/A"}</p>
              <p className="text-sm">Berth: {portCall?.berth || "N/A"}</p>
              <p className="text-sm">Purpose: {voyage?.purposeOfCall || "N/A"}</p>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Package className="w-3 h-3" /> Cargo Operations
            </h3>
            <div className="space-y-1">
              <p className="font-bold text-lg">{voyage?.cargoType || "No Cargo Listed"}</p>
              <p className="text-sm">Quantity: {voyage?.cargoQuantity ? `${voyage.cargoQuantity.toLocaleString()} MT` : "N/A"}</p>
              <p className="text-sm text-muted-foreground">Operations: {sof?.length || 0} Events Recorded</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Vessel Movement / Timeline */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Anchor className="w-4 h-4" /> Vessel Movement Log
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            <div className="space-y-3">
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">ETA Port:</span>
                <span className="text-sm font-medium">{fmtDateTime(voyage?.eta)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">Actual Arrival:</span>
                <span className="text-sm font-medium">{fmtDateTime(portCall?.actualArrival)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">NOR Tendered:</span>
                <span className="text-sm font-medium">{fmtDateTime(portCall?.norTendered)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">All Fast / Berthing:</span>
                <span className="text-sm font-medium">{fmtDateTime(portCall?.berthingTime)}</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">Operations Started:</span>
                <span className="text-sm font-medium">{fmtDateTime(portCall?.operationsStart)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">Operations Completed:</span>
                <span className="text-sm font-medium">{fmtDateTime(portCall?.operationsEnd)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">Departure:</span>
                <span className="text-sm font-medium">{fmtDateTime(portCall?.departure)}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-sm text-muted-foreground">Time in Port:</span>
                <span className="text-sm font-bold text-[hsl(var(--maritime-primary))]">
                  {portCall?.actualArrival && portCall?.departure 
                    ? `${Math.floor((new Date(portCall.departure).getTime() - new Date(portCall.actualArrival).getTime()) / (1000 * 60 * 60 * 24))} Days ${Math.floor(((new Date(portCall.departure).getTime() - new Date(portCall.actualArrival).getTime()) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))} Hours`
                    : "Calculating..."}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Port Disbursement Summary (USD)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Port Dues & Navigation</p>
                <p className="text-xl font-bold">${totalDues.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Agency & Port Services</p>
                <p className="text-xl font-bold">${totalServices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-primary/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Actual Disbursement</p>
                <p className="text-xl font-bold text-primary">${totalActual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Net Balance (DA Advance)</p>
                <p className={`text-xl font-bold ${totalActual - totalAdvances > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  ${(totalAdvances - totalActual).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Services & Husbandry */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Port Services Arranged
            </h3>
            <div className="grid grid-cols-2 gap-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={portCall?.pilotArranged ? "default" : "outline"} className="w-5 h-5 p-0 flex items-center justify-center rounded-full">
                  {portCall?.pilotArranged ? "✓" : ""}
                </Badge>
                <span className="text-sm">Pilotage</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={portCall?.tugArranged ? "default" : "outline"} className="w-5 h-5 p-0 flex items-center justify-center rounded-full">
                  {portCall?.tugArranged ? "✓" : ""}
                </Badge>
                <span className="text-sm">Tugboats</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={portCall?.customsCleared ? "default" : "outline"} className="w-5 h-5 p-0 flex items-center justify-center rounded-full">
                  {portCall?.customsCleared ? "✓" : ""}
                </Badge>
                <span className="text-sm">Customs Clearance</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={portCall?.pdaIssued ? "default" : "outline"} className="w-5 h-5 p-0 flex items-center justify-center rounded-full">
                  {portCall?.pdaIssued ? "✓" : ""}
                </Badge>
                <span className="text-sm">PDA Issued</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4" /> Husbandry Services
            </h3>
            {husbandry?.length > 0 ? (
              <div className="space-y-2">
                {husbandry.map((h: any) => (
                  <div key={h.id} className="flex justify-between items-center text-sm border-b border-dashed pb-1">
                    <span>{h.serviceType?.replace("_", " ")}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{h.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No husbandry services requested.</p>
            )}
          </div>
        </div>

        {/* Remarks */}
        {voyage?.notes && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Info className="w-4 h-4" /> Remarks & General Observations
            </h3>
            <div className="p-4 bg-muted/20 rounded border border-dashed text-sm">
              {voyage.notes}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-12 flex justify-between items-end border-t border-dashed">
          <div className="space-y-4">
            <div className="w-48 border-b-2 border-black h-12"></div>
            <p className="text-xs font-bold uppercase">Port Agent Signature</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Generated by</p>
            <p className="text-sm font-bold text-[hsl(var(--maritime-primary))]">BARBAROS SHIPPING PLATFORM</p>
            <p className="text-[10px] text-muted-foreground">{new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
