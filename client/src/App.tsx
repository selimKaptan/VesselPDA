import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
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
import Forum from "@/pages/forum";
import ForumTopic from "@/pages/forum-topic";
import Tenders from "@/pages/tenders";
import TenderDetail from "@/pages/tender-detail";
import DirectoryProfile from "@/pages/directory-profile";
import Contact from "@/pages/contact";
import VesselTrack from "@/pages/vessel-track";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
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
      <Route path="/forum" component={Forum} />
      <Route path="/forum/:id" component={ForumTopic} />
      <Route path="/tenders" component={Tenders} />
      <Route path="/tenders/:id" component={TenderDetail} />
      <Route path="/contact" component={Contact} />
      <Route path="/vessel-track" component={VesselTrack} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-3 border-b h-14 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <AuthenticatedRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function PublicDirectoryPage() {
  return (
    <Switch>
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
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
