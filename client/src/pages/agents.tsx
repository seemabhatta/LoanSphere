import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Zap,
  TrendingUp,
  BarChart3
} from "lucide-react";

export default function Agents() {
  const { data: agentsData } = useQuery({
    queryKey: ['/api/agents'],
    refetchInterval: 10000
  });

  const { data: statusSummary } = useQuery({
    queryKey: ['/api/agents/status/summary'],
    refetchInterval: 10000
  });

  const { data: performanceMetrics } = useQuery({
    queryKey: ['/api/agents/performance/metrics'],
    refetchInterval: 30000
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500 animate-pulse';
      case 'active':
        return 'bg-success';
      case 'error':
        return 'bg-error';
      case 'wait':
        return 'bg-warning';
      default:
        return 'bg-neutral-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'border-blue-500 text-blue-600 bg-blue-50';
      case 'active':
        return 'border-green-500 text-green-600 bg-green-50';
      case 'error':
        return 'border-red-500 text-red-600 bg-red-50';
      case 'wait':
        return 'border-yellow-500 text-yellow-600 bg-yellow-50';
      default:
        return 'border-gray-500 text-gray-600 bg-gray-50';
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'planner':
        return <Activity className="w-6 h-6" />;
      case 'tool':
        return <Zap className="w-6 h-6" />;
      case 'verifier':
        return <CheckCircle className="w-6 h-6" />;
      case 'document':
        return <BarChart3 className="w-6 h-6" />;
      default:
        return <Activity className="w-6 h-6" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Loan Boarding</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">AI Agents</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              AI Agents
            </h1>
            <p className="text-gray-500 mt-1">
              Monitor and manage multi-agent system
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-blue-100 text-blue-800" data-testid="total-agents">
              {statusSummary?.summary?.total_agents || 0} Agents Active
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Agent Status Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {Object.entries(statusSummary?.summary?.status_distribution || {}).map(([status, count]: [string, any]) => (
                <Card key={status}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="label-text text-neutral-500 capitalize">{status} Agents</p>
                        <p className="metric-large text-neutral-800 mt-2" data-testid={`status-count-${status}`}>
                          {count}
                        </p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`}></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Individual Agent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {agentsData?.agents?.map((agent: any) => (
                <Card key={agent.id} className="relative">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className={`w-4 h-4 rounded-full ${getStatusColor(agent.status)}`}></div>
                      <div className="flex-1">
                        <h3 className="font-medium text-neutral-800" data-testid={`agent-name-${agent.name.toLowerCase()}`}>
                          {agent.name}
                        </h3>
                        <p className="detail-text text-neutral-500 capitalize">{agent.type}</p>
                      </div>
                      <div className="text-neutral-400">
                        {getAgentIcon(agent.type)}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="body-text text-neutral-500">Status:</span>
                        <Badge 
                          className={`detail-text ${getStatusBadgeColor(agent.status)}`}
                          data-testid={`agent-status-${agent.name.toLowerCase()}`}
                        >
                          {agent.status.toUpperCase()}
                        </Badge>
                      </div>
                      
                      {agent.current_task && (
                        <div className="space-y-1">
                          <span className="body-text text-neutral-500">Current Task:</span>
                          <p className="detail-text text-neutral-700 break-words">
                            {agent.current_task}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex justify-between detail-text text-neutral-500">
                        <span>Tasks: {agent.tasks_completed || 0}</span>
                        <span>Errors: {agent.tasks_errored || 0}</span>
                      </div>
                      
                      {agent.last_activity && (
                        <div className="text-xs text-neutral-500">
                          Last Activity: {new Date(agent.last_activity).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                    
                    <p className="text-xs text-neutral-600 mt-3 pt-3 border-t border-neutral-100">
                      {agent.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Agent Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {performanceMetrics?.performance_metrics?.map((agent: any) => (
                    <div key={agent.name} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.current_status)}`}></div>
                          <h3 className="font-medium text-neutral-800">{agent.name}</h3>
                          <Badge variant="outline" className="text-xs capitalize">
                            {agent.type}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-neutral-800" data-testid={`success-rate-${agent.name.toLowerCase()}`}>
                            {agent.success_rate}%
                          </div>
                          <div className="text-xs text-neutral-500">Success Rate</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">{agent.tasks_completed}</div>
                          <div className="text-xs text-neutral-500">Completed</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-red-600">{agent.tasks_errored}</div>
                          <div className="text-xs text-neutral-500">Errors</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-neutral-600">{agent.total_tasks}</div>
                          <div className="text-xs text-neutral-500">Total</div>
                        </div>
                      </div>
                      
                      <Progress value={agent.success_rate} className="h-2" />
                    </div>
                  ))}
                  
                  {!performanceMetrics?.performance_metrics?.length && (
                    <div className="text-center py-8 text-neutral-500" data-testid="no-performance-data">
                      No performance data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Activity Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-neutral-500">
                  Agent activity logs coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
