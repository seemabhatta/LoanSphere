import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ExceptionDetailModal from "@/components/exception-detail-modal";
import { AlertTriangle, CheckCircle, XCircle, Clock, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Exceptions() {
  const [selectedExceptionId, setSelectedExceptionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exceptionsData, refetch } = useQuery({
    queryKey: ['/api/exceptions', { status: statusFilter, severity: severityFilter }],
    refetchInterval: 15000
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/exceptions/stats/summary'],
    refetchInterval: 30000
  });

  const resolveExceptionMutation = useMutation({
    mutationFn: async ({ exceptionId, resolutionType, notes }: any) => {
      return await apiRequest('POST', `/api/exceptions/${exceptionId}/resolve`, {
        resolution_type: resolutionType,
        resolved_by: 'user',
        notes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions/stats/summary'] });
      toast({
        title: "Exception Resolved",
        description: "Exception has been successfully resolved."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to resolve exception.",
        variant: "destructive"
      });
    }
  });

  const applyAutoFixMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      return await apiRequest('POST', `/api/exceptions/${exceptionId}/auto-fix`, {
        applied_by: 'user'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions/stats/summary'] });
      toast({
        title: "Auto-Fix Applied",
        description: "Auto-fix has been successfully applied."
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to apply auto-fix.",
        variant: "destructive"
      });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleResolveException = async (exceptionId: string, resolutionType: string) => {
    resolveExceptionMutation.mutate({ 
      exceptionId, 
      resolutionType, 
      notes: `Resolved via ${resolutionType}` 
    });
  };

  const handleApplyAutoFix = async (exceptionId: string) => {
    applyAutoFixMutation.mutate(exceptionId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium text-neutral-800" data-testid="page-title">
              Exceptions
            </h2>
            <p className="text-neutral-500 mt-1">
              Manage and resolve loan boarding exceptions
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[120px]" data-testid="filter-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm font-medium">Total Open</p>
                  <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-total-open">
                    {statsData?.total_open || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm font-medium">High Priority</p>
                  <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-high-priority">
                    {statsData?.by_severity?.high || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm font-medium">Resolved</p>
                  <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-resolved">
                    {statsData?.total_resolved || 0}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm font-medium">Avg Resolution Time</p>
                  <p className="text-3xl font-bold text-neutral-800 mt-2">2.4h</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exceptions List */}
        <Card>
          <CardHeader>
            <CardTitle>Exception Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exceptionsData?.exceptions?.map((exception: any) => (
                <div 
                  key={exception.id}
                  className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedExceptionId(exception.id)}
                  data-testid={`exception-${exception.xp_loan_number}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getSeverityColor(exception.severity)}>
                          {exception.severity}
                        </Badge>
                        <span className="text-sm font-mono text-neutral-600">
                          {exception.xp_loan_number}
                        </span>
                        <Badge className={getStatusColor(exception.status)} variant="outline">
                          {exception.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm font-medium text-neutral-800 mb-1">
                        {exception.rule_name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {exception.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 mt-3 text-xs text-neutral-500">
                        <span>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(exception.detected_at).toLocaleString()}
                        </span>
                        <span>Confidence: {exception.confidence ? `${(exception.confidence * 100).toFixed(0)}%` : 'N/A'}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      {exception.auto_fix_suggestion && exception.status === 'open' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyAutoFix(exception.id);
                          }}
                          disabled={applyAutoFixMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          data-testid={`button-auto-fix-${exception.xp_loan_number}`}
                        >
                          Apply Auto-Fix
                        </Button>
                      )}
                      
                      {exception.status === 'open' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolveException(exception.id, 'manual');
                          }}
                          disabled={resolveExceptionMutation.isPending}
                          data-testid={`button-resolve-${exception.xp_loan_number}`}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {exception.auto_fix_suggestion && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600 font-medium mb-1">
                        Auto-Fix Available
                      </p>
                      <p className="text-xs text-blue-800">
                        {exception.auto_fix_suggestion.description}
                      </p>
                    </div>
                  )}
                </div>
              ))}
              
              {!exceptionsData?.exceptions?.length && (
                <div className="text-center py-8 text-neutral-500" data-testid="no-exceptions">
                  No exceptions found matching the current filters
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Exception Detail Modal */}
      {selectedExceptionId && (
        <ExceptionDetailModal 
          exceptionId={selectedExceptionId}
          isOpen={!!selectedExceptionId}
          onClose={() => setSelectedExceptionId(null)}
        />
      )}
    </div>
  );
}
