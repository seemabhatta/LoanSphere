import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/sidebar";
import TopHeader from "@/components/top-header";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import CommandCenter from "@/pages/command-center";
import AIAssistant from "@/pages/ai-assistant";
import PipelineMonitor from "@/pages/pipeline-monitor";
import DocProcessing from "@/pages/doc-processing";
import Exceptions from "@/pages/exceptions";
import Documents from "@/pages/documents";
import Compliance from "@/pages/compliance";
import Agents from "@/pages/agents";
import Analytics from "@/pages/analytics";
import AuditLog from "@/pages/audit-log";
import SimpleStaging from "@/pages/simple-staging";
import Scheduler from "@/pages/scheduler";
import SyntheticData from "@/pages/synthetic-data";
import Commitments from "@/pages/commitments";
import Loans from "@/pages/loans";
import PurchaseAdvices from "@/pages/purchase-advices";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Toggle between expanded (icons + labels) and collapsed (icons only)
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/">
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
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Home />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/profile">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Profile />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/ai-assistant">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <AIAssistant />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/command-center">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <CommandCenter />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/pipeline">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <PipelineMonitor />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/doc-processing">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <DocProcessing />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/exceptions">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Exceptions />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/documents">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Documents />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/compliance">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Compliance />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/agents">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Agents />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/analytics">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Analytics />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/audit-log">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <AuditLog />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/simple-staging">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <SimpleStaging />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/scheduler">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Scheduler />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/synthetic-data">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <SyntheticData />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/commitments">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Commitments />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/loans">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <Loans />
                  </div>
                </div>
              </div>
            </div>
          </Route>
          <Route path="/purchase-advices">
            <div className="h-screen flex flex-col bg-gray-100">
              <TopHeader onToggleSidebar={toggleSidebar} sidebarCollapsed={sidebarCollapsed} />
              <div className="flex-1 flex overflow-hidden">
                <Sidebar isOpen={true} onClose={() => {}} collapsed={sidebarCollapsed} />
                <div className="flex-1 p-4 transition-all duration-300 overflow-hidden">
                  <div className="bg-white rounded-lg shadow-sm h-full overflow-y-auto">
                    <PurchaseAdvices />
                  </div>
                </div>
              </div>
            </div>
          </Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
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
