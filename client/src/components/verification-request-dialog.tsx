import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

export function VerificationRequestDialog({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [taxNumber, setTaxNumber] = useState("");
  const [mtoRegNum, setMtoRegNum] = useState("");
  const [pandiClub, setPandiClub] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/company-profile/request-verification", {
        taxNumber: taxNumber.trim(),
        mtoRegistrationNumber: mtoRegNum.trim() || undefined,
        pandiClubName: pandiClub.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Talep gönderilemedi.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profile/me"] });
      toast({ title: "Doğrulama talebi gönderildi", description: "Adminimiz en kısa sürede inceleyecek." });
      setTaxNumber("");
      setMtoRegNum("");
      setPandiClub("");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Şirket Doğrulama Talebi
          </DialogTitle>
          <DialogDescription>
            Bilgilerinizi girin, admin incelemesi sonrası profilinizde "Doğrulanmış Şirket" rozeti görünecek.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="dlg-taxNumber">
              Vergi Numarası <span className="text-red-500">*</span>
            </Label>
            <Input
              id="dlg-taxNumber"
              value={taxNumber}
              onChange={e => setTaxNumber(e.target.value)}
              placeholder="10 haneli vergi numaranız"
              data-testid="input-dlg-tax-number"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dlg-mtoRegNum">
              MTO Kayıt No{" "}
              <span className="text-xs font-normal text-muted-foreground">(opsiyonel)</span>
            </Label>
            <Input
              id="dlg-mtoRegNum"
              value={mtoRegNum}
              onChange={e => setMtoRegNum(e.target.value)}
              placeholder="MTO üyelik / kayıt numarası"
              data-testid="input-dlg-mto-reg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dlg-pandiClub">
              P&amp;I Club{" "}
              <span className="text-xs font-normal text-muted-foreground">(opsiyonel)</span>
            </Label>
            <Input
              id="dlg-pandiClub"
              value={pandiClub}
              onChange={e => setPandiClub(e.target.value)}
              placeholder="Üye olduğunuz P&I Kulübü"
              data-testid="input-dlg-pandi-club"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              data-testid="button-dlg-cancel"
            >
              İptal
            </Button>
            <Button
              className="flex-1 gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !taxNumber.trim()}
              data-testid="button-dlg-submit-verification"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Talebi Gönder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
