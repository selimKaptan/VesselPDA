import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, CheckCircle2, AlertCircle, User, Lock, Mail, Shield, Building2, ShieldCheck, Clock, XCircle, Loader2 } from "lucide-react";
import type { CompanyProfile } from "@shared/schema";

const AGENT_COMPLETION_FIELDS = [
  { key: "logoUrl", label: "Company Logo", hint: "Upload a logo to build trust", isArray: false },
  { key: "description", label: "Company Description", hint: "Describe your services and expertise", isArray: false },
  { key: "serviceTypes", label: "Service Types", hint: "List the services you offer", isArray: true },
  { key: "servedPorts", label: "Served Ports", hint: "Add the ports you operate in", isArray: true },
  { key: "phone", label: "Phone Number", hint: "Add a contact phone number", isArray: false },
];

const PROVIDER_COMPLETION_FIELDS = [
  { key: "logoUrl", label: "Company Logo", hint: "Upload a logo to build trust", isArray: false },
  { key: "description", label: "Company Description", hint: "Describe your services and expertise", isArray: false },
  { key: "serviceTypes", label: "Service Types", hint: "List the services you offer", isArray: true },
  { key: "phone", label: "Phone Number", hint: "Add a contact phone number", isArray: false },
  { key: "email", label: "Contact Email", hint: "Add a contact email address", isArray: false },
];

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (window.location.hash === "#section-verification") {
      setTimeout(() => {
        document.getElementById("section-verification")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, []);

  const [firstName, setFirstName] = useState((user as any)?.firstName || "");
  const [lastName, setLastName] = useState((user as any)?.lastName || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile updated", description: "Your name has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/auth/change-password", data);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to change password");
      }
      return res.json();
    },
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed", description: "Your password has been updated." });
    },
    onError: (err: any) => {
      toast({ title: "Password change failed", description: err.message, variant: "destructive" });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", { email: (user as any)?.email });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Verification email sent", description: "Check your inbox." });
    },
    onError: () => {
      toast({ title: "Failed to send email", variant: "destructive" });
    },
  });

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) return;
    updateProfileMutation.mutate({ firstName: firstName.trim(), lastName: lastName.trim() });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Minimum 8 characters.", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const [taxNumber, setTaxNumber] = useState("");
  const [mtoRegNum, setMtoRegNum] = useState("");
  const [pandiClub, setPandiClub] = useState("");

  const isEmailVerified = (user as any)?.emailVerified;
  const userRole = (user as any)?.userRole;
  const plan = (user as any)?.subscriptionPlan || "free";
  const showCompletion = userRole === "agent" || userRole === "provider";

  const { data: myProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profile/me"],
    enabled: showCompletion,
  });

  const requestVerificationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/company-profile/request-verification", {
        taxNumber: taxNumber.trim(),
        mtoRegistrationNumber: mtoRegNum.trim() || undefined,
        pandiClubName: pandiClub.trim() || undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-profile/me"] });
      toast({ title: "Verification request submitted", description: "Awaiting admin review." });
      setTaxNumber("");
      setMtoRegNum("");
      setPandiClub("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const completionFields = userRole === "agent" ? AGENT_COMPLETION_FIELDS : PROVIDER_COMPLETION_FIELDS;
  const completionItems = showCompletion && myProfile
    ? completionFields.map((f) => {
        const val = (myProfile as any)[f.key];
        const done = f.isArray ? Array.isArray(val) && val.length > 0 : !!val;
        return { ...f, done };
      })
    : [];
  const doneCount = completionItems.filter((i) => i.done).length;
  const completionPct = completionItems.length > 0 ? Math.round((doneCount / completionItems.length) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-3 py-5 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile, password and account details.</p>
      </div>

      {/* Profile Completion — agent & provider only */}
      {showCompletion && myProfile && (
        <Card data-testid="card-profile-completion">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  Profile Completion
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {completionPct === 100
                    ? "Your profile is complete! You have full visibility in the directory."
                    : `${doneCount} / ${completionItems.length} fields completed`}
                </CardDescription>
              </div>
              <span className={`text-2xl font-bold font-serif flex-shrink-0 ${
                completionPct === 100 ? "text-emerald-600" : completionPct >= 60 ? "text-amber-600" : "text-red-500"
              }`}>
                {completionPct}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  completionPct === 100 ? "bg-emerald-500" : completionPct >= 60 ? "bg-amber-500" : "bg-red-400"
                }`}
                style={{ width: `${completionPct}%` }}
              />
            </div>

            <div className="space-y-2">
              {completionItems.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                    item.done
                      ? "border-green-200/60 bg-green-50/30 dark:border-green-800/40 dark:bg-green-950/10"
                      : "border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/10"
                  }`}
                  data-testid={`completion-${item.key}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.done
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      {!item.done && <p className="text-xs text-muted-foreground">{item.hint}</p>}
                    </div>
                  </div>
                  {!item.done && (
                    <Link href="/company-profile">
                      <Button variant="outline" size="sm" className="text-xs h-7 px-3 flex-shrink-0">
                        Add
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>

            <Link href="/company-profile">
              <Button
                className="w-full gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white"
                data-testid="button-go-to-company-profile"
              >
                <Building2 className="w-4 h-4" />
                {completionPct === 100 ? "Edit Profile" : "Complete Profile"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Company Verification — agent & provider only */}
      {showCompletion && myProfile && (
        <Card id="section-verification" data-testid="card-company-verification">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Company Verification
            </CardTitle>
            <CardDescription>
              Get a trust badge and stand out in the directory by verifying your company.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status display */}
            {(myProfile as any).verificationStatus === "verified" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40">
                <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Company Verified</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">A "Verified Company" badge is displayed on your profile.</p>
                </div>
              </div>
            ) : (myProfile as any).verificationStatus === "pending" ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Under Review</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Your verification request is being reviewed by an admin. You will be notified shortly.</p>
                </div>
              </div>
            ) : (myProfile as any).verificationStatus === "rejected" ? (
              <div className="flex flex-col gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40">
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">Verification Rejected</p>
                </div>
                {(myProfile as any).verificationNote && (
                  <p className="text-xs text-red-600 dark:text-red-400 ml-7">{(myProfile as any).verificationNote}</p>
                )}
                <p className="text-xs text-muted-foreground ml-7">You can update your information and reapply.</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-dashed">
                <ShieldCheck className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Not yet verified</p>
                  <p className="text-xs text-muted-foreground">Add your tax number and registration details to request verification.</p>
                </div>
              </div>
            )}

            {/* Form — only if not pending/verified */}
            {["unverified", "rejected"].includes((myProfile as any).verificationStatus || "unverified") && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="taxNumber">Tax Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="taxNumber"
                    value={taxNumber}
                    onChange={e => setTaxNumber(e.target.value)}
                    placeholder="Your 10-digit tax number"
                    data-testid="input-tax-number"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mtoRegNum">MTO Reg. No <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="mtoRegNum"
                    value={mtoRegNum}
                    onChange={e => setMtoRegNum(e.target.value)}
                    placeholder="MTO membership/registration number"
                    data-testid="input-mto-reg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pandiClub">P&I Club <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="pandiClub"
                    value={pandiClub}
                    onChange={e => setPandiClub(e.target.value)}
                    placeholder="Your P&I Club membership"
                    data-testid="input-pandi-club"
                  />
                </div>
                <Button
                  onClick={() => requestVerificationMutation.mutate()}
                  disabled={requestVerificationMutation.isPending || !taxNumber.trim()}
                  className="w-full gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white"
                  data-testid="button-request-verification"
                >
                  {requestVerificationMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  Submit Verification Request
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Account Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-muted-foreground" />
            Account Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-foreground font-medium">{(user as any)?.email}</span>
            {isEmailVerified ? (
              <Badge variant="secondary" className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 gap-1 text-xs">
                <CheckCircle className="w-3 h-3" /> Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 gap-1 text-xs">
                <AlertCircle className="w-3 h-3" /> Not Verified
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground capitalize">{userRole}</span>
            <Badge variant="outline" className="text-xs capitalize">{plan}</Badge>
          </div>
          {!isEmailVerified && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => resendVerificationMutation.mutate()}
                disabled={resendVerificationMutation.isPending}
                data-testid="button-resend-verification"
              >
                {resendVerificationMutation.isPending ? "Sending..." : "Resend verification email"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4 text-muted-foreground" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your display name.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  data-testid="input-last-name"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="w-4 h-4 text-muted-foreground" />
            Change Password
          </CardTitle>
          <CardDescription>Keep your account secure with a strong password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                data-testid="input-current-password"
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                data-testid="input-confirm-password"
              />
            </div>
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
