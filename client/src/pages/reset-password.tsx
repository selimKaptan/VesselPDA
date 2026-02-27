import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetForm = z.infer<typeof schema>;

export default function ResetPassword() {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const token = new URLSearchParams(window.location.search).get("token");

  const form = useForm<ResetForm>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ResetForm) => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw body;
      return body;
    },
    onSuccess: () => setResult("success"),
    onError: () => setResult("error"),
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
        </div>

        <Card className="border-0 shadow-2xl" style={{ borderTop: "3px solid #F59E0B" }}>
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-xl font-bold text-center text-gray-900">Set New Password</h2>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {result === "success" && (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-green-600" />
                  </div>
                </div>
                <p className="text-gray-800 font-semibold mb-2">Password Updated!</p>
                <p className="text-gray-500 text-sm mb-6">
                  Your password has been changed successfully. You can now sign in.
                </p>
                <Link href="/login">
                  <Button className="w-full font-semibold" style={{ background: "#003D7A" }}>
                    Sign In
                  </Button>
                </Link>
              </div>
            )}

            {result === "error" && (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="w-7 h-7 text-red-500" />
                  </div>
                </div>
                <p className="text-gray-800 font-semibold mb-2">Link Invalid or Expired</p>
                <p className="text-gray-500 text-sm mb-6">
                  This reset link is no longer valid. Please request a new one.
                </p>
                <Link href="/forgot-password">
                  <Button variant="outline" className="w-full">
                    Request New Link
                  </Button>
                </Link>
              </div>
            )}

            {!result && (
              <>
                {!token && (
                  <div className="text-center text-red-500 text-sm mb-4">
                    Invalid reset link. Please request a new one.
                  </div>
                )}
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                    className="space-y-4"
                    data-testid="form-reset-password"
                  >
                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showNew ? "text" : "password"}
                                placeholder="Min. 8 characters"
                                data-testid="input-new-password"
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowNew(!showNew)}
                                tabIndex={-1}
                              >
                                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showConfirm ? "text" : "password"}
                                placeholder="Repeat your password"
                                data-testid="input-confirm-password"
                              />
                              <button
                                type="button"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                onClick={() => setShowConfirm(!showConfirm)}
                                tabIndex={-1}
                              >
                                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full font-semibold"
                      style={{ background: "#003D7A" }}
                      disabled={mutation.isPending || !token}
                      data-testid="button-reset-password"
                    >
                      {mutation.isPending ? "Updating..." : "Set New Password"}
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
