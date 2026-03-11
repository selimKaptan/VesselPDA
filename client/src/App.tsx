import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useSocket } from "@/hooks/use-socket";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { apiRequest } from "@/lib/queryClient";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/i18n";
import { SidebarStateProvider } from "@/lib/sidebar-context";

const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/landing"));
const RoleSelection = lazy(() => import("@/pages/role-selection"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Vessels = lazy(() => import("@/pages/vessels"));
const Ports = lazy(() => import("@/pages/ports"));
const PortCalls = lazy(() => import("@/pages/port-calls"));
const PortCallDetail = lazy(() => import("@/pages/port-call-detail"));
const Proformas = lazy(() => import("@/pages/proformas"));
const ProformaNew = lazy(() => import("@/pages/proforma-new"));
const ProformaView = lazy(() => import("@/pages/proforma-view"));
const Pricing = lazy(() => import("@/pages/pricing"));
const Directory = lazy(() => import("@/pages/directory"));
const CompanyProfile = lazy(() => import("@/pages/company-profile"));
const ServicePorts = lazy(() => import("@/pages/service-ports"));
const AdminPanel = lazy(() => import("@/pages/admin"));
const TariffManagement = lazy(() => import("@/pages/tariff-management"));
const Forum = lazy(() => import("@/pages/forum"));
const ForumTopic = lazy(() => import("@/pages/forum-topic"));
const Tenders = lazy(() => import("@/pages/tenders"));
const TenderDetail = lazy(() => import("@/pages/tender-detail"));
const DirectoryProfile = lazy(() => import("@/pages/directory-profile"));
const Contact = lazy(() => import("@/pages/contact"));
const VesselTrack = lazy(() => import("@/pages/vessel-track"));
const VesselReport = lazy(() => import("@/pages/vessel-report"));
const VesselSchedule = lazy(() => import("@/pages/vessel-schedule"));
const PortInfo = lazy(() => import("@/pages/port-info"));
const Settings = lazy(() => import("@/pages/settings"));
const Voyages = lazy(() => import("@/pages/voyages"));
const VoyageDetail = lazy(() => import("@/pages/voyage-detail"));
const VoyageWorkflow = lazy(() => import("@/pages/voyage-workflow"));
const VoyageInvitations = lazy(() => import("@/pages/voyage-invitations"));
const ServiceRequests = lazy(() => import("@/pages/service-requests"));
const ServiceRequestDetail = lazy(() => import("@/pages/service-request-detail"));
const Messages = lazy(() => import("@/pages/messages"));
const MessageThread = lazy(() => import("@/pages/message-thread"));
const Nominations = lazy(() => import("@/pages/nominations"));
const SanctionsCheck = lazy(() => import("@/pages/sanctions-check"));
const VesselCertificates = lazy(() => import("@/pages/vessel-certificates"));
const VesselQ88 = lazy(() => import("@/pages/vessel-q88"));
const VesselVault = lazy(() => import("@/pages/vessel-vault"));
const Fixtures = lazy(() => import("@/pages/fixtures"));
const CargoPositions = lazy(() => import("@/pages/cargo-positions"));
const MarketData = lazy(() => import("@/pages/market-data"));
const Invoices = lazy(() => import("@/pages/invoices"));
const ActionCenter = lazy(() => import("@/pages/actions"));
const PdaReview = lazy(() => import("@/pages/pda-review"));
const Sof = lazy(() => import("@/pages/sof"));
const SofDetail = lazy(() => import("@/pages/sof-detail"));
const Fda = lazy(() => import("@/pages/fda"));
const FdaDetail = lazy(() => import("@/pages/fda-detail"));
const Nor = lazy(() => import("@/pages/nor"));
const NorDetail = lazy(() => import("@/pages/nor-detail"));
const DaComparison = lazy(() => import("@/pages/da-comparison"));
const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));
const VerifyEmailPage = lazy(() => import("@/pages/verify-email"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const DemoPage = lazy(() => import("@/pages/demo"));
const Team = lazy(() => import("@/pages/team"));
const AiSmartDropPage = lazy(() => import("@/pages/ai-smart-drop"));
const CrewRoster = lazy(() => import("@/pages/crew-roster"));
const LaytimeCalculator = lazy(() => import("@/pages/laytime-calculator"));
const DaAdvances = lazy(() => import("@/pages/da-advances"));
const Analytics = lazy(() => import("@/pages/analytics"));
const PortExpenses = lazy(() => import("@/pages/port-expenses"));
const Maintenance = lazy(() => import("@/pages/maintenance"));
const PMS = lazy(() => import("@/pages/pms"));
const BunkerManagement = lazy(() => import("@/pages/bunker-management"));
const NoonReports = lazy(() => import("@/pages/noon-reports"));
const CharterParties = lazy(() => import("@/pages/charter-parties"));
const Husbandry = lazy(() => import("@/pages/husbandry"));
const AgentReport = lazy(() => import("@/pages/agent-report"));
const Environmental = lazy(() => import("@/pages/environmental"));
const Insurance = lazy(() => import("@/pages/insurance"));
const Drydock = lazy(() => import("@/pages/drydock"));
const DefectTracker = lazy(() => import("@/pages/defect-tracker"));
const SpareParts = lazy(() => import("@/pages/spare-parts"));
const VoyageEstimation = lazy(() => import("@/pages/voyage-estimation"));
const OrderBook = lazy(() => import("@/pages/order-book"));
const BrokerCommissions = lazy(() => import("@/pages/broker-commissions"));
const Contacts = lazy(() => import("@/pages/contacts"));
const PassagePlanning = lazy(() => import("@/pages/passage-planning"));
const VesselLookup = lazy(() => import("@/pages/vessel-lookup"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const CrewDocSettings = lazy(() => import("@/pages/crew-doc-settings"));
const AgentReports = lazy(() => import("@/pages/agent-reports"));
const CargoOps = lazy(() => import("@/pages/cargo-ops"));
const VoyagePnl = lazy(() => import("@/pages/voyage-pnl"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="space-y-3 w-full max-w-sm px-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}

function AuthenticatedRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/vessels" component={Vessels} />
        <Route path="/ports" component={Ports} />
        <Route path="/port-calls" component={PortCalls} />
        <Route path="/port-calls/:id" component={PortCallDetail} />
        <Route path="/proformas" component={Proformas} />
        <Route path="/proformas/new" component={ProformaNew} />
        <Route path="/proformas/:id" component={ProformaView} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/directory" component={Directory} />
        <Route path="/directory/:id" component={DirectoryProfile} />
        <Route path="/company-profile" component={CompanyProfile} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/tariff-management" component={TariffManagement} />
        <Route path="/forum" component={Forum} />
        <Route path="/forum/:id" component={ForumTopic} />
        <Route path="/tenders" component={Tenders} />
        <Route path="/tenders/:id" component={TenderDetail} />
        <Route path="/vessel-track" component={VesselTrack} />
        <Route path="/vessel-lookup" component={VesselLookup} />
        <Route path="/vessel-lookup/:imo" component={VesselLookup} />
        <Route path="/vessel-report/:imo" component={VesselReport} />
        <Route path="/vessel-schedule" component={VesselSchedule} />
        <Route path="/port-info" component={PortInfo} />
        <Route path="/settings" component={Settings} />
        <Route path="/voyages" component={Voyages} />
        <Route path="/voyages/:id" component={VoyageDetail} />
        <Route path="/voyages/:id/pnl" component={VoyagePnl} />
        <Route path="/voyage-workflow/:id" component={VoyageWorkflow} />
        <Route path="/service-requests" component={ServiceRequests} />
        <Route path="/service-requests/:id" component={ServiceRequestDetail} />
        <Route path="/messages" component={Messages} />
        <Route path="/messages/:id" component={MessageThread} />
        <Route path="/voyage-invitations" component={VoyageInvitations} />
        <Route path="/nominations" component={Nominations} />
        <Route path="/sanctions-check" component={SanctionsCheck} />
        <Route path="/vessel-certificates" component={VesselCertificates} />
        <Route path="/vessel-q88/:vesselId" component={VesselQ88} />
        <Route path="/vessel-vault/:vesselId" component={VesselVault} />
        <Route path="/fixtures" component={Fixtures} />
        <Route path="/cargo-positions" component={CargoPositions} />
        <Route path="/market-data" component={MarketData} />
        <Route path="/invoices" component={Invoices} />
        <Route path="/actions" component={ActionCenter} />
        <Route path="/pda-review" component={PdaReview} />
        <Route path="/nor" component={Nor} />
        <Route path="/nor/:id" component={NorDetail} />
        <Route path="/sof" component={Sof} />
        <Route path="/sof/:id" component={SofDetail} />
        <Route path="/fda" component={Fda} />
        <Route path="/fda/:id" component={FdaDetail} />
        <Route path="/da-comparison" component={DaComparison} />
        <Route path="/da-comparison/:proformaId" component={DaComparison} />
        <Route path="/team" component={Team} />
        <Route path="/ai-smart-drop" component={AiSmartDropPage} />
        <Route path="/crew-roster" component={CrewRoster} />
        <Route path="/laytime-calculator" component={LaytimeCalculator} />
        <Route path="/da-advances" component={DaAdvances} />
        <Route path="/port-expenses" component={PortExpenses} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/maintenance" component={Maintenance} />
        <Route path="/pms" component={PMS} />
        <Route path="/bunker-management" component={BunkerManagement} />
        <Route path="/noon-reports" component={NoonReports} />
        <Route path="/charter-parties" component={CharterParties} />
        <Route path="/husbandry" component={Husbandry} />
        <Route path="/agent-report/:voyageId" component={AgentReport} />
        <Route path="/agent-reports" component={AgentReports} />
        <Route path="/cargo-ops" component={CargoOps} />
        <Route path="/environmental" component={Environmental} />
        <Route path="/insurance" component={Insurance} />
        <Route path="/drydock" component={Drydock} />
        <Route path="/defect-tracker" component={DefectTracker} />
        <Route path="/spare-parts" component={SpareParts} />
        <Route path="/voyage-estimation" component={VoyageEstimation} />
        <Route path="/order-book" component={OrderBook} />
        <Route path="/broker-commissions" component={BrokerCommissions} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/passage-planning" component={PassagePlanning} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/crew-doc-settings" component={CrewDocSettings} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
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
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
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
    return (
      <Suspense fallback={<PageLoader />}>
        <RoleSelection />
      </Suspense>
    );
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
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <SidebarStateProvider>
            <TooltipProvider>
              <Toaster />
              <AppContent />
            </TooltipProvider>
          </SidebarStateProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
