import { useState } from "react";
import { Link } from "wouter";
import { Building2, ArrowRight, Star, Phone, Mail, Globe, MapPin, Activity, MessageSquare, Crown, ShieldCheck, AlertTriangle, Clock, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CompanyProfile } from "@shared/schema";
import { VerificationRequestDialog } from "@/components/verification-request-dialog";


export function ProviderDashboard({ user, myProfile }: { user: any; myProfile?: CompanyProfile | null }) {
  if (!myProfile) {
    return (
      <div className="space-y-6">
        <Card className="p-8 border-dashed border-2 border-[hsl(var(--maritime-primary)/0.25)] bg-[hsl(var(--maritime-primary)/0.02)]" data-testid="card-no-profile">
          <div className="flex flex-col items-center text-center gap-5 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--maritime-primary)/0.1)] flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[hsl(var(--maritime-primary))]" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif font-semibold text-lg">Create Your Company Profile</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Set up your service provider profile to appear in the maritime directory. Shipowners and agents will be able to find and contact you directly.
              </p>
            </div>
            <Link href="/company-profile">
              <Button className="gap-2 bg-[hsl(var(--maritime-primary))] hover:bg-[hsl(var(--maritime-primary)/0.9)] text-white shadow-sm" data-testid="button-create-profile">
                <Building2 className="w-4 h-4" /> Create Profile Now
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const serviceTypes = ((myProfile as any).serviceTypes as string[]) || [];
  const servedPorts = ((myProfile as any).servedPorts as number[]) || [];
  const verificationStatus = (myProfile as any)?.verificationStatus || "unverified";
  const verificationNote = (myProfile as any)?.verificationNote;
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Verification status banner */}
      {verificationStatus === "unverified" && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50" data-testid="banner-verification-unverified">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Şirketiniz henüz doğrulanmamış</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Doğrulama talebi göndererek dizinde güven rozeti kazanın ve öne çıkın.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100 flex-shrink-0 dark:border-amber-700 dark:text-amber-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-go-verify">
            <ShieldCheck className="w-3 h-3" /> Doğrulama Talebi
          </Button>
        </div>
      )}
      {verificationStatus === "pending" && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50" data-testid="banner-verification-pending">
          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <span className="font-medium">Doğrulama talebiniz inceleniyor.</span>{" "}
            <span className="font-normal text-blue-600 dark:text-blue-400">En kısa sürede size dönülecek.</span>
          </p>
        </div>
      )}
      {verificationStatus === "verified" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40" data-testid="banner-verification-verified">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Şirketiniz doğrulanmış — dizinde güven rozeti gösteriliyor.</p>
        </div>
      )}
      {verificationStatus === "rejected" && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/70 dark:border-red-800/50" data-testid="banner-verification-rejected">
          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Doğrulama talebiniz reddedildi</p>
            {verificationNote && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{verificationNote}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">Bilgilerinizi güncelleyerek tekrar başvurabilirsiniz.</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0 dark:border-red-700 dark:text-red-300" onClick={() => setVerifyDialogOpen(true)} data-testid="button-retry-verify">
            <ShieldCheck className="w-3 h-3" /> Tekrar Başvur
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-6">
          {/* Services + Contact */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Services */}
            <Card className="p-5 space-y-3" data-testid="card-services">
              <h2 className="font-serif font-semibold text-sm">Services Offered</h2>
              {serviceTypes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {serviceTypes.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[11px] px-2 py-0.5">{s}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No services listed yet</p>
              )}
              <Link href="/company-profile">
                <Button variant="ghost" size="sm" className="w-full text-xs mt-1 border border-dashed">
                  {serviceTypes.length > 0 ? "Edit Services" : "Add Services"}
                </Button>
              </Link>
            </Card>

            {/* Contact & Visibility */}
            <Card className="p-5 space-y-3" data-testid="card-contact">
              <h2 className="font-serif font-semibold text-sm">Contact & Visibility</h2>
              <div className="space-y-2 text-sm">
                {(myProfile as any).email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate text-xs">{(myProfile as any).email}</span>
                  </div>
                )}
                {(myProfile as any).phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs">{(myProfile as any).phone}</span>
                  </div>
                )}
                {(myProfile as any).website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate text-xs">{(myProfile as any).website}</span>
                  </div>
                )}
                {(myProfile as any).city && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-xs">{(myProfile as any).city}{(myProfile as any).country ? `, ${(myProfile as any).country}` : ""}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge className={`text-[10px] ${(myProfile as any).isActive !== false ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700"}`}>
                  {(myProfile as any).isActive !== false ? "Active" : "Inactive"}
                </Badge>
                {(myProfile as any).isFeatured && (
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <Star className="w-2.5 h-2.5 mr-0.5 fill-amber-500" /> Featured
                  </Badge>
                )}
                {servedPorts.length > 0 && (
                  <span className="text-xs text-muted-foreground">{servedPorts.length} port{servedPorts.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </Card>
          </div>

          {/* Featured Upsell */}
          {!(myProfile as any).isFeatured && (
            <Card className="p-5 border-amber-200/60 dark:border-amber-800/40 bg-gradient-to-r from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10" data-testid="card-featured-upsell">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-amber-600 fill-amber-400" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-sm">Stand Out in the Directory</p>
                  <p className="text-xs text-muted-foreground">Featured listings appear at the top with a highlighted badge. Increase your visibility to shipowners and agents looking for services in your ports.</p>
                </div>
                <Link href="/pricing">
                  <Button size="sm" className="gap-1.5 shrink-0 bg-amber-500 hover:bg-amber-600 text-white">
                    <Crown className="w-3.5 h-3.5" /> Get Featured
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Quick Actions */}
        <div>
          <Card className="p-5 space-y-3">
            <h2 className="font-serif font-semibold text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground/60" /> Quick Actions
            </h2>
            <div className="space-y-1.5">
              {[
                { href: "/company-profile", icon: Building2, label: "Edit Profile", desc: "Update your company listing", color: "var(--maritime-primary)", testId: "qa-edit-profile" },
                { href: `/directory/${(myProfile as any).id}`, icon: Star, label: "View My Listing", desc: "See how you appear in directory", color: "38 92% 50%", testId: "qa-view-listing" },
                { href: "/directory", icon: Building2, label: "Browse Directory", desc: "See other maritime companies", color: "var(--maritime-accent)", testId: "qa-browse-directory" },
                { href: "/forum", icon: MessageSquare, label: "Maritime Forum", desc: "Connect with industry professionals", color: "217 91% 40%", testId: "qa-forum" },
                { href: "/pricing", icon: Crown, label: "Upgrade Plan", desc: "Access premium features", color: "142 71% 30%", testId: "qa-pricing" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group" data-testid={action.testId}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `hsl(${action.color} / 0.1)` }}>
                      <action.icon className="w-4 h-4" style={{ color: `hsl(${action.color})` } as React.CSSProperties} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <VerificationRequestDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
      />
    </div>
  );
}
