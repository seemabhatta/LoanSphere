import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Play, Pause, AlertCircle } from "lucide-react";

export default function PipelineMonitor() {
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);

  const { data: loansData, refetch: refetchLoans } = useQuery({
    queryKey: ['/api/loans'],
    refetchInterval: 10000
  });

  const { data: activityData } = useQuery({
    queryKey: ['/api/loans/activity/recent', { limit: 20 }],
    refetchInterval: 5000
  });

  const { data: agentsData } = useQuery({
    queryKey: ['/api/agents/status/summary'],
    refetchInterval: 10000
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'boarding_in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500 animate-pulse';
      case 'active':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'wait':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium text-neutral-800" data-testid="page-title">
              Pipeline Monitor
            </h2>
            <p className="text-neutral-500 mt-1">
              Monitor loan processing pipeline in real-time
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                refetchLoans();
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="loans" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="loans" data-testid="tab-loans">Loans</TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-agents">Agents</TabsTrigger>
            <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="loans" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Loans in Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loansData?.loans?.map((loan: any) => (
                    <div 
                      key={loan.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedLoan === loan.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedLoan(loan.id)}
                      data-testid={`loan-item-${loan.xp_loan_number}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-neutral-800">
                            {loan.xp_loan_number}
                          </h3>
                          <p className="text-sm text-neutral-500">
                            {loan.seller_name}
                          </p>
                        </div>
                        <Badge 
                          className={getStatusColor(loan.status)}
                          data-testid={`status-${loan.xp_loan_number}`}
                        >
                          {loan.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-neutral-500">Amount:</span>
                          <span className="ml-2 font-mono">
                            ${loan.note_amount ? Number(loan.note_amount).toLocaleString() : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Rate:</span>
                          <span className="ml-2 font-mono">
                            {loan.interest_rate ? `${(Number(loan.interest_rate) * 100).toFixed(3)}%` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500">LTV:</span>
                          <span className="ml-2 font-mono">
                            {loan.ltv_ratio ? `${(Number(loan.ltv_ratio) * 100).toFixed(1)}%` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Credit:</span>
                          <span className="ml-2 font-mono">
                            {loan.credit_score || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {!loansData?.loans?.length && (
                    <div className="text-center py-8 text-neutral-500" data-testid="no-loans">
                      No loans currently in pipeline
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {agentsData?.agents?.map((agent: any) => (
                    <div 
                      key={agent.name}
                      className="p-4 border rounded-lg"
                      data-testid={`agent-${agent.name.toLowerCase()}`}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`w-3 h-3 rounded-full ${getAgentStatusColor(agent.status)}`}></div>
                        <div>
                          <h3 className="font-medium text-neutral-800">{agent.name}</h3>
                          <p className="text-xs text-neutral-500 capitalize">{agent.type}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Status:</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              agent.status === 'running' ? 'border-blue-500 text-blue-600' :
                              agent.status === 'active' ? 'border-green-500 text-green-600' :
                              agent.status === 'error' ? 'border-red-500 text-red-600' :
                              'border-gray-300 text-gray-600'
                            }`}
                          >
                            {agent.status.toUpperCase()}
                          </Badge>
                        </div>
                        
                        {agent.current_task && (
                          <div>
                            <span className="text-neutral-500">Task:</span>
                            <p className="text-xs mt-1 text-neutral-700">
                              {agent.current_task}
                            </p>
                          </div>
                        )}
                        
                        {agent.last_activity && (
                          <div className="flex justify-between">
                            <span className="text-neutral-500">Last Activity:</span>
                            <span className="text-xs text-neutral-600">
                              {new Date(agent.last_activity).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Pipeline Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityData?.activity?.map((activity: any, index: number) => (
                    <div 
                      key={activity.id || index}
                      className="flex items-center space-x-4 p-3 border rounded-lg"
                      data-testid={`activity-${index}`}
                    >
                      <span className="text-xs text-neutral-400 font-mono min-w-[80px]">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                      
                      <span className={`w-2 h-2 rounded-full ${
                        activity.status === 'SUCCESS' ? 'bg-green-500' :
                        activity.status === 'ERROR' ? 'bg-red-500' :
                        activity.status === 'RUNNING' ? 'bg-blue-500' :
                        'bg-gray-400'
                      }`}></span>
                      
                      <span className="flex-1 text-sm text-neutral-700">
                        {activity.message}
                      </span>
                      
                      {activity.xp_loan_number && (
                        <span className="text-xs font-mono text-neutral-500">
                          {activity.xp_loan_number}
                        </span>
                      )}
                      
                      <Badge 
                        variant="outline"
                        className={`text-xs ${
                          activity.status === 'SUCCESS' ? 'border-green-500 text-green-600' :
                          activity.status === 'ERROR' ? 'border-red-500 text-red-600' :
                          activity.status === 'RUNNING' ? 'border-blue-500 text-blue-600' :
                          'border-gray-300 text-gray-600'
                        }`}
                      >
                        {activity.status}
                      </Badge>
                    </div>
                  ))}
                  
                  {!activityData?.activity?.length && (
                    <div className="text-center py-8 text-neutral-500" data-testid="no-activity">
                      No recent pipeline activity
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
