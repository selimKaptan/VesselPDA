import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Send, Paperclip, X, Mail, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

export type MailType = "pda" | "fda" | "invoice" | "nor" | "sof";

export interface SmartMailComposerProps {
  type: MailType;
  entityId: number;
  entityMeta?: {
    vesselName?: string;
    portName?: string;
    referenceNumber?: string;
    toEmail?: string;
    toCompany?: string;
  };
  onClose: () => void;
}

const TYPE_LABELS: Record<MailType, string> = {
  pda: "PDA",
  fda: "FDA",
  invoice: "Invoice",
  nor: "NOR",
  sof: "SOF",
};

const ENDPOINT_MAP: Record<MailType, string> = {
  pda: "/api/proformas",
  fda: "/api/fdas",
  invoice: "/api/invoices",
  nor: "/api/proformas",
  sof: "/api/proformas",
};

function buildSubject(type: MailType, meta: SmartMailComposerProps["entityMeta"]): string {
  const label = TYPE_LABELS[type];
  const parts = [label];
  if (meta?.vesselName) parts.push(meta.vesselName);
  if (meta?.portName) parts.push(meta.portName);
  if (meta?.referenceNumber) parts.push(meta.referenceNumber);
  return parts.join(" — ");
}

function buildBody(type: MailType, meta: SmartMailComposerProps["entityMeta"]): string {
  const label = TYPE_LABELS[type];
  const vessel = meta?.vesselName ?? "[Vessel Name]";
  const port = meta?.portName ?? "[Port Name]";
  const ref = meta?.referenceNumber ?? "[Ref#]";
  const company = meta?.toCompany ?? "valued client";

  const bodies: Record<MailType, string> = {
    pda: `Dear ${company},\n\nPlease find attached the Proforma Disbursement Account (PDA) for ${vessel} at ${port} (Ref: ${ref}).\n\nThis document outlines the estimated port disbursements for the upcoming port call. Kindly review and revert with your approval or any queries at your earliest convenience.\n\nShould you require any amendments or additional information, please do not hesitate to contact us.\n\nBest regards,`,
    fda: `Dear ${company},\n\nPlease find attached the Final Disbursement Account (FDA) for ${vessel} at ${port} (Ref: ${ref}).\n\nThis document reflects the actual port expenses incurred during the vessel's port call. Kindly review and confirm receipt.\n\nWe look forward to your prompt settlement of the outstanding balance.\n\nBest regards,`,
    invoice: `Dear ${company},\n\nPlease find attached the invoice (Ref: ${ref}) for services rendered for ${vessel} at ${port}.\n\nKindly arrange payment as per the terms outlined in the attached document.\n\nBest regards,`,
    nor: `Dear ${company},\n\nPlease find attached the Notice of Readiness (NOR) for ${vessel} at ${port} (Ref: ${ref}).\n\nThe vessel is ready in all respects to commence cargo operations as per the charter party terms.\n\nBest regards,`,
    sof: `Dear ${company},\n\nPlease find attached the Statement of Facts (SOF) for ${vessel} at ${port} (Ref: ${ref}).\n\nThis document provides a detailed account of events during the vessel's port call.\n\nBest regards,`,
  };

  return bodies[type];
}

export function SmartMailComposer({ type, entityId, entityMeta, onClose }: SmartMailComposerProps) {
  const { toast } = useToast();

  const [toEmail, setToEmail] = useState(entityMeta?.toEmail ?? "");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(buildSubject(type, entityMeta));
  const [body, setBody] = useState(buildBody(type, entityMeta));

  const pdfLabel = `${TYPE_LABELS[type]}-${entityMeta?.referenceNumber ?? entityId}.pdf`;
  const pdfUrl = `${ENDPOINT_MAP[type]}/${entityId}/pdf`;

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!toEmail.trim()) throw new Error("Recipient email is required");
      const payload: Record<string, string> = {
        toEmail: toEmail.trim(),
        subject: subject.trim(),
        message: body.trim(),
      };
      if (cc.trim()) payload.cc = cc.trim();
      const res = await apiRequest("POST", `${ENDPOINT_MAP[type]}/${entityId}/send-email`, payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to send email" }));
        throw new Error(err.message ?? "Failed to send email");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Email sent", description: `${TYPE_LABELS[type]} sent to ${toEmail}` });
      onClose();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Send failed", description: err.message });
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Email {TYPE_LABELS[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="smc-to">To <span className="text-destructive">*</span></Label>
            <Input
              id="smc-to"
              type="email"
              placeholder="recipient@company.com"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              data-testid="input-smc-to"
            />
          </div>

          {showCc ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="smc-cc">CC <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { setCc(""); setShowCc(false); }}>
                  Remove CC
                </button>
              </div>
              <Input
                id="smc-cc"
                type="email"
                placeholder="cc@company.com"
                value={cc}
                onChange={e => setCc(e.target.value)}
                data-testid="input-smc-cc"
              />
            </div>
          ) : (
            <button
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              onClick={() => setShowCc(true)}
            >
              <ChevronDown className="w-3 h-3" /> Add CC
            </button>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="smc-subject">Subject</Label>
            <Input
              id="smc-subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              data-testid="input-smc-subject"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smc-body">Message</Label>
            <Textarea
              id="smc-body"
              rows={10}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="font-mono text-sm resize-none"
              data-testid="textarea-smc-body"
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex items-center gap-2 p-2.5 rounded-md border bg-muted/30 text-sm">
              <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 text-muted-foreground truncate">{pdfLabel}</span>
              <Badge variant="secondary" className="text-[10px]">PDF</Badge>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
                data-testid="link-smc-preview-pdf"
              >
                Preview
              </a>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-smc-cancel">
              <X className="w-4 h-4 mr-1.5" /> Cancel
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !toEmail.trim()}
              data-testid="button-smc-send"
            >
              {sendMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4 mr-1.5" /> Send Email</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
