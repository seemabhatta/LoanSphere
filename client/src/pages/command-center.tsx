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
    if (dashboardData && dashboardData.loan_metrics) {
      updateMetrics(dashboardData.loan_metrics);
      updateRecentActivity(dashboardData.recent_activity || []);
      updateDocumentProcessing(dashboardData.document_metrics || {});
    }
  }, [dashboardData, updateMetrics, updateRecentActivity, updateDocumentProcessing]);

  useEffect(() => {
    if (agentsData && agentsData.agents) {
      updateAgents(agentsData.agents);
    }
  }, [agentsData, updateAgents]);

  useEffect(() => {
    if (exceptionsData && exceptionsData.exceptions) {
      updateExceptions(exceptionsData.exceptions);
    }
  }, [exceptionsData, updateExceptions]);

  useEffect(() => {
    if (complianceData && complianceData.status) {
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
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header with Search */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          {/* Breadcrumb and Title */}
          <div>
            <div className="flex items-center caption-text mb-1">
              <span>Loan Boarding</span>
              <span className="mx-2">›</span>
              <span className="text-gray-900">Command Center</span>
            </div>
            <h1 className="page-title" data-testid="page-title">
              Co-Issue Boarding Pipeline
            </h1>
          </div>
          
          {/* Search and Actions */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search loans, documents, and more..."
                className="w-80 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              data-testid="button-refresh"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={handleBoardPackage}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-board-package"
            >
              Board Package
            </Button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex items-center space-x-8 mt-4">
          <a className="text-blue-600 border-b-2 border-blue-600 pb-2 text-sm font-medium">Overview</a>
          <a className="text-gray-500 hover:text-gray-700 pb-2 text-sm">Staging</a>
          <a className="text-gray-500 hover:text-gray-700 pb-2 text-sm">Processing</a>
          <a className="text-gray-500 hover:text-gray-700 pb-2 text-sm">Compliance</a>
          <a className="text-gray-500 hover:text-gray-700 pb-2 text-sm">Reports</a>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-6 bg-white">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">First-Pass Yield</div>
            <div className="text-2xl font-semibold text-gray-900">{metrics.fpy || 0}%</div>
            <div className="text-xs text-green-600">+2.1% vs last week</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">Time-to-Board</div>
            <div className="text-2xl font-semibold text-gray-900">{metrics.ttb || 0}h</div>
            <div className="text-xs text-green-600">-0.3h vs target</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">Auto-Clear Rate</div>
            <div className="text-2xl font-semibold text-gray-900">{metrics.auto_clear_rate || 0}%</div>
            <div className="text-xs text-green-600">+5.2% vs last month</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="text-sm text-gray-500">Open Exceptions</div>
            <div className="text-2xl font-semibold text-gray-900">{metrics.open_exceptions || 0}</div>
            <div className="text-xs text-orange-600">3 high priority</div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Agent Status Panel */}
          <div className="lg:col-span-1 bg-white border border-gray-200 rounded-lg">
            <AgentStatus agents={agents} />
          </div>

          {/* Pipeline Activity */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg">
            <PipelineActivity activity={recentActivity} />
          </div>
        </div>

        {/* Detailed Panels Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Current Exceptions */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <ExceptionsList exceptions={exceptions} />
          </div>

          {/* Compliance Status */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <ComplianceStatus status={complianceStatus} />
          </div>
        </div>

        {/* Document Processing Status */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <DocumentProcessing status={documentProcessing} />
        </div>
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
