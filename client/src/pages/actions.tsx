import { useQuery } from "@tanstack/react-query";
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  ChevronRight, 
  ExternalLink, 
  Zap,
  Calendar,
  DollarSign,
  Ship,
  FileText,
  Wrench,
  CheckCircle2
} from "lucide-react";
import { Link } from "wouter";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { fmtDate } from "@/lib/formatDate";

export default function ActionCenter() {
  const { t } = useLanguage();
  
  const { data: actions, isLoading } = useQuery({
    queryKey: ["/api/actions/pending"],
    refetchInterval: 120000, // 2 minutes polling
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasActions = actions?.counts?.total > 0;

  if (!hasActions) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold">All caught up!</h2>
        <p className="text-muted-foreground max-w-xs">
          You have no pending critical or warning actions at this moment.
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Action Center</h1>
            <p className="text-muted-foreground">Manage your pending tasks and critical updates</p>
          </div>
        </div>
        {actions.counts.critical > 0 && (
          <Badge variant="destructive" className="px-3 py-1 text-sm animate-pulse">
            {actions.counts.critical} Critical Actions
          </Badge>
        )}
      </div>

      <Accordion type="multiple" defaultValue={["critical", "warning", "info"]} className="space-y-4">
        {/* Critical Section */}
        {(actions.overdueInvoices.length > 0 || actions.expiringCertificates.length > 0) && (
          <AccordionItem value="critical" className="border rounded-lg bg-card overflow-hidden">
            <AccordionTrigger className="px-4 hover:no-underline bg-destructive/5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold uppercase tracking-wider text-xs">Critical Priority</span>
                <Badge variant="destructive" className="ml-2">
                  {actions.overdueInvoices.length + actions.expiringCertificates.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-0 divide-y">
              {actions.overdueInvoices.map((inv: any) => (
                <div key={`inv-${inv.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-destructive/10 rounded text-destructive mt-1">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Overdue Invoice: {inv.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Due {fmtDate(inv.dueDate)} • {inv.amount} {inv.currency}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href="/invoices">
                      View <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
              {actions.expiringCertificates.map((cert: any) => (
                <div key={`cert-${cert.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-destructive/10 rounded text-destructive mt-1">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Expiring Certificate: {cert.certType}</h4>
                      <p className="text-xs text-muted-foreground">
                        Vessel: {cert.vesselName} • {cert.daysLeft < 0 ? 'Expired' : `Expires in ${cert.daysLeft} days`}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/vessel-certificates?vesselId=${cert.vesselId}`}>
                      Update <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Warning Section */}
        {(actions.pendingDaAdvances.length > 0 || actions.voyagesNeedingFda.length > 0 || actions.unlinkedPortExpenses.length > 0) && (
          <AccordionItem value="warning" className="border rounded-lg bg-card overflow-hidden">
            <AccordionTrigger className="px-4 hover:no-underline bg-amber-500/5">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-bold uppercase tracking-wider text-xs">Warnings & Pending</span>
                <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">
                  {actions.pendingDaAdvances.length + actions.voyagesNeedingFda.length + actions.unlinkedPortExpenses.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-0 divide-y">
              {actions.pendingDaAdvances.map((da: any) => (
                <div key={`da-${da.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded text-amber-600 mt-1">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">DA Advance Requested: {da.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        Principal: {da.principal} • Amount: {da.requestedAmount} {da.currency}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href="/da-advances">
                      Process <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
              {actions.voyagesNeedingFda.map((voy: any) => (
                <div key={`voy-${voy.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded text-amber-600 mt-1">
                      <Ship className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Voyage Needs FDA Account: {voy.vesselName}</h4>
                      <p className="text-xs text-muted-foreground">
                        Port: {voy.portName} • Completed: {fmtDate(voy.eta)}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/voyages/${voy.id}`}>
                      Create FDA <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
              {actions.unlinkedPortExpenses.map((exp: any) => (
                <div key={`exp-${exp.voyageId}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded text-amber-600 mt-1">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Unlinked Port Expenses: {exp.count} items</h4>
                      <p className="text-xs text-muted-foreground">
                        Voyage ID: {exp.voyageId} • Total: {exp.total} USD
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href="/port-expenses">
                      Reconcile <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Info Section */}
        {(actions.pendingProformaApprovals.length > 0 || actions.openServiceRequests.length > 0) && (
          <AccordionItem value="info" className="border rounded-lg bg-card overflow-hidden">
            <AccordionTrigger className="px-4 hover:no-underline bg-blue-500/5">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Info className="w-5 h-5" />
                <span className="font-bold uppercase tracking-wider text-xs">Information & Approvals</span>
                <Badge variant="outline" className="ml-2 border-blue-500 text-blue-600">
                  {actions.pendingProformaApprovals.length + actions.openServiceRequests.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-0 divide-y">
              {actions.pendingProformaApprovals.map((prof: any) => (
                <div key={`prof-${prof.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/10 rounded text-blue-600 mt-1">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Proforma Awaiting Approval: {prof.referenceNumber}</h4>
                      <p className="text-xs text-muted-foreground">
                        Total: {prof.totalUsd} USD • Requested: {fmtDate(prof.sentAt || prof.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/proformas/${prof.id}`}>
                        Review <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
              {actions.openServiceRequests.map((req: any) => (
                <div key={`req-${req.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/10 rounded text-blue-600 mt-1">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">Open Service Request: {req.serviceType}</h4>
                      <p className="text-xs text-muted-foreground">
                        Vessel: {req.vesselName} • {req.offersCount} offers received
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/service-requests/${req.id}`}>
                      View Offers <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}
