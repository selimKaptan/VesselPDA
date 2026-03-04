import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Ship, Building2, Eye, EyeOff, Mail, Briefcase, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { PageMeta } from "@/components/page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const ROLES = [
  {
    value: "agent" as const,
    label: "Ship Agent",
    description: "Port operations and PDA management",
    icon: Anchor,
    testId: "card-role-agent",
    accent: "blue",
  },
  {
    value: "shipowner" as const,
    label: "Shipowner",
    description: "Fleet management and voyage tracking",
    icon: Ship,
    testId: "card-role-shipowner",
    accent: "indigo",
  },
  {
    value: "broker" as const,
    label: "Ship Broker",
    description: "Charter and fixture management",
    icon: Briefcase,
    testId: "card-role-broker",
    accent: "violet",
  },
  {
    value: "provider" as const,
    label: "Ship Provider",
    description: "Service and supply management",
    icon: Building2,
    testId: "card-role-provider",
    accent: "teal",
  },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const ACCENT_STYLES: Record<string, string> = {
  blue:   "border-blue-500 bg-blue-50/80 dark:bg-blue-950/30",
  indigo: "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/30",
  violet: "border-violet-500 bg-violet-50/80 dark:bg-violet-950/30",
  teal:   "border-teal-500 bg-teal-50/80 dark:bg-teal-950/30",
};

const ICON_STYLES: Record<string, string> = {
  blue:   "text-blue-600",
  indigo: "text-indigo-600",
  violet: "text-violet-600",
  teal:   "text-teal-600",
};

export default function Register() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<RoleValue | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
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
          userRole: selectedRole,
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

  function handleRoleSelect(role: RoleValue) {
    setSelectedRole(role);
    setStep(2);
  }

  const background = "linear-gradient(135deg, #001f3f 0%, #003D7A 50%, #0077BE 100%)";

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background }}>
        <Card className="w-full max-w-md border-0 shadow-2xl text-center" style={{ borderTop: "3px solid #22c55e" }}>
          <CardContent className="p-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">Check your email!</h2>
            <p className="text-muted-foreground text-sm mb-1">We sent a verification link to:</p>
            <p className="text-blue-700 font-semibold text-sm mb-4">{registered}</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-left">
              <p className="text-amber-800 text-xs font-semibold mb-1">Didn't receive the email?</p>
              <ul className="text-amber-700 text-xs space-y-1 list-disc list-inside">
                <li>Check your spam / junk folder</li>
                <li>Hotmail / Outlook users: check the "Junk" folder</li>
                <li>Wait a few minutes — delivery can sometimes be delayed</li>
              </ul>
            </div>
            <p className="text-muted-foreground text-xs mb-6">
              Click the link to activate your account. The link is valid for 24 hours.
            </p>
            <Link href="/verify-email">
              <Button variant="outline" className="w-full mb-2">Resend Verification Email</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="w-full text-sm">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageMeta title="Register | VesselPDA" description="Create your VesselPDA account and join the maritime community." />
      <div className="min-h-screen flex items-center justify-center p-4 py-8" style={{ background }}>
        <div className="w-full max-w-xl">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur mb-3">
              <Anchor className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">VesselPDA</h1>
            <p className="text-blue-200 text-sm">Maritime Platform</p>
          </div>

          {/* Step 1: Role Selection */}
          {step === 1 && (
            <Card className="border-0 shadow-2xl" style={{ borderTop: "3px solid #F59E0B" }}>
              <CardHeader className="pb-2 pt-6 px-6">
                <h2 className="text-xl font-bold text-center">Choose Your Role</h2>
                <p className="text-sm text-muted-foreground text-center">Select the role that best describes you</p>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {ROLES.map((role) => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        data-testid={role.testId}
                        onClick={() => handleRoleSelect(role.value)}
                        className="relative p-4 rounded-xl border-2 border-border bg-background hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition-all group cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                          <Icon className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                        </div>
                        <p className="font-semibold text-sm text-foreground mb-0.5">{role.label}</p>
                        <p className="text-xs text-muted-foreground leading-tight">{role.description}</p>
                        <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-muted-foreground/40 group-hover:text-blue-500 transition-colors" />
                      </button>
                    );
                  })}
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Registration Form */}
          {step === 2 && selectedRole && (() => {
            const roleInfo = ROLES.find(r => r.value === selectedRole)!;
            const Icon = roleInfo.icon;
            return (
              <Card className="border-0 shadow-2xl" style={{ borderTop: "3px solid #F59E0B" }}>
                <CardHeader className="pb-2 pt-6 px-6">
                  <div className="flex items-center gap-3 mb-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-back-to-role"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${ACCENT_STYLES[roleInfo.accent]}`}>
                      <Icon className={`w-4 h-4 ${ICON_STYLES[roleInfo.accent]}`} />
                      <span className="text-sm font-semibold">{roleInfo.label}</span>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${ICON_STYLES[roleInfo.accent]}`} />
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-center">Create Account</h2>
                  <p className="text-sm text-muted-foreground text-center">Join the maritime community</p>
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
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending ? "Creating account..." : "Create Free Account"}
                      </Button>
                    </form>
                  </Form>

                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Already have an account?{" "}
                    <Link href="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
                  </p>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      </div>
    </>
  );
}
