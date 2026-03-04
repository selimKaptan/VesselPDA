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
          title: "Verification email sent",
          description: "Please check your inbox and spam/junk folder.",
        });
      } else {
        toast({ title: "Could not send email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Could not send email", variant: "destructive" });
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
              <h2 className="text-xl font-bold text-gray-900 mb-2">Verifying your email...</h2>
              <p className="text-gray-500 text-sm">Please wait.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-9 h-9 text-green-600" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Email Verified!</h2>
              <p className="text-gray-600 text-sm mb-6">
                Your account has been activated. You can now sign in to VesselPDA.
              </p>
              <Link href="/login">
                <Button className="w-full font-semibold" style={{ background: "#003D7A" }}>
                  Sign In
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
                {status === "notoken" ? "Verification Link Required" : "Link Invalid or Expired"}
              </h2>
              <p className="text-gray-600 text-sm mb-4">
                {status === "notoken"
                  ? "You should arrive here by clicking the link in your verification email. If you did not receive it, you can resend it below."
                  : "This verification link is invalid or has already been used. Request a new one below."}
              </p>
              {resendSent ? (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-left">
                  <p className="text-green-800 text-sm font-semibold mb-1">Email sent!</p>
                  <ul className="text-green-700 text-xs space-y-1 list-disc list-inside">
                    <li>Check your inbox</li>
                    <li>Also check your Spam / Junk folder</li>
                    <li>Hotmail / Outlook: check the "Junk" folder</li>
                    <li>It may take a few minutes to arrive</li>
                  </ul>
                </div>
              ) : (
                <div className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Your email address"
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
                    {resending ? "Sending..." : "Resend Verification Email"}
                  </Button>
                </div>
              )}
              <Link href="/login">
                <Button variant="ghost" className="w-full text-sm mt-2">
                  Back to Sign In
                </Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
