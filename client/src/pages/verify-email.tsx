import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmail() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
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
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      toast({ title: "Verification email sent", description: "Please check your inbox." });
    } catch {
      toast({ title: "Failed to send", variant: "destructive" });
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
              <p className="text-gray-500 text-sm">Please wait a moment.</p>
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
                Your account is now active. You can sign in and start using VesselPDA.
              </p>
              <Link href="/login">
                <Button className="w-full font-semibold" style={{ background: "#003D7A" }}>
                  Sign In Now
                </Button>
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-9 h-9 text-red-500" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Link Invalid or Expired</h2>
              <p className="text-gray-600 text-sm mb-6">
                This verification link is invalid or has already been used. Request a new one below.
              </p>
              <div className="space-y-3">
                <Input
                  type="email"
                  placeholder="Enter your email address"
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
                <Link href="/login">
                  <Button variant="ghost" className="w-full text-sm">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
