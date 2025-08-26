import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/sidebar";
import TopHeader from "@/components/top-header";
import RightPanelAssistant from "@/components/right-panel-assistant";
import CommandCenter from "@/pages/command-center";
import AIAssistant from "@/pages/ai-assistant";
import PipelineMonitor from "@/pages/pipeline-monitor";
import DocProcessing from "@/pages/doc-processing";
import Exceptions from "@/pages/exceptions";
import Documents from "@/pages/documents";
import Compliance from "@/pages/compliance";
import Agents from "@/pages/agents";
import Analytics from "@/pages/analytics";
import SimpleStaging from "@/pages/simple-staging";
import Scheduler from "@/pages/scheduler";
import Commitments from "@/pages/commitments";
import Loans from "@/pages/loans";
import PurchaseAdvices from "@/pages/purchase-advices";
import NotFound from "@/pages/not-found";

function Router() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assistantExpanded, setAssistantExpanded] = useState(false);
  const [location] = useLocation();

  // Toggle between expanded (icons + labels) and collapsed (icons only)
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleAssistant = () => {
    setAssistantExpanded(!assistantExpanded);
  };

  // Get current page name for context
  const getCurrentPageName = (path: string): string => {
    const routes: { [key: string]: string } = {
      '/': 'Assistant',
      '/command-center': 'Command Center',
      '/exceptions': 'Exceptions',
      '/analytics': 'Analytics',
      '/pipeline': 'Pipeline',
      '/doc-processing': 'Document Processing',
      '/simple-staging': 'Stage',
      '/agents': 'Agents',
      '/compliance': 'Compliance',
      '/documents': 'Documents',
      '/scheduler': 'Scheduler',
      '/commitments': 'Commitments',
      '/loans': 'Loans',
      '/purchase-advices': 'Purchase Advices'
    };
    return routes[path] || 'Xpanse Loan Xchange';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Header */}
      <TopHeader 
        onToggleSidebar={toggleSidebar}
        sidebarCollapsed={sidebarCollapsed}
      />
      
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          isOpen={true} 
          onClose={() => {}}
          collapsed={sidebarCollapsed}
        />
        
        {/* Main Content Panel */}
        <div className={`flex-1 p-4 transition-all duration-300 overflow-hidden ${
          assistantExpanded ? 'pr-96' : 'pr-12'
        }`}>
          <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
            <Switch>
              <Route path="/" component={AIAssistant} />
              <Route path="/command-center" component={CommandCenter} />
              <Route path="/pipeline" component={PipelineMonitor} />
              <Route path="/doc-processing" component={DocProcessing} />
              <Route path="/exceptions" component={Exceptions} />
              <Route path="/documents" component={Documents} />
              <Route path="/compliance" component={Compliance} />
              <Route path="/agents" component={Agents} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/simple-staging" component={SimpleStaging} />
              <Route path="/scheduler" component={Scheduler} />
              <Route path="/commitments" component={Commitments} />
              <Route path="/loans" component={Loans} />
              <Route path="/purchase-advices" component={PurchaseAdvices} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </div>
        
        {/* Right Panel Assistant */}
        <RightPanelAssistant 
          currentPage={getCurrentPageName(location)}
          isExpanded={assistantExpanded}
          onToggle={toggleAssistant}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
