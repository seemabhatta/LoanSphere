import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Play, Pause, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";

export default function PipelineMonitor() {
  const [selectedLoan, setSelectedLoan] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: loansData, refetch: refetchLoans } = useQuery({
    queryKey: ['/api/staging/tracking'],
    queryFn: async () => {
      const response = await fetch('/api/staging/tracking');
      if (!response.ok) {
        throw new Error('Failed to fetch loan tracking data');
      }
      return response.json();
    },
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
      case 'ReadyToBoard':
        return 'bg-green-100 text-green-800';
      case 'CommitmentLinked':
        return 'bg-blue-100 text-blue-800';
      case 'PurchaseAdviceReceived':
        return 'bg-purple-100 text-purple-800';
      case 'DataReceived':
        return 'bg-yellow-100 text-yellow-800';
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedLoans = loansData?.records ? [...loansData.records].sort((a: any, b: any) => {
    if (!sortField) return 0;

    let aValue = '';
    let bValue = '';

    switch (sortField) {
      case 'xpLoanNumber':
        aValue = a.xpLoanNumber || '';
        bValue = b.xpLoanNumber || '';
        break;
      case 'commitment':
        aValue = a.externalIds?.commitmentId ? 'received' : 'pending';
        bValue = b.externalIds?.commitmentId ? 'received' : 'pending';
        break;
      case 'purchaseAdvice':
        aValue = a.externalIds?.purchaseAdviceId ? 'received' : 'pending';
        bValue = b.externalIds?.purchaseAdviceId ? 'received' : 'pending';
        break;
      case 'loanData':
        aValue = a.metaData?.['loan_data'] ? 'received' : 'pending';
        bValue = b.metaData?.['loan_data'] ? 'received' : 'pending';
        break;
      case 'documents':
        aValue = Object.keys(a.metaData || {}).length > 0 ? 'received' : 'pending';
        bValue = Object.keys(b.metaData || {}).length > 0 ? 'received' : 'pending';
        break;
    }

    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  }) : [];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Loan Boarding</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Pipeline Monitor</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              Pipeline Monitor
            </h1>
            <p className="text-gray-500 mt-1">
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
              <CardContent className="pt-6">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-neutral-700">
                          <button 
                            className="flex items-center space-x-1 hover:text-neutral-900"
                            onClick={() => handleSort('xpLoanNumber')}
                            data-testid="sort-loan-number"
                          >
                            <span>Loan Number</span>
                            {sortField === 'xpLoanNumber' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-neutral-700">
                          <button 
                            className="flex items-center space-x-1 hover:text-neutral-900"
                            onClick={() => handleSort('commitment')}
                            data-testid="sort-commitment"
                          >
                            <span>Commitment</span>
                            {sortField === 'commitment' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-neutral-700">
                          <button 
                            className="flex items-center space-x-1 hover:text-neutral-900"
                            onClick={() => handleSort('purchaseAdvice')}
                            data-testid="sort-purchase-advice"
                          >
                            <span>Purchase Advice</span>
                            {sortField === 'purchaseAdvice' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-neutral-700">
                          <button 
                            className="flex items-center space-x-1 hover:text-neutral-900"
                            onClick={() => handleSort('loanData')}
                            data-testid="sort-loan-data"
                          >
                            <span>Loan Data</span>
                            {sortField === 'loanData' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-neutral-700">
                          <button 
                            className="flex items-center space-x-1 hover:text-neutral-900"
                            onClick={() => handleSort('documents')}
                            data-testid="sort-documents"
                          >
                            <span>Documents</span>
                            {sortField === 'documents' && (
                              sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLoans?.map((record: any) => (
                        <tr 
                          key={record.xpLoanNumber}
                          className="border-b hover:bg-gray-50 transition-colors"
                          data-testid={`loan-row-${record.xpLoanNumber}`}
                        >
                          <td className="py-3 px-4 font-mono text-sm">
                            {record.xpLoanNumber || 'N/A'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant={record.externalIds?.commitmentId ? 'default' : 'outline'}
                              className={`${record.externalIds?.commitmentId ? 'bg-green-100 text-green-800' : 'text-gray-500'}`}
                              data-testid={`commitment-status-${record.xpLoanNumber}`}
                            >
                              {record.externalIds?.commitmentId ? 'Received' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant={record.externalIds?.purchaseAdviceId ? 'default' : 'outline'}
                              className={`${record.externalIds?.purchaseAdviceId ? 'bg-green-100 text-green-800' : 'text-gray-500'}`}
                              data-testid={`purchase-advice-status-${record.xpLoanNumber}`}
                            >
                              {record.externalIds?.purchaseAdviceId ? 'Received' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant={record.metaData?.['loan_data'] ? 'default' : 'outline'}
                              className={`${record.metaData?.['loan_data'] ? 'bg-green-100 text-green-800' : 'text-gray-500'}`}
                              data-testid={`loan-data-status-${record.xpLoanNumber}`}
                            >
                              {record.metaData?.['loan_data'] ? 'Received' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge 
                              variant={Object.keys(record.metaData || {}).length > 0 ? 'default' : 'outline'}
                              className={`${Object.keys(record.metaData || {}).length > 0 ? 'bg-green-100 text-green-800' : 'text-gray-500'}`}
                              data-testid={`documents-status-${record.xpLoanNumber}`}
                            >
                              {Object.keys(record.metaData || {}).length > 0 ? 'Received' : 'Pending'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {!loansData?.records?.length && (
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
                <CardTitle className="section-header">Agent Status</CardTitle>
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
                          <h3 className="section-header text-neutral-800">{agent.name}</h3>
                          <p className="detail-text text-neutral-500 capitalize">{agent.type}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 body-text">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Status:</span>
                          <Badge 
                            variant="outline" 
                            className={`detail-text ${
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
                            <span className="label-text text-neutral-500">Task:</span>
                            <p className="detail-text mt-1 text-neutral-700">
                              {agent.current_task}
                            </p>
                          </div>
                        )}
                        
                        {agent.last_activity && (
                          <div className="flex justify-between">
                            <span className="label-text text-neutral-500">Last Activity:</span>
                            <span className="detail-text text-neutral-600">
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
                <CardTitle className="section-header">Recent Pipeline Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activityData?.activity?.map((activity: any, index: number) => (
                    <div 
                      key={activity.id || index}
                      className="flex items-center space-x-4 p-3 border rounded-lg"
                      data-testid={`activity-${index}`}
                    >
                      <span className="code-text text-neutral-400 min-w-[80px]">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                      
                      <span className={`w-2 h-2 rounded-full ${
                        activity.status === 'SUCCESS' ? 'bg-green-500' :
                        activity.status === 'ERROR' ? 'bg-red-500' :
                        activity.status === 'RUNNING' ? 'bg-blue-500' :
                        'bg-gray-400'
                      }`}></span>
                      
                      <span className="flex-1 body-text text-neutral-700">
                        {activity.message}
                      </span>
                      
                      {activity.xp_loan_number && (
                        <span className="code-text text-neutral-500">
                          {activity.xp_loan_number}
                        </span>
                      )}
                      
                      <Badge 
                        variant="outline"
                        className={`detail-text ${
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
                    <div className="text-center py-8 body-text text-neutral-500" data-testid="no-activity">
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
