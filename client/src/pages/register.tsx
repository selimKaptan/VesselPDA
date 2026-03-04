import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Ship, Building2, Eye, EyeOff, CheckCircle, Mail } from "lucide-react";
import { PageMeta } from "@/components/page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  userRole: z.enum(["shipowner", "agent", "provider"]),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const ROLES = [
  {
    value: "shipowner" as const,
    label: "Shipowner / Broker",
    description: "Generate proformas, manage fleet, find agents",
    icon: Ship,
    testId: "card-role-shipowner",
  },
  {
    value: "agent" as const,
    label: "Ship Agent",
    description: "Create company profile, appear in directory",
    icon: Anchor,
    testId: "card-role-agent",
  },
  {
    value: "provider" as const,
    label: "Service Provider",
    description: "Advertise maritime services to shipowners",
    icon: Building2,
    testId: "card-role-provider",
  },
];

export default function Register() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      userRole: "shipowner",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          userRole: data.userRole,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw { status: res.status, ...body };
      return body;
    },
    onSuccess: (_, variables) => {
      setRegistered(variables.email);
    },
    onError: (err: any) => {
      if (err.status === 409) {
        toast({
          title: "Email already in use",
          description: "Try signing in instead, or use a different email.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registration failed",
          description: err.message || "Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  if (registered) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "linear-gradient(135deg, #001f3f 0%, #003D7A 50%, #0077BE 100%)" }}
      >
        <Card className="w-full max-w-md border-0 shadow-2xl text-center" style={{ borderTop: "3px solid #22c55e" }}>
          <CardContent className="p-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email!</h2>
            <p className="text-gray-600 text-sm mb-1">
              We sent a verification link to:
            </p>
            <p className="text-blue-700 font-semibold text-sm mb-4">{registered}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-left">
              <p className="text-amber-800 text-xs font-semibold mb-1">Didn't receive the email?</p>
              <ul className="text-amber-700 text-xs space-y-1 list-disc list-inside">
                <li>Check your spam / junk folder</li>
                <li>Hotmail / Outlook users: check the "Junk" folder</li>
                <li>Wait a few minutes — delivery can sometimes be delayed</li>
              </ul>
            </div>
            <p className="text-gray-500 text-xs mb-6">
              Click the link to activate your account. The link is valid for 24 hours.
            </p>
            <Link href="/verify-email">
              <Button variant="outline" className="w-full mb-2">
                Resend Verification Email
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="w-full text-sm">
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    <PageMeta title="Register | VesselPDA" description="Create your VesselPDA account and join the maritime community." />
    <div
      className="min-h-screen flex items-center justify-center p-4 py-8"
      style={{ background: "linear-gradient(135deg, #001f3f 0%, #003D7A 50%, #0077BE 100%)" }}
    >
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur mb-3">
            <Anchor className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">VesselPDA</h1>
          <p className="text-blue-200 text-sm">Maritime Platform</p>
        </div>

        <Card className="border-0 shadow-2xl" style={{ borderTop: "3px solid #F59E0B" }}>
          <CardHeader className="pb-2 pt-6 px-6">
            <h2 className="text-xl font-bold text-center text-gray-900">Create Account</h2>
            <p className="text-sm text-gray-500 text-center">Join the maritime community</p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <Form {...form}>
              <form
                data-testid="form-register"
                onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ali" data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Smith" data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="you@company.com" data-testid="input-email" />
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
                            placeholder="Min. 8 characters"
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

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showConfirm ? "text" : "password"}
                            placeholder="Repeat your password"
                            data-testid="input-password-confirm"
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

                <FormField
                  control={form.control}
                  name="userRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>I am a...</FormLabel>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        {ROLES.map((role) => {
                          const Icon = role.icon;
                          const selected = field.value === role.value;
                          return (
                            <button
                              key={role.value}
                              type="button"
                              data-testid={role.testId}
                              onClick={() => field.onChange(role.value)}
                              className={`relative p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                                selected
                                  ? "border-blue-600 bg-blue-50"
                                  : "border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              {selected && (
                                <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-blue-600" />
                              )}
                              <Icon className={`w-5 h-5 mb-1 ${selected ? "text-blue-600" : "text-gray-400"}`} />
                              <p className={`text-xs font-semibold leading-tight ${selected ? "text-blue-800" : "text-gray-700"}`}>
                                {role.label}
                              </p>
                              <p className="text-xs text-gray-400 leading-tight mt-0.5 hidden sm:block">
                                {role.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full font-semibold"
                  style={{ background: "#003D7A" }}
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? "Creating account..." : "Create Free Account"}
                </Button>
              </form>
            </Form>

            <p className="text-center text-sm text-gray-500 mt-4">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
}
