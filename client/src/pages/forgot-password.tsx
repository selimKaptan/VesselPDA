import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotForm = z.infer<typeof schema>;

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ForgotForm) => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
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
            <h2 className="text-xl font-bold text-center text-gray-900">Reset Password</h2>
            <p className="text-sm text-gray-500 text-center">
              Enter your email and we'll send you a reset link
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {submitted ? (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-blue-600" />
                  </div>
                </div>
                <p className="text-gray-700 font-medium mb-2">Check your inbox</p>
                <p className="text-gray-500 text-sm mb-6">
                  If an account with that email exists, we've sent password reset instructions.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                  className="space-y-4"
                  data-testid="form-forgot-password"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder="you@company.com"
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full font-semibold"
                    style={{ background: "#003D7A" }}
                    disabled={mutation.isPending}
                    data-testid="button-send-reset"
                  >
                    {mutation.isPending ? "Sending..." : "Send Reset Link"}
                  </Button>

                  <p className="text-center text-sm text-gray-500">
                    <Link href="/login" className="text-blue-600 hover:underline">
                      Back to Sign In
                    </Link>
                  </p>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
