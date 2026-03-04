import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { guardRoute } from "@/components/protected-route";
import UnauthorizedPage from "@/pages/unauthorized";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { DemoProvider } from "@/contexts/demo-context";
import { DemoBanner } from "@/components/demo-banner";
import { LanguageProvider } from "@/lib/i18n";

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
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import VerifyEmailPage from "@/pages/verify-email";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/"                       component={Dashboard} />
      <Route path="/dashboard"              component={Dashboard} />
      <Route path="/pricing"                component={Pricing} />
      <Route path="/directory"              component={Directory} />
      <Route path="/directory/:id"          component={DirectoryProfile} />
      <Route path="/company-profile"        component={CompanyProfile} />
      <Route path="/forum"                  component={Forum} />
      <Route path="/forum/:id"              component={ForumTopic} />
      <Route path="/tenders"                component={Tenders} />
      <Route path="/tenders/:id"            component={TenderDetail} />
      <Route path="/contact"                component={Contact} />
      <Route path="/settings"               component={Settings} />
      <Route path="/messages"               component={Messages} />
      <Route path="/messages/:id"           component={MessageThread} />
      <Route path="/organization"           component={OrganizationPage} />
      <Route path="/organization-select"    component={OrganizationSelectPage} />
      <Route path="/organization/join/:token" component={OrganizationJoinPage} />
      <Route path="/organization-dashboard" component={OrganizationDashboard} />
      <Route path="/team-chat"              component={TeamChat} />
      <Route path="/reports"                component={Reports} />
      <Route path="/invoices"               component={guardRoute(Invoices, "/invoices")} />
      <Route path="/ports"                  component={Ports} />
      <Route path="/maritime-docs/:id"      component={MaritimeDocView} />

      <Route path="/vessels"                component={guardRoute(Vessels,           "/vessels")} />
      <Route path="/voyages"                component={guardRoute(Voyages,           "/voyages")} />
      <Route path="/voyages/:id"            component={guardRoute(VoyageDetail,      "/voyages")} />
      <Route path="/proformas"              component={guardRoute(Proformas,         "/proformas")} />
      <Route path="/proformas/new"          component={guardRoute(ProformaNew,       "/proformas")} />
      <Route path="/proformas/:id"          component={guardRoute(ProformaView,      "/proformas")} />
      <Route path="/port-info"              component={guardRoute(PortInfo,          "/port-info")} />
      <Route path="/vessel-track"           component={guardRoute(VesselTrack,       "/vessel-track")} />
      <Route path="/vessel-certificates"    component={guardRoute(VesselCertificates,"/vessel-certificates")} />
      <Route path="/compliance"             component={guardRoute(Compliance,        "/compliance")} />
      <Route path="/compliance/:checklistId" component={guardRoute(Compliance,       "/compliance")} />
      <Route path="/nominations"            component={guardRoute(Nominations,       "/nominations")} />
      <Route path="/sanctions-check"        component={guardRoute(SanctionsCheck,    "/sanctions-check")} />
      <Route path="/market-data"            component={guardRoute(MarketData,        "/market-data")} />
      <Route path="/port-benchmarking"      component={guardRoute(PortBenchmarking,  "/port-benchmarking")} />
      <Route path="/email-inbox"            component={guardRoute(EmailInbox,        "/email-inbox")} />
      <Route path="/service-requests"       component={guardRoute(ServiceRequests,   "/service-requests")} />
      <Route path="/service-requests/:id"   component={guardRoute(ServiceRequestDetail, "/service-requests")} />

      <Route path="/final-da"               component={guardRoute(FinalDa,           "/final-da")} />
      <Route path="/final-da/new"           component={guardRoute(FinalDaEdit,       "/final-da")} />
      <Route path="/final-da/:id"           component={guardRoute(FinalDaEdit,       "/final-da")} />

      <Route path="/bunker-management"      component={guardRoute(BunkerManagement,  "/bunker-management")} />
      <Route path="/fixtures"               component={guardRoute(Fixtures,          "/fixtures")} />
      <Route path="/cargo-positions"        component={guardRoute(CargoPositions,    "/cargo-positions")} />

      <Route path="/service-ports"          component={guardRoute(ServicePorts,      "/service-ports")} />

      <Route path="/admin"                  component={guardRoute(AdminPanel,        "/admin")} />
      <Route path="/tariff-management"      component={guardRoute(TariffManagement,  "/tariff-management")} />

      <Route path="/unauthorized"           component={UnauthorizedPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  return (
    <AppLayout>
      <ErrorBoundary>
        <AuthenticatedRouter />
      </ErrorBoundary>
    </AppLayout>
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

  if (!user) return <PublicDirectoryPage />;
  if (!(user as any).roleConfirmed) return <RoleSelection />;

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
