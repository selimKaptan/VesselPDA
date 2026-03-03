import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail, MailOpen, Trash2, CheckCircle, AlertCircle, Clock, ExternalLink,
  Plus, Copy, RefreshCw, Bot, Anchor, FileText, X, Ship, Link2, ChevronRight,
  Inbox, MailCheck, MailX
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

const CLASSIFICATION_CONFIG: Record<string, { label: string; color: string; icon: typeof Ship }> = {
  nomination: { label: "Nomination", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Ship },
  sof_update: { label: "SOF Update", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: FileText },
  da_proforma: { label: "DA / Proforma", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: FileText },
  fixture_recap: { label: "Fixture Recap", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: FileText },
  crew_change: { label: "Crew Change", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: Ship },
  bunker_inquiry: { label: "Bunker Inquiry", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", icon: Anchor },
  port_clearance: { label: "Port Clearance", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", icon: Anchor },
  general: { label: "General", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", icon: Mail },
};

const RULE_TYPE_LABELS: Record<string, string> = {
  general: "General",
  voyage_update: "Voyage Update",
  sof_update: "SOF Update",
  nomination: "Nomination",
};

function EmailCard({ email, isSelected, onClick }: { email: any; isSelected: boolean; onClick: () => void }) {
  const cls = CLASSIFICATION_CONFIG[email.ai_classification] || CLASSIFICATION_CONFIG.general;
  const Icon = cls.icon;
  return (
    <div
      className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-muted" : ""}`}
      onClick={onClick}
      data-testid={`email-card-${email.id}`}
    >
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${email.is_processed ? "bg-muted" : "bg-blue-100 dark:bg-blue-900/30"}`}>
          {email.is_processed ? <MailCheck className="w-4 h-4 text-muted-foreground" /> : <Mail className="w-4 h-4 text-blue-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-sm font-medium truncate ${!email.is_processed ? "font-semibold" : "text-muted-foreground"}`}>
              {email.from_name || email.from_email}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{email.subject || "(no subject)"}</p>
          <div className="flex items-center gap-1 mt-1">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${cls.color}`}>
              <Icon className="w-3 h-3 mr-0.5" />
              {cls.label}
            </Badge>
            {email.voyage_name && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <Anchor className="w-3 h-3 mr-0.5" />{email.voyage_name}
              </Badge>
            )}
            {email.is_processed && email.processed_action && email.processed_action !== "dismissed" && (
              <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-0">
                <CheckCircle className="w-3 h-3 mr-0.5" />{email.processed_action.replace(/_/g, " ")}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ fromEmail: "", fromName: "", subject: "", bodyText: "" });
  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/email/inbound/manual", data),
    onSuccess: () => {
      toast({ title: "Email added", description: "AI classification in progress" });
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbox/count"] });
      onClose();
      setForm({ fromEmail: "", fromName: "", subject: "", bodyText: "" });
    },
    onError: () => toast({ title: "Failed to add email", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" data-testid="dialog-manual-email">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Test Email
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From Email *</Label>
              <Input className="h-8 text-sm" placeholder="sender@example.com" value={form.fromEmail}
                onChange={e => setForm(f => ({ ...f, fromEmail: e.target.value }))} data-testid="input-from-email" />
            </div>
            <div>
              <Label className="text-xs">From Name</Label>
              <Input className="h-8 text-sm" placeholder="John Smith" value={form.fromName}
                onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} data-testid="input-from-name" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Input className="h-8 text-sm" placeholder="MV Example - Nomination for Izmir" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} data-testid="input-email-subject" />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea className="text-sm min-h-[120px]" placeholder="Email content..." value={form.bodyText}
              onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))} data-testid="input-email-body" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => mutation.mutate(form)} disabled={!form.fromEmail || mutation.isPending}
              data-testid="button-submit-manual-email">
              {mutation.isPending ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Add & Classify
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailDetail({ email, onDismiss, onProcess }: { email: any; onDismiss: () => void; onProcess: (action: string) => void }) {
  const cls = CLASSIFICATION_CONFIG[email.ai_classification] || CLASSIFICATION_CONFIG.general;
  const extracted = email.ai_extracted_data || {};
  const hasExtracted = Object.values(extracted).some(v => v && (typeof v === "string" ? v.trim() : true));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm">{email.subject || "(no subject)"}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              From <span className="font-medium">{email.from_name || email.from_email}</span>
              {email.from_name && <span className="text-muted-foreground"> &lt;{email.from_email}&gt;</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(email.received_at), "PPpp")}
            </p>
          </div>
          <Badge className={`flex-shrink-0 text-xs ${cls.color}`}>
            {cls.label}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* AI suggestion */}
          {email.ai_suggestion && !email.is_processed && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
              <div className="flex items-start gap-2">
                <Bot className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">AI Suggestion</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">{email.ai_suggestion}</p>
                  {email.ai_classification !== "general" && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {email.ai_classification === "nomination" && (
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onProcess("created_voyage")} data-testid="button-create-voyage">
                          <Ship className="w-3 h-3" /> Create Voyage
                        </Button>
                      )}
                      {email.ai_classification === "sof_update" && (
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onProcess("updated_sof")} data-testid="button-update-sof">
                          <FileText className="w-3 h-3" /> Update SOF
                        </Button>
                      )}
                      {email.ai_classification === "da_proforma" && (
                        <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onProcess("created_proforma")} data-testid="button-create-proforma">
                          <FileText className="w-3 h-3" /> Create Proforma
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onDismiss} data-testid="button-dismiss-email">
                        <MailX className="w-3 h-3" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Processed status */}
          {email.is_processed && email.processed_action && (
            <div className={`rounded-lg border p-3 flex items-center gap-2 ${email.processed_action === "dismissed"
              ? "border-muted bg-muted/30" : "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30"}`}>
              {email.processed_action === "dismissed"
                ? <MailX className="w-4 h-4 text-muted-foreground" />
                : <CheckCircle className="w-4 h-4 text-emerald-600" />}
              <span className="text-xs font-medium">
                {email.processed_action === "dismissed" ? "Dismissed" : `Processed: ${email.processed_action.replace(/_/g, " ")}`}
              </span>
              {email.processed_entity_id && (
                <Link href={`/voyages/${email.processed_entity_id}`}>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs gap-1">
                    <ExternalLink className="w-3 h-3" /> View
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Extracted data */}
          {hasExtracted && (
            <div className="rounded-lg border p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Bot className="w-3.5 h-3.5" /> Extracted Information
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {extracted.vesselName && <div><span className="text-xs text-muted-foreground">Vessel: </span><span className="text-xs font-medium">{extracted.vesselName}</span></div>}
                {extracted.imoNumber && <div><span className="text-xs text-muted-foreground">IMO: </span><span className="text-xs font-medium">{extracted.imoNumber}</span></div>}
                {extracted.portName && <div><span className="text-xs text-muted-foreground">Port: </span><span className="text-xs font-medium">{extracted.portName}</span></div>}
                {extracted.eta && <div><span className="text-xs text-muted-foreground">ETA: </span><span className="text-xs font-medium">{extracted.eta}</span></div>}
                {extracted.etd && <div><span className="text-xs text-muted-foreground">ETD: </span><span className="text-xs font-medium">{extracted.etd}</span></div>}
                {extracted.cargoType && <div><span className="text-xs text-muted-foreground">Cargo: </span><span className="text-xs font-medium">{extracted.cargoType}</span></div>}
                {extracted.cargoQuantity && <div><span className="text-xs text-muted-foreground">Qty: </span><span className="text-xs font-medium">{extracted.cargoQuantity}</span></div>}
                {extracted.charterer && <div><span className="text-xs text-muted-foreground">Charterer: </span><span className="text-xs font-medium">{extracted.charterer}</span></div>}
                {extracted.shipowner && <div><span className="text-xs text-muted-foreground">Owner: </span><span className="text-xs font-medium">{extracted.shipowner}</span></div>}
              </div>
              {Array.isArray(extracted.events) && extracted.events.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Events:</p>
                  {extracted.events.map((ev: any, i: number) => (
                    <div key={i} className="text-xs flex gap-2">
                      <span className="text-muted-foreground">{ev.eventTime}</span>
                      <span>{ev.eventName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Voyage link */}
          {email.voyage_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link2 className="w-3.5 h-3.5" />
              Linked to voyage: <Link href={`/voyages/${email.linked_voyage_id}`}
                className="text-blue-600 hover:underline font-medium">{email.voyage_name}</Link>
            </div>
          )}

          <Separator />

          {/* Email body */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Message</p>
            {email.body_text ? (
              <pre className="text-xs whitespace-pre-wrap font-sans bg-muted/30 rounded p-3 max-h-80 overflow-y-auto">
                {email.body_text}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">No text content</p>
            )}
          </div>

          {/* Attachments */}
          {Array.isArray(email.attachments) && email.attachments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Attachments</p>
              {email.attachments.map((att: any, i: number) => (
                <a key={i} href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline">
                  <FileText className="w-3.5 h-3.5" />
                  {att.fileName} {att.fileSize && <span className="text-muted-foreground">({att.fileSize})</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function EmailInbox() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"unread" | "processed">("unread");
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [newRuleType, setNewRuleType] = useState("general");

  const { data: rawEmails, isLoading } = useQuery<any>({
    queryKey: ["/api/email/inbox", tab],
    queryFn: async () => {
      const res = await fetch(`/api/email/inbox?processed=${tab === "processed"}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30000,
  });
  const emails: any[] = Array.isArray(rawEmails) ? rawEmails : [];

  const { data: rawRules } = useQuery<any>({
    queryKey: ["/api/email/forwarding-rules"],
    enabled: showRulesPanel,
  });
  const rules: any[] = Array.isArray(rawRules) ? rawRules : [];

  const dismissMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/email/inbox/${id}/dismiss`),
    onSuccess: () => {
      toast({ title: "Email dismissed" });
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbox/count"] });
      setSelectedEmail(null);
    },
  });

  const processMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      apiRequest("POST", `/api/email/inbox/${id}/process`, { action }),
    onSuccess: (_, vars) => {
      toast({ title: "Email processed", description: `Action: ${vars.action.replace(/_/g, " ")}` });
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbox/count"] });
      setSelectedEmail(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/email/inbox/${id}`),
    onSuccess: () => {
      toast({ title: "Email deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/email/inbox"] });
      setSelectedEmail(null);
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/email/forwarding-rules", data),
    onSuccess: () => {
      toast({ title: "Forwarding address created" });
      queryClient.invalidateQueries({ queryKey: ["/api/email/forwarding-rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/email/forwarding-rules/${id}`),
    onSuccess: () => {
      toast({ title: "Rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/email/forwarding-rules"] });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const unreadCount = emails.filter(e => !e.is_processed).length;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-[hsl(var(--maritime-primary))]" />
          <h1 className="text-lg font-bold font-serif">Email Inbox</h1>
          {unreadCount > 0 && (
            <Badge className="bg-blue-600 text-white text-xs">{unreadCount} new</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRulesPanel(p => !p)}
            className="gap-1.5 text-xs" data-testid="button-toggle-rules">
            <Link2 className="w-3.5 h-3.5" /> Forwarding Addresses
          </Button>
          <Button size="sm" onClick={() => setShowManualDialog(true)}
            className="gap-1.5 text-xs" data-testid="button-add-email">
            <Plus className="w-3.5 h-3.5" /> Add Test Email
          </Button>
        </div>
      </div>

      {/* Forwarding Rules Panel */}
      {showRulesPanel && (
        <div className="flex-shrink-0 border-b bg-muted/20 px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold">Your Forwarding Addresses</p>
            <div className="flex items-center gap-2">
              <Select value={newRuleType} onValueChange={setNewRuleType}>
                <SelectTrigger className="h-7 text-xs w-36" data-testid="select-rule-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => createRuleMutation.mutate({ ruleType: newRuleType })}
                disabled={createRuleMutation.isPending} data-testid="button-create-rule">
                <Plus className="w-3.5 h-3.5" /> Generate Address
              </Button>
            </div>
          </div>
          {rules.length === 0 ? (
            <p className="text-xs text-muted-foreground">No forwarding addresses yet. Generate one to receive emails.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rules.map((rule: any) => (
                <div key={rule.id} className="flex items-center gap-2 bg-background border rounded-md px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium text-blue-600 truncate">{rule.forwarding_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Type: {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                      {rule.voyage_name && ` · Voyage: ${rule.voyage_name}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                    onClick={() => handleCopy(rule.forwarding_email)} data-testid={`button-copy-rule-${rule.id}`}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive"
                    onClick={() => deleteRuleMutation.mutate(rule.id)} data-testid={`button-delete-rule-${rule.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: email list */}
        <div className={`flex flex-col border-r ${selectedEmail ? "hidden md:flex md:w-80 lg:w-96" : "w-full"}`}>
          <Tabs value={tab} onValueChange={v => { setTab(v as any); setSelectedEmail(null); }} className="flex-shrink-0">
            <TabsList className="w-full rounded-none h-10 border-b bg-background">
              <TabsTrigger value="unread" className="flex-1 text-xs gap-1.5" data-testid="tab-unread">
                <Mail className="w-3.5 h-3.5" /> Inbox
                {emails.filter(e => !e.is_processed).length > 0 && tab !== "processed" && (
                  <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">
                    {emails.filter(e => !e.is_processed).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="processed" className="flex-1 text-xs gap-1.5" data-testid="tab-processed">
                <MailCheck className="w-3.5 h-3.5" /> Processed
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading...
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Inbox className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {tab === "unread" ? "No new emails" : "No processed emails"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {tab === "unread" ? "Generate a forwarding address and share it with your contacts." : "Processed emails will appear here."}
                </p>
              </div>
            ) : (
              emails.map((email: any) => (
                <EmailCard
                  key={email.id}
                  email={email}
                  isSelected={selectedEmail?.id === email.id}
                  onClick={() => setSelectedEmail(email)}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* Right: email detail */}
        {selectedEmail ? (
          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b bg-background">
              <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setSelectedEmail(null)}>
                <X className="w-4 h-4" />
              </Button>
              <div className="flex-1" />
              {!selectedEmail.is_processed && (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => dismissMutation.mutate(selectedEmail.id)}
                  data-testid="button-detail-dismiss">
                  <MailX className="w-3.5 h-3.5" /> Dismiss
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                onClick={() => deleteMutation.mutate(selectedEmail.id)} data-testid="button-detail-delete">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              <EmailDetail
                email={selectedEmail}
                onDismiss={() => dismissMutation.mutate(selectedEmail.id)}
                onProcess={(action) => processMutation.mutate({ id: selectedEmail.id, action })}
              />
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center text-center">
            <div>
              <MailOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Select an email to view</p>
            </div>
          </div>
        )}
      </div>

      <ManualEmailDialog open={showManualDialog} onClose={() => setShowManualDialog(false)} />
    </div>
  );
}
