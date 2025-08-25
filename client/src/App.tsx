import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/header";
import Sidebar from "@/components/sidebar";
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
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto bg-neutral-50">
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
        </main>
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
