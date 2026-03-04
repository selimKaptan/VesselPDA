import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Anchor, Ship, Handshake, Wrench, Eye, EyeOff, CheckCircle, Mail, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { PageMeta } from "@/components/page-meta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const VALID_ROLES = ["ship_agent", "shipowner", "ship_broker", "ship_provider"] as const;
type AppRole = typeof VALID_ROLES[number];

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
  userRole: z.enum(VALID_ROLES),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

const ROLES: {
  value: AppRole;
  label: string;
  description: string;
  icon: typeof Anchor;
  gradient: string;
  features: string[];
  testId: string;
}[] = [
  {
    value: "ship_agent",
    label: "Ship Agent",
    description: "Port operations & vessel agency services",
    icon: Anchor,
    gradient: "from-blue-600 to-cyan-500",
    features: [
      "DA calculations & proformas",
      "Statement of Facts (SOF)",
      "Document management",
      "Voyage coordination",
      "Tender bidding",
    ],
    testId: "card-role-ship_agent",
  },
  {
    value: "shipowner",
    label: "Shipowner",
    description: "Fleet management & commercial operations",
    icon: Ship,
    gradient: "from-indigo-600 to-violet-500",
    features: [
      "Fleet tracking & AIS",
      "Bunker management",
      "Crew & certificates",
      "ISM/ISPS compliance",
      "Fixtures & cargo",
    ],
    testId: "card-role-shipowner",
  },
  {
    value: "ship_broker",
    label: "Ship Broker",
    description: "Chartering, freight broking & commercial management",
    icon: Handshake,
    gradient: "from-emerald-600 to-teal-500",
    features: [
      "Fleet & voyage management",
      "Fixture management",
      "Cargo positions & tenders",
      "Market intelligence",
      "Laytime & demurrage",
    ],
    testId: "card-role-ship_broker",
  },
  {
    value: "ship_provider",
    label: "Ship Provider",
    description: "Maritime services & supply",
    icon: Wrench,
    gradient: "from-orange-500 to-amber-500",
    features: [
      "Service request responses",
      "Quote management",
      "Invoice generation",
      "Port services listing",
      "Tender participation",
    ],
    testId: "card-role-ship_provider",
  },
];

function RoleSelectionStep({ selected, onSelect, onNext }: {
  selected: AppRole | null;
  onSelect: (r: AppRole) => void;
  onNext: () => void;
}) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white">I am a...</h2>
        <p className="text-blue-200 text-sm mt-1">Select your role to continue</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {ROLES.map((role) => {
          const Icon = role.icon;
          const isSelected = selected === role.value;
          return (
            <button
              key={role.value}
              type="button"
              data-testid={role.testId}
              onClick={() => onSelect(role.value)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 cursor-pointer group ${
                isSelected
                  ? "border-white bg-white/15 shadow-lg"
                  : "border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${role.gradient} flex items-center justify-center mb-3 shadow-md`}>
                <Icon className="w-4.5 h-4.5 text-white w-5 h-5" />
              </div>
              <p className={`text-sm font-semibold leading-tight mb-1 ${isSelected ? "text-white" : "text-white/90"}`}>
                {role.label}
              </p>
              <p className="text-[11px] text-white/60 leading-tight">
                {role.description}
              </p>
              {isSelected && (
                <ul className="mt-3 space-y-1">
                  {role.features.slice(0, 3).map(f => (
                    <li key={f} className="flex items-center gap-1.5 text-[10px] text-white/80">
                      <Check className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        className="w-full font-semibold gap-2"
        style={{ background: "white", color: "#003D7A" }}
        disabled={!selected}
        onClick={onNext}
        data-testid="button-role-next"
      >
        Continue <ArrowRight className="w-4 h-4" />
      </Button>

      <p className="text-center text-sm text-white/60 mt-4">
        Already have an account?{" "}
        <Link href="/login" className="text-white font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </motion.div>
  );
}

function RegistrationFormStep({ role, onBack, form, onSubmit, isPending, showPassword, setShowPassword, showConfirm, setShowConfirm }: {
  role: AppRole;
  onBack: () => void;
  form: any;
  onSubmit: (data: RegisterForm) => void;
  isPending: boolean;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirm: boolean;
  setShowConfirm: (v: boolean) => void;
}) {
  const roleInfo = ROLES.find(r => r.value === role)!;
  const Icon = roleInfo.icon;

  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="text-white/70 hover:text-white transition-colors"
          data-testid="button-back-role"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${roleInfo.gradient} flex items-center justify-center`}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <h2 className="text-base font-bold text-white">{roleInfo.label}</h2>
          </div>
          <p className="text-xs text-white/60 mt-0.5">Create your account</p>
        </div>
      </div>

      <Card className="border-0 shadow-2xl" style={{ borderTop: "3px solid #F59E0B" }}>
        <CardContent className="px-5 py-5">
          <Form {...form}>
            <form
              data-testid="form-register"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-3"
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
                        <Input {...field} placeholder="Yılmaz" data-testid="input-last-name" />
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

              <Button
                type="submit"
                className="w-full font-semibold mt-1"
                style={{ background: "#003D7A" }}
                disabled={isPending}
                data-testid="button-register"
              >
                {isPending ? "Creating account..." : "Create Free Account"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-gray-500 mt-3">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Register() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);

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

  const handleRoleSelect = (role: AppRole) => {
    setSelectedRole(role);
  };

  const handleRoleNext = () => {
    if (!selectedRole) return;
    form.setValue("userRole", selectedRole);
    setStep(2);
  };

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
              <p className="text-amber-800 text-xs font-semibold mb-1">Email not arriving?</p>
              <ul className="text-amber-700 text-xs space-y-1 list-disc list-inside">
                <li>Check your spam / junk folder</li>
                <li>Hotmail / Outlook users: check "Junk" folder</li>
                <li>Wait a few minutes — delivery can be delayed</li>
              </ul>
            </div>
            <p className="text-gray-500 text-xs mb-6">
              Click the link to activate your account. The link expires in 24 hours.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
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
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 backdrop-blur mb-3">
              <Anchor className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">VesselPDA</h1>
            <p className="text-blue-200 text-sm">Maritime Platform</p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {[1, 2].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? "bg-white text-blue-700" : "bg-white/20 text-white/60"
                }`}>
                  {s}
                </div>
                {s < 2 && <div className={`w-10 h-0.5 transition-all ${step >= 2 ? "bg-white" : "bg-white/20"}`} />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <RoleSelectionStep
                selected={selectedRole}
                onSelect={handleRoleSelect}
                onNext={handleRoleNext}
              />
            ) : (
              <RegistrationFormStep
                role={selectedRole!}
                onBack={() => setStep(1)}
                form={form}
                onSubmit={(data) => registerMutation.mutate(data)}
                isPending={registerMutation.isPending}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                showConfirm={showConfirm}
                setShowConfirm={setShowConfirm}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
