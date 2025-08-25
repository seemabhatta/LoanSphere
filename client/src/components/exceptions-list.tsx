import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/stores/dashboard-store";
import { Clock, User } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Exception {
  id: string;
  xp_loan_number: string;
  rule_name: string;
  severity: string;
  status: string;
  confidence?: number;
  description: string;
  evidence?: any;
  auto_fix_suggestion?: any;
  detected_at: string;
  resolved_by?: string;
}

interface ExceptionsListProps {
  exceptions: Exception[];
}

export default function ExceptionsList({ exceptions }: ExceptionsListProps) {
  const { setSelectedExceptionId } = useDashboardStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const applyAutoFixMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      return await apiRequest('POST', `/api/exceptions/${exceptionId}/auto-fix`, {
        applied_by: 'user'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions'] });
      toast({
        title: "Auto-Fix Applied",
        description: "Auto-fix has been successfully applied."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to apply auto-fix.",
        variant: "destructive"
      });
    }
  });

  const resolveExceptionMutation = useMutation({
    mutationFn: async (exceptionId: string) => {
      return await apiRequest('POST', `/api/exceptions/${exceptionId}/resolve`, {
        resolution_type: 'manual',
        resolved_by: 'user',
        notes: 'Resolved manually by user'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions'] });
      toast({
        title: "Exception Resolved",
        description: "Exception has been successfully resolved."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve exception.",
        variant: "destructive"
      });
    }
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-error/10 text-error px-2 py-1 rounded text-xs font-medium';
      case 'MEDIUM':
        return 'bg-warning/10 text-warning px-2 py-1 rounded text-xs font-medium';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium';
      default:
        return 'bg-neutral-100 text-neutral-800 px-2 py-1 rounded text-xs font-medium';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours === 1) {
      return "1 hour ago";
    } else {
      return `${diffInHours} hours ago`;
    }
  };

  const handleApplyAutoFix = async (e: React.MouseEvent, exceptionId: string) => {
    e.stopPropagation();
    applyAutoFixMutation.mutate(exceptionId);
  };

  const handleResolveException = async (e: React.MouseEvent, exceptionId: string) => {
    e.stopPropagation();
    resolveExceptionMutation.mutate(exceptionId);
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-neutral-800">
            Current Exceptions
          </CardTitle>
          <Button 
            variant="link" 
            size="sm" 
            className="text-primary hover:underline"
            data-testid="button-view-all"
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {exceptions.slice(0, 5).map((exception) => (
            <div 
              key={exception.id}
              className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50 transition-colors cursor-pointer"
              onClick={() => setSelectedExceptionId(exception.id)}
              data-testid={`exception-${exception.xp_loan_number}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={getSeverityColor(exception.severity)}>
                      {exception.severity}
                    </span>
                    <span className="text-sm font-mono text-neutral-600">
                      {exception.xp_loan_number}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-800 mb-1">
                    {exception.rule_name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {exception.description}
                  </p>
                  <div className="flex items-center space-x-4 mt-3 text-xs text-neutral-500">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTimeAgo(exception.detected_at)}
                    </span>
                    <span className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      Auto-detected
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-neutral-500 mb-2">Confidence</div>
                  <div className="text-sm font-mono text-warning">
                    {exception.confidence ? `${Math.round(exception.confidence * 100)}%` : 'N/A'}
                  </div>
                </div>
              </div>
              
              {/* Auto-Fix Suggestion */}
              {exception.auto_fix_suggestion && exception.status === 'open' && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs text-blue-600 font-medium mb-1">
                        Suggested Auto-Fix
                      </p>
                      <p className="text-xs text-blue-800">
                        {exception.auto_fix_suggestion.description || 'Auto-fix available'}
                      </p>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        size="sm"
                        onClick={(e) => handleApplyAutoFix(e, exception.id)}
                        disabled={applyAutoFixMutation.isPending}
                        className="bg-success text-white hover:bg-green-600 text-xs px-3 py-1"
                        data-testid={`button-accept-${exception.xp_loan_number}`}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleResolveException(e, exception.id)}
                        disabled={resolveExceptionMutation.isPending}
                        className="bg-neutral-200 text-neutral-700 hover:bg-neutral-300 text-xs px-3 py-1"
                        data-testid={`button-reject-${exception.xp_loan_number}`}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {exceptions.length === 0 && (
            <div className="text-center py-4 text-neutral-500" data-testid="no-exceptions">
              No open exceptions
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
