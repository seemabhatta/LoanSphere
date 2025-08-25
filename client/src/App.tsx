import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Sidebar from "@/components/sidebar";
import TopHeader from "@/components/top-header";
import CommandCenter from "@/pages/command-center";
import PipelineMonitor from "@/pages/pipeline-monitor";
import Exceptions from "@/pages/exceptions";
import Documents from "@/pages/documents";
import Compliance from "@/pages/compliance";
import Agents from "@/pages/agents";
import Analytics from "@/pages/analytics";
import SimpleStaging from "@/pages/simple-staging";
import Scheduler from "@/pages/scheduler";
import NotFound from "@/pages/not-found";

function Router() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Header */}
      <TopHeader onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Main Content Panel */}
        <div className={`flex-1 p-4 transition-all duration-300 ${sidebarOpen ? 'ml-0' : 'ml-0'}`}>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <Switch>
              <Route path="/" component={CommandCenter} />
              <Route path="/pipeline" component={PipelineMonitor} />
              <Route path="/exceptions" component={Exceptions} />
              <Route path="/documents" component={Documents} />
              <Route path="/compliance" component={Compliance} />
              <Route path="/agents" component={Agents} />
              <Route path="/analytics" component={Analytics} />
              <Route path="/simple-staging" component={SimpleStaging} />
              <Route path="/scheduler" component={Scheduler} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </div>
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
