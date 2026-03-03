import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AiChat } from "@/components/ai-chat";
import { AppSidebar } from "@/components/app-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Menu, LayoutDashboard, Ship, Anchor, FileText, Building2, Gavel, MessageSquare, Navigation, MapPin, Star, Users, Settings as SettingsIcon, Crown, LogOut, Wrench } from "lucide-react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import RoleSelection from "@/pages/role-selection";
import Dashboard from "@/pages/dashboard";
import Vessels from "@/pages/vessels";
import Ports from "@/pages/ports";
import Proformas from "@/pages/proformas";
import ProformaNew from "@/pages/proforma-new";
import ProformaView from "@/pages/proforma-view";
import Pricing from "@/pages/pricing";
import Directory from "@/pages/directory";
import CompanyProfile from "@/pages/company-profile";
import ServicePorts from "@/pages/service-ports";
import AdminPanel from "@/pages/admin";
import TariffManagement from "@/pages/tariff-management";
import Forum from "@/pages/forum";
import ForumTopic from "@/pages/forum-topic";
import Tenders from "@/pages/tenders";
import TenderDetail from "@/pages/tender-detail";
import DirectoryProfile from "@/pages/directory-profile";
import Contact from "@/pages/contact";
import VesselTrack from "@/pages/vessel-track";
import PortInfo from "@/pages/port-info";
import Settings from "@/pages/settings";
import Voyages from "@/pages/voyages";
import VoyageDetail from "@/pages/voyage-detail";
import ServiceRequests from "@/pages/service-requests";
import ServiceRequestDetail from "@/pages/service-request-detail";
import Messages from "@/pages/messages";
import MessageThread from "@/pages/message-thread";
import Nominations from "@/pages/nominations";
import SanctionsCheck from "@/pages/sanctions-check";
import VesselCertificates from "@/pages/vessel-certificates";
import Fixtures from "@/pages/fixtures";
import CargoPositions from "@/pages/cargo-positions";
import MarketData from "@/pages/market-data";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import { LanguageProvider } from "@/lib/i18n";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import VerifyEmailPage from "@/pages/verify-email";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import { NotificationBell } from "@/components/notification-bell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { useState } from "react";

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-dark-mode-toggle"
      aria-label="Toggle dark mode"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </Button>
  );
}

function MobileNavLink({ href, icon: Icon, label, onClick }: { href: string; icon: any; label: string; onClick: () => void }) {
  const [location] = useLocation();
  const active = location === href;
  return (
    <Link href={href} onClick={onClick}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}>
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span>{label}</span>
      </div>
    </Link>
  );
}

function MobileNav({ user }: { user: any }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const role = user?.activeRole || user?.userRole;
  const isAdmin = user?.userRole === "admin";
  const plan = user?.subscriptionPlan || "free";
  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const PLAN_COLORS: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    standard: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    unlimited: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-nav" aria-label="Open navigation">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 border-b flex items-center gap-3">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-8 h-8 rounded-md object-contain" />
            <div>
              <div className="font-serif font-bold text-sm">VesselPDA</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Maritime Platform</div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <MobileNavLink href="/" icon={LayoutDashboard} label="Dashboard" onClick={close} />
            {(role === "shipowner" || role === "agent" || isAdmin) && (
              <MobileNavLink href="/vessels" icon={Ship} label="My Vessels" onClick={close} />
            )}
            {role !== "provider" && (
              <MobileNavLink href="/proformas" icon={FileText} label="Proformas" onClick={close} />
            )}
            {role !== "provider" && (
              <MobileNavLink href="/tenders" icon={Gavel} label="Tenders" onClick={close} />
            )}
            {role !== "provider" && (
              <MobileNavLink href="/vessel-track" icon={Navigation} label="Vessel Track" onClick={close} />
            )}
            <MobileNavLink href="/port-info" icon={MapPin} label="Port Info" onClick={close} />
            <MobileNavLink href="/service-ports" icon={Anchor} label="Service Ports" onClick={close} />
            <MobileNavLink href="/directory" icon={Building2} label="Directory" onClick={close} />
            <MobileNavLink href="/forum" icon={MessageSquare} label="Forum" onClick={close} />
            {(role === "shipowner" || role === "agent" || isAdmin) && (
              <MobileNavLink href="/voyages" icon={Ship} label="Seferler" onClick={close} />
            )}
            <MobileNavLink href="/service-requests" icon={Wrench} label="Hizmet Talepleri" onClick={close} />
            {isAdmin && <MobileNavLink href="/admin" icon={Users} label="Admin Panel" onClick={close} />}

            {/* Divider */}
            <div className="pt-1 pb-0.5 px-4">
              <div className="h-px bg-border" />
            </div>

            {/* Account section */}
            <MobileNavLink href="/settings" icon={SettingsIcon} label="Settings" onClick={close} />
            <MobileNavLink href="/company-profile" icon={Star} label="Company Profile" onClick={close} />
            <MobileNavLink href="/pricing" icon={Crown} label="Pricing" onClick={close} />
          </nav>

          {/* Footer — user info + logout */}
          <div className="border-t p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "User"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isAdmin && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 uppercase">
                    Admin
                  </span>
                )}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${PLAN_COLORS[plan] || PLAN_COLORS.free}`}>
                  {plan}
                </span>
              </div>
            </div>
            <a
              href="/api/logout"
              className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors group flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-red-500 transition-colors" />
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/vessels" component={Vessels} />
      <Route path="/ports" component={Ports} />
      <Route path="/proformas" component={Proformas} />
      <Route path="/proformas/new" component={ProformaNew} />
      <Route path="/proformas/:id" component={ProformaView} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/directory" component={Directory} />
      <Route path="/directory/:id" component={DirectoryProfile} />
      <Route path="/service-ports" component={ServicePorts} />
      <Route path="/company-profile" component={CompanyProfile} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/tariff-management" component={TariffManagement} />
      <Route path="/forum" component={Forum} />
      <Route path="/forum/:id" component={ForumTopic} />
      <Route path="/tenders" component={Tenders} />
      <Route path="/tenders/:id" component={TenderDetail} />
      <Route path="/contact" component={Contact} />
      <Route path="/vessel-track" component={VesselTrack} />
      <Route path="/port-info" component={PortInfo} />
      <Route path="/settings" component={Settings} />
      <Route path="/voyages" component={Voyages} />
      <Route path="/voyages/:id" component={VoyageDetail} />
      <Route path="/service-requests" component={ServiceRequests} />
      <Route path="/service-requests/:id" component={ServiceRequestDetail} />
      <Route path="/messages" component={Messages} />
      <Route path="/messages/:id" component={MessageThread} />
      <Route path="/nominations" component={Nominations} />
      <Route path="/sanctions-check" component={SanctionsCheck} />
      <Route path="/vessel-certificates" component={VesselCertificates} />
      <Route path="/fixtures" component={Fixtures} />
      <Route path="/cargo-positions" component={CargoPositions} />
      <Route path="/market-data" component={MarketData} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/reports" component={Reports} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const { user } = useAuth();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider defaultOpen={false} style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 px-3 border-b h-14 flex-shrink-0 bg-background">
            <div className="flex items-center gap-1">
              <MobileNav user={user} />
            </div>
            <div className="flex items-center gap-1">
              <DarkModeToggle />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <ErrorBoundary>
              <AuthenticatedRouter />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <AiChat />
    </SidebarProvider>
  );
}

function PublicDirectoryPage() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/directory" component={Directory} />
      <Route path="/directory/:id" component={DirectoryProfile} />
      <Route path="/service-ports" component={ServicePorts} />
      <Route path="/forum" component={Forum} />
      <Route path="/forum/:id" component={ForumTopic} />
      <Route path="/contact" component={Contact} />
      <Route><Landing /></Route>
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 text-center">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <PublicDirectoryPage />;
  }

  if (!(user as any).roleConfirmed) {
    return <RoleSelection />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <AppContent />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
