import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmail() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "notoken">("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("notoken");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      if (res.ok) {
        setResendSent(true);
        toast({
          title: "Doğrulama e-postası gönderildi",
          description: "Gelen kutunuzu ve spam/gereksiz klasörünüzü kontrol edin.",
        });
      } else {
        toast({ title: "Gönderilemedi", variant: "destructive" });
      }
    } catch {
      toast({ title: "Gönderilemedi", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #001f3f 0%, #003D7A 50%, #0077BE 100%)" }}
    >
      <Card className="w-full max-w-md border-0 shadow-2xl text-center">
        <CardContent className="p-8">
          {status === "loading" && (
            <>
              <div className="flex justify-center mb-4">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">E-posta doğrulanıyor...</h2>
              <p className="text-gray-500 text-sm">Lütfen bekleyin.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">E-posta Doğrulandı!</h2>
              <p className="text-gray-600 text-sm mb-6">
                Hesabınız aktif edildi. Artık VesselPDA'ya giriş yapabilirsiniz.
              </p>
              <Link href="/login">
                <Button className="w-full font-semibold" style={{ background: "#003D7A" }}>
                  Giriş Yap
                </Button>
              </Link>
            </>
          )}

          {(status === "error" || status === "notoken") && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-9 h-9 text-red-500" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {status === "notoken" ? "Doğrulama Bağlantısı Gerekli" : "Bağlantı Geçersiz veya Süresi Dolmuş"}
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                {status === "notoken"
                  ? "Doğrulama e-postasındaki bağlantıya tıklayarak buraya gelmelisiniz. E-postanızı alamadıysanız aşağıdan yeniden gönderebilirsiniz."
                  : "Bu doğrulama bağlantısı geçersiz veya daha önce kullanılmış. Aşağıdan yeni bir bağlantı talep edin."}
              </p>
              {resendSent ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-left">
                  <p className="text-green-800 text-sm font-semibold mb-1">E-posta gönderildi!</p>
                  <ul className="text-green-700 text-xs space-y-1 list-disc list-inside">
                    <li>Gelen kutunuzu kontrol edin</li>
                    <li>Spam / Gereksiz klasörünüze de bakın</li>
                    <li>Hotmail / Outlook: "Önemsiz" klasörünü kontrol edin</li>
                    <li>Birkaç dakika bekleyin, bazen gecikebilir</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    type="email"
                    placeholder="E-posta adresiniz"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    data-testid="input-resend-email"
                  />
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleResend}
                    disabled={resending || !resendEmail}
                    data-testid="button-resend"
                  >
                    {resending ? "Gönderiliyor..." : "Doğrulama E-postasını Tekrar Gönder"}
                  </Button>
                </div>
              )}
              <Link href="/login">
                <Button variant="ghost" className="w-full text-sm mt-2">
                  Giriş Sayfasına Dön
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
