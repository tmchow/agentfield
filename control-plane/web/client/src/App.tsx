import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { SidebarNew } from "./components/Navigation/SidebarNew";
import { TopNavigation } from "./components/Navigation/TopNavigation";
import { RootRedirect } from "./components/RootRedirect";
import { navigationSections } from "./config/navigation";
import { ModeProvider } from "./contexts/ModeContext";
import { ThemeProvider } from "./components/theme-provider";
import { useFocusManagement } from "./hooks/useFocusManagement";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { AllReasonersPage } from "./pages/AllReasonersPage.tsx";
import { EnhancedDashboardPage } from "./pages/EnhancedDashboardPage";
import { ExecutionsPage } from "./pages/ExecutionsPage";
import { EnhancedExecutionDetailPage } from "./pages/EnhancedExecutionDetailPage";
import { EnhancedWorkflowDetailPage } from "./pages/EnhancedWorkflowDetailPage";
import { NodeDetailPage } from "./pages/NodeDetailPage";
import { NodesPage } from "./pages/NodesPage";
import { ReasonerDetailPage } from "./pages/ReasonerDetailPage.tsx";
import { WorkflowsPage } from "./pages/WorkflowsPage.tsx";
import { ObservabilityWebhookSettingsPage } from "./pages/ObservabilityWebhookSettingsPage";
import { AuthProvider } from "./contexts/AuthContext";
import { AuthGuard } from "./components/AuthGuard";

// Placeholder pages for new routes

function AgentsPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          My Agents
        </h2>
        <p className="text-sm">
          Your configured and running agents
        </p>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          Settings
        </h2>
        <p className="text-sm">
          System configuration and preferences
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  // Use focus management hook to ensure trackpad navigation works
  useFocusManagement();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background text-foreground transition-colors">
        {/* Sidebar */}
        <SidebarNew sections={navigationSections} />

        {/* Main Content */}
        <SidebarInset>
          {/* Top Navigation */}
          <TopNavigation />

          {/* Main Content Area */}
          <main className="flex flex-1 min-w-0 flex-col overflow-y-auto overflow-x-hidden">
            <Routes>
              <Route path="/" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><RootRedirect /></div>} />
              <Route path="/dashboard" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><EnhancedDashboardPage /></div>} />
              <Route path="/nodes" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><NodesPage /></div>} />
              <Route path="/nodes/:nodeId" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><NodeDetailPage /></div>} />
              <Route path="/reasoners/all" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><AllReasonersPage /></div>} />
              <Route
                path="/reasoners/:fullReasonerId"
                element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><ReasonerDetailPage /></div>}
              />
              <Route path="/executions" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><ExecutionsPage /></div>} />
              <Route
                path="/executions/:executionId"
                element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><EnhancedExecutionDetailPage /></div>}
              />
              <Route path="/workflows" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><WorkflowsPage /></div>} />
              <Route
                path="/workflows/:workflowId"
                element={<EnhancedWorkflowDetailPage />}
              />
              <Route path="/settings" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><SettingsPage /></div>} />
              <Route path="/agents" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><AgentsPage /></div>} />
              <Route path="/settings/observability-webhook" element={<div className="p-4 md:p-6 lg:p-8 min-h-full"><ObservabilityWebhookSettingsPage /></div>} />
            </Routes>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ModeProvider>
        <AuthProvider>
          <AuthGuard>
            <Router basename={import.meta.env.VITE_BASE_PATH || "/ui"}>
              <AppContent />
            </Router>
          </AuthGuard>
        </AuthProvider>
      </ModeProvider>
    </ThemeProvider>
  );
}

export default App;
