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
import { Moon, Sun, Menu, LayoutDashboard, Ship, Anchor, FileText, Building2, Gavel, MessageSquare, MessageCircle, Navigation, MapPin, Users, Settings as SettingsIcon, Crown, LogOut, Wrench, Handshake, Receipt, TrendingUp, Fuel, ShieldCheck, Scale, Mail, UserCheck, Package } from "lucide-react";
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
import Compliance from "@/pages/compliance";
import Fixtures from "@/pages/fixtures";
import CargoPositions from "@/pages/cargo-positions";
import MarketData from "@/pages/market-data";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import OrganizationPage from "@/pages/organization";
import OrganizationSelectPage from "@/pages/organization-select";
import OrganizationJoinPage from "@/pages/organization-join";
import TeamChat from "@/pages/team-chat";
import OrganizationDashboard from "@/pages/organization-dashboard";
import FinalDa from "@/pages/final-da";
import FinalDaEdit from "@/pages/final-da-edit";
import BunkerManagement from "@/pages/bunker-management";
import MaritimeDocView from "@/pages/maritime-doc-view";
import PortBenchmarking from "@/pages/port-benchmarking";
import EmailInbox from "@/pages/email-inbox";
import DemoPage from "@/pages/demo";
import { DemoProvider } from "@/contexts/demo-context";
import { DemoBanner } from "@/components/demo-banner";
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
  const userRole: string = user?.userRole || "shipowner";
  const activeRole: string = user?.activeRole || userRole;
  const isAdmin = userRole === "admin";
  const role = isAdmin ? activeRole : userRole;
  const plan = user?.subscriptionPlan || "free";
  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const ROLE_BADGE_COLORS: Record<string, string> = {
    ship_agent:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    shipowner:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    ship_broker:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    ship_provider: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    admin:         "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const ROLE_LABELS: Record<string, string> = {
    ship_agent: "Agent", shipowner: "Owner", ship_broker: "Broker",
    ship_provider: "Provider", admin: "Admin",
  };
  const PLAN_COLORS: Record<string, string> = {
    free: "bg-muted text-muted-foreground",
    standard: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    unlimited: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  type MobileLink = { href: string; icon: any; label: string };

  const agentLinks: MobileLink[] = [
    { href: "/",               icon: LayoutDashboard, label: "Dashboard" },
    { href: "/voyages",        icon: Navigation,      label: "Voyages" },
    { href: "/proformas",      icon: FileText,        label: "Proformas" },
    { href: "/messages",       icon: MessageSquare,   label: "Messages" },
    { href: "/tenders",        icon: Gavel,           label: "Tenders" },
    { href: "/vessels",        icon: Ship,            label: "Vessels" },
    { href: "/vessel-track",   icon: MapPin,          label: "Vessel Track" },
    { href: "/nominations",    icon: UserCheck,       label: "Nominations" },
    { href: "/final-da",       icon: Scale,           label: "Final DA" },
    { href: "/compliance",     icon: ShieldCheck,     label: "Compliance" },
    { href: "/email-inbox",    icon: Mail,            label: "Email Inbox" },
    { href: "/forum",          icon: MessageSquare,   label: "Forum" },
    { href: "/directory",      icon: Building2,       label: "Directory" },
  ];
  const shipownerLinks: MobileLink[] = [
    { href: "/",                   icon: LayoutDashboard, label: "Dashboard" },
    { href: "/vessels",            icon: Ship,            label: "My Fleet" },
    { href: "/voyages",            icon: Navigation,      label: "Voyages" },
    { href: "/bunker-management",  icon: Fuel,            label: "Bunker" },
    { href: "/proformas",          icon: FileText,        label: "Proformas" },
    { href: "/fixtures",           icon: Handshake,       label: "Fixtures" },
    { href: "/market-data",        icon: TrendingUp,      label: "Market Data" },
    { href: "/compliance",         icon: ShieldCheck,     label: "Compliance" },
    { href: "/messages",           icon: MessageSquare,   label: "Messages" },
    { href: "/email-inbox",        icon: Mail,            label: "Email Inbox" },
    { href: "/cargo-positions",    icon: Package,         label: "Cargo" },
    { href: "/forum",              icon: MessageSquare,   label: "Forum" },
    { href: "/directory",          icon: Building2,       label: "Directory" },
  ];
  const brokerLinks: MobileLink[] = [
    { href: "/",                  icon: LayoutDashboard, label: "Dashboard" },
    { href: "/vessels",           icon: Ship,            label: "Fleet" },
    { href: "/fixtures",          icon: Handshake,       label: "Fixtures" },
    { href: "/market-data",       icon: TrendingUp,      label: "Market" },
    { href: "/cargo-positions",   icon: Package,         label: "Cargo" },
    { href: "/voyages",           icon: Navigation,      label: "Voyages" },
    { href: "/proformas",         icon: FileText,        label: "Proformas" },
    { href: "/messages",          icon: MessageSquare,   label: "Messages" },
    { href: "/tenders",           icon: Gavel,           label: "Tenders" },
    { href: "/email-inbox",       icon: Mail,            label: "Email Inbox" },
    { href: "/forum",             icon: MessageSquare,   label: "Forum" },
    { href: "/directory",         icon: Building2,       label: "Directory" },
  ];
  const providerLinks: MobileLink[] = [
    { href: "/",                  icon: LayoutDashboard, label: "Dashboard" },
    { href: "/service-requests",  icon: Wrench,          label: "Requests" },
    { href: "/tenders",           icon: Gavel,           label: "Tenders" },
    { href: "/invoices",          icon: Receipt,         label: "Invoices" },
    { href: "/messages",          icon: MessageSquare,   label: "Messages" },
    { href: "/forum",             icon: MessageSquare,   label: "Forum" },
    { href: "/directory",         icon: Building2,       label: "Directory" },
  ];

  const linkSets: Record<string, MobileLink[]> = {
    ship_agent: agentLinks,
    shipowner: shipownerLinks,
    ship_broker: brokerLinks,
    ship_provider: providerLinks,
  };

  const navLinks = isAdmin
    ? [...agentLinks, { href: "/admin", icon: Users, label: "Admin Panel" }]
    : (linkSets[role] || agentLinks);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-nav" aria-label="Open navigation">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <div className="flex flex-col h-full">
          <div className="px-4 py-4 border-b flex items-center gap-3">
            <img src="/logo-v2.png" alt="VesselPDA" className="w-8 h-8 rounded-md object-contain" />
            <div>
              <div className="font-serif font-bold text-sm">VesselPDA</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Maritime Platform</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {navLinks.map((link) => (
              <MobileNavLink key={link.href + link.label} href={link.href} icon={link.icon} label={link.label} onClick={close} />
            ))}
            <div className="pt-1 pb-0.5 px-4"><div className="h-px bg-border" /></div>
            <MobileNavLink href="/settings" icon={SettingsIcon} label="Settings" onClick={close} />
            <MobileNavLink href="/pricing"  icon={Crown}        label="Pricing"  onClick={close} />
          </nav>
          <div className="border-t p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "User"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${ROLE_BADGE_COLORS[userRole] || ROLE_BADGE_COLORS.shipowner}`}>
                  {ROLE_LABELS[userRole] || userRole}
                </span>
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
      <Route path="/compliance" component={Compliance} />
      <Route path="/compliance/:checklistId" component={Compliance} />
      <Route path="/bunker-management" component={BunkerManagement} />
      <Route path="/maritime-docs/:id" component={MaritimeDocView} />
      <Route path="/fixtures" component={Fixtures} />
      <Route path="/cargo-positions" component={CargoPositions} />
      <Route path="/market-data" component={MarketData} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/reports" component={Reports} />
      <Route path="/organization" component={OrganizationPage} />
      <Route path="/organization-select" component={OrganizationSelectPage} />
      <Route path="/organization/join/:token" component={OrganizationJoinPage} />
      <Route path="/organization-dashboard" component={OrganizationDashboard} />
      <Route path="/team-chat" component={TeamChat} />
      <Route path="/final-da" component={FinalDa} />
      <Route path="/final-da/new" component={FinalDaEdit} />
      <Route path="/final-da/:id" component={FinalDaEdit} />
      <Route path="/port-benchmarking" component={PortBenchmarking} />
      <Route path="/email-inbox" component={EmailInbox} />
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
    <>
      <DemoBanner />
      <Switch>
        <Route path="/demo" component={DemoPage} />
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
    </>
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
          <DemoProvider>
            <TooltipProvider>
              <Toaster />
              <AppContent />
            </TooltipProvider>
          </DemoProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
