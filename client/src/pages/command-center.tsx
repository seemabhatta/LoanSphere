import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDashboardStore } from "@/stores/dashboard-store";
import { apiRequest } from "@/lib/api";
import { connectWebSocket } from "@/lib/websocket";
import MetricCard from "@/components/metric-card";
import AgentStatus from "@/components/agent-status";
import PipelineActivity from "@/components/pipeline-activity";
import ExceptionsList from "@/components/exceptions-list";
import ComplianceStatus from "@/components/compliance-status";
import DocumentProcessing from "@/components/document-processing";
import ExceptionDetailModal from "@/components/exception-detail-modal";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw } from "lucide-react";

export default function CommandCenter() {
  const { 
    metrics, 
    agents, 
    recentActivity, 
    exceptions, 
    complianceStatus, 
    documentProcessing,
    selectedExceptionId,
    systemStatus,
    updateMetrics, 
    updateAgents, 
    updateRecentActivity,
    updateExceptions,
    updateComplianceStatus,
    updateDocumentProcessing,
    setSystemStatus
  } = useDashboardStore();

  // Fetch dashboard data
  const { data: dashboardData, refetch } = useQuery({
    queryKey: ['/api/metrics/dashboard'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: agentsData } = useQuery({
    queryKey: ['/api/agents/status/summary'],
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const { data: exceptionsData } = useQuery({
    queryKey: ['/api/exceptions', { status: 'open', limit: 5 }],
    refetchInterval: 15000
  });

  const { data: complianceData } = useQuery({
    queryKey: ['/api/compliance/dashboard/summary'],
    refetchInterval: 60000 // Refresh every minute
  });

  // Update store when data changes
  useEffect(() => {
    if (dashboardData) {
      updateMetrics(dashboardData.loan_metrics);
      updateRecentActivity(dashboardData.recent_activity);
      updateDocumentProcessing(dashboardData.document_metrics);
    }
  }, [dashboardData, updateMetrics, updateRecentActivity, updateDocumentProcessing]);

  useEffect(() => {
    if (agentsData) {
      updateAgents(agentsData.agents);
    }
  }, [agentsData, updateAgents]);

  useEffect(() => {
    if (exceptionsData) {
      updateExceptions(exceptionsData.exceptions);
    }
  }, [exceptionsData, updateExceptions]);

  useEffect(() => {
    if (complianceData) {
      updateComplianceStatus(complianceData.status);
    }
  }, [complianceData, updateComplianceStatus]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = connectWebSocket();
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'agent_status_update') {
        // Update specific agent status
        updateAgents(agents.map(agent => 
          agent.name === data.agent ? { ...agent, ...data.data } : agent
        ));
      } else if (data.type === 'pipeline_activity') {
        // Add new activity to the list
        updateRecentActivity([data.data, ...recentActivity.slice(0, 9)]);
      }
    };

    return () => ws.close();
  }, [agents, recentActivity, updateAgents, updateRecentActivity]);

  const handleBoardPackage = async () => {
    try {
      // This would trigger a new loan boarding process
      await apiRequest('POST', '/api/loans/XP12345678/board');
      refetch();
    } catch (error) {
      console.error('Error starting boarding process:', error);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium text-neutral-800" data-testid="page-title">
              Command Center
            </h2>
            <p className="text-neutral-500 mt-1">
              Real-time loan boarding pipeline monitoring
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2" data-testid="system-status">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                systemStatus === 'operational' ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className={`text-sm font-medium ${
                systemStatus === 'operational' ? 'text-green-600' : 'text-red-600'
              }`}>
                System {systemStatus === 'operational' ? 'Operational' : 'Down'}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleBoardPackage}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-board-package"
            >
              <Play className="w-4 h-4 mr-2" />
              Board Package
            </Button>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="First-Pass Yield"
            value={`${metrics.fpy}%`}
            trend="+2.1% vs last week"
            trendType="positive"
            icon="check-circle"
            testId="metric-fpy"
          />
          <MetricCard
            title="Time-to-Board"
            value={`${metrics.ttb}h`}
            trend="-0.3h vs target"
            trendType="positive"
            icon="clock"
            testId="metric-ttb"
          />
          <MetricCard
            title="Auto-Clear Rate"
            value={`${metrics.auto_clear_rate}%`}
            trend="+5.2% vs last month"
            trendType="positive"
            icon="zap"
            testId="metric-autoclear"
          />
          <MetricCard
            title="Open Exceptions"
            value={metrics.open_exceptions.toString()}
            trend="3 high priority"
            trendType="warning"
            icon="alert-triangle"
            testId="metric-exceptions"
          />
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Agent Status Panel */}
          <div className="lg:col-span-1">
            <AgentStatus agents={agents} />
          </div>

          {/* Pipeline Activity */}
          <div className="lg:col-span-2">
            <PipelineActivity activity={recentActivity} />
          </div>
        </div>

        {/* Detailed Panels Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Current Exceptions */}
          <ExceptionsList exceptions={exceptions} />

          {/* Compliance Status */}
          <ComplianceStatus status={complianceStatus} />
        </div>

        {/* Document Processing Status */}
        <DocumentProcessing status={documentProcessing} />
      </main>

      {/* Exception Detail Modal */}
      {selectedExceptionId && (
        <ExceptionDetailModal 
          exceptionId={selectedExceptionId}
          isOpen={!!selectedExceptionId}
        />
      )}
    </div>
  );
}
