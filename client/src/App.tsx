import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { AiChat } from "@/components/ai-chat";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
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
import PdaReview from "@/pages/pda-review";
import Sof from "@/pages/sof";
import SofDetail from "@/pages/sof-detail";
import Fda from "@/pages/fda";
import FdaDetail from "@/pages/fda-detail";
import Nor from "@/pages/nor";
import NorDetail from "@/pages/nor-detail";
import { LanguageProvider } from "@/lib/i18n";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import VerifyEmailPage from "@/pages/verify-email";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import DemoPage from "@/pages/demo";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";

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
      <Route path="/pda-review" component={PdaReview} />
      <Route path="/nor" component={Nor} />
      <Route path="/nor/:id" component={NorDetail} />
      <Route path="/sof" component={Sof} />
      <Route path="/sof/:id" component={SofDetail} />
      <Route path="/fda" component={Fda} />
      <Route path="/fda/:id" component={FdaDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  useSocket();
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
      <Route path="/demo" component={DemoPage} />
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

  const handleOnboardingDone = async () => {
    try {
      await apiRequest("PATCH", "/api/user/onboarding-complete", {});
    } catch { }
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  if (!(user as any).onboardingCompleted) {
    return (
      <>
        <AuthenticatedLayout />
        <AiChat />
        <OnboardingWizard
          user={user}
          onComplete={handleOnboardingDone}
          onSkip={handleOnboardingDone}
        />
      </>
    );
  }

  return (
    <>
      <AuthenticatedLayout />
      <AiChat />
    </>
  );
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
