import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Anchor, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw { status: res.status, ...body };
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    },
    onError: (err: any) => {
      if (err.status === 403 && err.message === "email_not_verified") {
        setUnverifiedEmail(err.email);
      } else {
        toast({
          title: "Login failed",
          description: err.message || "Invalid email or password",
          variant: "destructive",
        });
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Verification email sent", description: "Please check your inbox." });
    },
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #001f3f 0%, #003D7A 50%, #0077BE 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur mb-4">
            <Anchor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">VesselPDA</h1>
          <p className="text-blue-200 mt-1 text-sm">Maritime Platform</p>
        </div>

        <Card className="border-0 shadow-2xl" style={{ borderTop: "3px solid #F59E0B" }}>
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-xl font-bold text-center text-gray-900">Sign In</h2>
            <p className="text-sm text-gray-500 text-center">Welcome back to VesselPDA</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {unverifiedEmail && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 font-medium mb-2">Email not verified</p>
                <p className="text-xs text-amber-700 mb-3">
                  Please check your inbox and click the verification link.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  onClick={() => resendMutation.mutate(unverifiedEmail)}
                  disabled={resendMutation.isPending}
                  data-testid="button-resend-verification"
                >
                  {resendMutation.isPending ? "Sending..." : "Resend verification email"}
                </Button>
              </div>
            )}

            <Form {...form}>
              <form
                data-testid="form-login"
                onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="you@company.com"
                          autoComplete="email"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setShowPassword(!showPassword)}
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-blue-600 hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full font-semibold"
                  style={{ background: "#003D7A" }}
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-gray-500 mt-4">
              Don't have an account?{" "}
              <Link href="/register" className="text-blue-600 font-medium hover:underline" data-testid="link-register">
                Create account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
