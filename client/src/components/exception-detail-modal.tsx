import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useDashboardStore } from "@/stores/dashboard-store";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X, User, FileText } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ExceptionDetailModalProps {
  exceptionId: string;
  isOpen: boolean;
  onClose?: () => void;
}

export default function ExceptionDetailModal({ 
  exceptionId, 
  isOpen, 
  onClose 
}: ExceptionDetailModalProps) {
  const { setSelectedExceptionId } = useDashboardStore();
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exception } = useQuery({
    queryKey: ['/api/exceptions', exceptionId],
    enabled: !!exceptionId && isOpen
  });

  const applyAutoFixMutation = useMutation({
    mutationFn: async () => {
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
      handleClose();
    }
  });

  const resolveExceptionMutation = useMutation({
    mutationFn: async (resolutionType: string) => {
      return await apiRequest('POST', `/api/exceptions/${exceptionId}/resolve`, {
        resolution_type: resolutionType,
        resolved_by: 'user',
        notes: comment || `Resolved via ${resolutionType}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions'] });
      toast({
        title: "Exception Resolved",
        description: "Exception has been successfully resolved."
      });
      handleClose();
    }
  });

  const handleClose = () => {
    setSelectedExceptionId(null);
    setComment("");
    if (onClose) onClose();
  };

  const handleApplyAutoFix = () => {
    applyAutoFixMutation.mutate();
  };

  const handleRejectAutoFix = () => {
    resolveExceptionMutation.mutate('rejected');
  };

  const handleManualReview = () => {
    resolveExceptionMutation.mutate('manual');
  };

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

  if (!exception) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <DialogHeader className="border-b border-neutral-200 pb-4">
          <DialogTitle className="page-title text-neutral-800">
            Exception Details
          </DialogTitle>
          <p className="body-text text-neutral-500 mt-1">
            Loan {exception.xp_loan_number} - {exception.rule_name}
          </p>
        </DialogHeader>
        
        {/* Modal Content */}
        <div className="overflow-y-auto flex-1 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Exception Info */}
            <div>
              <h4 className="font-medium text-neutral-800 mb-4">Exception Information</h4>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Severity:</span>
                  <Badge className={getSeverityColor(exception.severity)}>
                    {exception.severity}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Rule ID:</span>
                  <span className="code-text">{exception.rule_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Detected:</span>
                  <span className="body-text">
                    {new Date(exception.detected_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Confidence:</span>
                  <span className="font-mono text-warning">
                    {exception.confidence ? `${Math.round(exception.confidence * 100)}%` : 'N/A'}
                  </span>
                </div>
                {exception.sla_due && (
                  <div className="flex justify-between">
                    <span className="text-neutral-600">SLA Due:</span>
                    <span className="body-text text-error">
                      {new Date(exception.sla_due).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Description */}
              <div className="mt-6">
                <h4 className="font-medium text-neutral-800 mb-2">Description</h4>
                <p className="body-text text-neutral-700 bg-neutral-50 p-3 rounded-lg">
                  {exception.description}
                </p>
              </div>
              
              {/* Evidence */}
              {exception.evidence && (
                <div className="mt-6">
                  <h4 className="font-medium text-neutral-800 mb-4">Evidence</h4>
                  <div className="bg-neutral-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 gap-4">
                      {Object.entries(exception.evidence).map(([key, value]: [string, any]) => (
                        <div key={key} className="border-l-4 border-error pl-3">
                          <p className="label-text text-neutral-800 capitalize">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="code-text text-error">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Auto-Fix Recommendation */}
            <div>
              {exception.auto_fix_suggestion && exception.status === 'open' && (
                <>
                  <h4 className="font-medium text-neutral-800 mb-4">Recommended Auto-Fix</h4>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <h5 className="font-medium text-blue-800 mb-2">
                      {exception.auto_fix_suggestion.type?.replace(/_/g, ' ') || 'Auto-Fix Available'}
                    </h5>
                    <p className="body-text text-blue-700 mb-4">
                      {exception.auto_fix_suggestion.description || 'An automatic fix is available for this exception.'}
                    </p>
                    
                    {exception.auto_fix_suggestion.new_value && (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-blue-700">Proposed Action:</span>
                          <span className="code-text">
                            {exception.auto_fix_suggestion.type}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-700">New Value:</span>
                          <span className="code-text text-success">
                            {exception.auto_fix_suggestion.new_value}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {/* Action Buttons */}
              {exception.status === 'open' && (
                <div className="mt-6 space-y-3">
                  {exception.auto_fix_suggestion && (
                    <Button
                      onClick={handleApplyAutoFix}
                      disabled={applyAutoFixMutation.isPending}
                      className="w-full bg-success text-white hover:bg-green-600"
                      data-testid="button-accept-autofix"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Accept Auto-Fix
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleRejectAutoFix}
                    disabled={resolveExceptionMutation.isPending}
                    variant="outline"
                    className="w-full"
                    data-testid="button-reject-autofix"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject Auto-Fix
                  </Button>
                  
                  <Button
                    onClick={handleManualReview}
                    disabled={resolveExceptionMutation.isPending}
                    className="w-full bg-primary text-white hover:bg-blue-700"
                    data-testid="button-manual-review"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Manual Review
                  </Button>
                </div>
              )}
              
              {/* Comments */}
              <div className="mt-6">
                <Label htmlFor="comment" className="label-text text-neutral-700">
                  Add Comment (Optional)
                </Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-2"
                  rows={3}
                  placeholder="Provide additional context or reasoning..."
                  data-testid="textarea-comment"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
