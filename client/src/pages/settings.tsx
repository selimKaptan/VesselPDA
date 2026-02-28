import { useState } from "react";
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
import { CheckCircle, CheckCircle2, AlertCircle, User, Lock, Mail, Shield, Building2 } from "lucide-react";
import type { CompanyProfile } from "@shared/schema";

const AGENT_COMPLETION_FIELDS = [
  { key: "logoUrl", label: "Şirket Logosu", hint: "Güven oluşturmak için logo yükleyin", isArray: false },
  { key: "description", label: "Şirket Açıklaması", hint: "Hizmetlerinizi ve uzmanlığınızı açıklayın", isArray: false },
  { key: "serviceTypes", label: "Hizmet Türleri", hint: "Sunduğunuz hizmetleri listeleyin", isArray: true },
  { key: "servedPorts", label: "Hizmet Verilen Limanlar", hint: "Faaliyet gösterdiğiniz limanları ekleyin", isArray: true },
  { key: "phone", label: "Telefon Numarası", hint: "İletişim telefonu ekleyin", isArray: false },
];

const PROVIDER_COMPLETION_FIELDS = [
  { key: "logoUrl", label: "Şirket Logosu", hint: "Güven oluşturmak için logo yükleyin", isArray: false },
  { key: "description", label: "Şirket Açıklaması", hint: "Hizmetlerinizi ve uzmanlığınızı açıklayın", isArray: false },
  { key: "serviceTypes", label: "Hizmet Türleri", hint: "Sunduğunuz hizmetleri listeleyin", isArray: true },
  { key: "phone", label: "Telefon Numarası", hint: "İletişim telefonu ekleyin", isArray: false },
  { key: "email", label: "İletişim E-postası", hint: "İletişim e-postası ekleyin", isArray: false },
];

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const isEmailVerified = (user as any)?.emailVerified;
  const userRole = (user as any)?.userRole;
  const plan = (user as any)?.subscriptionPlan || "free";
  const showCompletion = userRole === "agent" || userRole === "provider";

  const { data: myProfile } = useQuery<CompanyProfile>({
    queryKey: ["/api/company-profile/me"],
    enabled: showCompletion,
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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
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
                  Profil Tamamlama
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {completionPct === 100
                    ? "Profiliniz tamamlandı! Dizinde tam görünürlüğe sahipsiniz."
                    : `${doneCount} / ${completionItems.length} alan tamamlandı`}
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
                        Ekle
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
                {completionPct === 100 ? "Profili Düzenle" : "Profili Tamamla"}
              </Button>
            </Link>
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
