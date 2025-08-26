import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PageWithAssistant from "@/components/page-with-assistant";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter,
  Search,
  FileText,
  AlertCircle,
  Users,
  Wrench,
  ArrowRight,
  UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Exception {
  id: string;
  xp_loan_number: string;
  rule_name: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'open' | 'resolved' | 'dismissed';
  description: string;
  detected_at: string;
  confidence?: number;
  auto_fix_suggestion?: any;
  category: string;
  days_old: number;
  assigned_to?: string;
}

interface ExceptionStats {
  total_open: number;
  total_resolved: number;
  by_severity: {
    high: number;
    medium: number;
    low: number;
  };
  by_category: {
    documentation: number;
    data_validation: number;
    investor_compliance: number;
    manual_review: number;
    system_processing: number;
  };
  by_age: {
    under_24h: number;
    one_to_three_days: number;
    over_three_days: number;
  };
}

export default function Exceptions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [selectedExceptions, setSelectedExceptions] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: exceptionsData } = useQuery({
    queryKey: ['/api/exceptions'],
    queryFn: async () => {
      const response = await fetch('/api/exceptions/');
      if (!response.ok) {
        throw new Error('Failed to fetch exceptions');
      }
      return response.json();
    },
    refetchInterval: 15000
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/exceptions/stats/summary'],
    queryFn: async () => {
      const response = await fetch('/api/exceptions/stats/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch exception stats');
      }
      return response.json();
    },
    refetchInterval: 30000
  });

  const resolveExceptionMutation = useMutation({
    mutationFn: async ({ exceptionId, notes }: { exceptionId: string; notes?: string }) => {
      const response = await fetch(`/api/exceptions/${exceptionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution_type: 'manual',
          resolved_by: 'user',
          notes
        })
      });
      if (!response.ok) throw new Error('Failed to resolve exception');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions/stats/summary'] });
      toast({
        title: "Exception Resolved",
        description: "Exception has been successfully resolved."
      });
    }
  });

  const bulkResolveMutation = useMutation({
    mutationFn: async (exceptionIds: string[]) => {
      const promises = exceptionIds.map(id => 
        fetch(`/api/exceptions/${id}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resolution_type: 'bulk',
            resolved_by: 'user',
            notes: 'Bulk resolved'
          })
        })
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/exceptions/stats/summary'] });
      setSelectedExceptions([]);
      toast({
        title: "Exceptions Resolved",
        description: `${selectedExceptions.length} exceptions have been resolved.`
      });
    }
  });

  // Mock transformation of exceptions data to include our operational categories
  const transformExceptions = (exceptions: any[]): Exception[] => {
    if (!exceptions) return [];
    
    return exceptions.map(exception => {
      // Categorize based on rule_name or description
      let category = 'system_processing';
      if (exception.rule_name?.toLowerCase().includes('document') || exception.rule_name?.toLowerCase().includes('missing')) {
        category = 'documentation';
      } else if (exception.rule_name?.toLowerCase().includes('validation') || exception.rule_name?.toLowerCase().includes('field')) {
        category = 'data_validation';
      } else if (exception.rule_name?.toLowerCase().includes('compliance') || exception.rule_name?.toLowerCase().includes('investor')) {
        category = 'investor_compliance';
      } else if (exception.rule_name?.toLowerCase().includes('review') || exception.rule_name?.toLowerCase().includes('manual')) {
        category = 'manual_review';
      }

      const detectedDate = new Date(exception.detected_at);
      const daysOld = Math.floor((Date.now() - detectedDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...exception,
        category,
        days_old: daysOld
      };
    });
  };

  const exceptions = transformExceptions(exceptionsData || []);

  // Filter exceptions
  const filteredExceptions = exceptions.filter(exception => {
    const matchesSearch = searchTerm === '' || 
      exception.xp_loan_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exception.rule_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exception.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || exception.category === categoryFilter;
    const matchesSeverity = severityFilter === 'all' || exception.severity === severityFilter;
    
    let matchesAge = true;
    if (ageFilter === 'under_24h') matchesAge = exception.days_old === 0;
    else if (ageFilter === 'one_to_three_days') matchesAge = exception.days_old >= 1 && exception.days_old <= 3;
    else if (ageFilter === 'over_three_days') matchesAge = exception.days_old > 3;
    
    return matchesSearch && matchesCategory && matchesSeverity && matchesAge;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'documentation': return FileText;
      case 'data_validation': return AlertCircle;
      case 'investor_compliance': return CheckCircle;
      case 'manual_review': return Users;
      case 'system_processing': return Wrench;
      default: return AlertTriangle;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'documentation': return 'bg-blue-100 text-blue-800';
      case 'data_validation': return 'bg-yellow-100 text-yellow-800';
      case 'investor_compliance': return 'bg-purple-100 text-purple-800';
      case 'manual_review': return 'bg-orange-100 text-orange-800';
      case 'system_processing': return 'bg-gray-100 text-gray-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'documentation': return 'Documentation Required';
      case 'data_validation': return 'Data Validation Needed';
      case 'investor_compliance': return 'Investor Compliance';
      case 'manual_review': return 'Manual Review';
      case 'system_processing': return 'System/Processing';
      default: return 'Other';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAgeColor = (daysOld: number) => {
    if (daysOld === 0) return 'text-green-600';
    if (daysOld <= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleBulkResolve = () => {
    if (selectedExceptions.length === 0) return;
    bulkResolveMutation.mutate(selectedExceptions);
  };

  const toggleException = (exceptionId: string) => {
    setSelectedExceptions(prev => 
      prev.includes(exceptionId) 
        ? prev.filter(id => id !== exceptionId)
        : [...prev, exceptionId]
    );
  };

  return (
    <PageWithAssistant pageName="Exceptions">
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4">
        <div className="flex items-center caption-text mb-1">
          <span>Loan Boarding</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Exceptions</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title" data-testid="page-title">
              Exception Management
            </h1>
            <p className="body-text text-gray-500 mt-1">
              Operational exception tracking and resolution
            </p>
          </div>
          
          {selectedExceptions.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="detail-text text-gray-600">
                {selectedExceptions.length} selected
              </span>
              <Button 
                onClick={handleBulkResolve}
                disabled={bulkResolveMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="bulk-resolve-btn"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Bulk Resolve
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search loans, rules, descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                  data-testid="search-input"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48" data-testid="filter-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="documentation">Documentation Required</SelectItem>
                  <SelectItem value="data_validation">Data Validation</SelectItem>
                  <SelectItem value="investor_compliance">Investor Compliance</SelectItem>
                  <SelectItem value="manual_review">Manual Review</SelectItem>
                  <SelectItem value="system_processing">System/Processing</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32" data-testid="filter-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={ageFilter} onValueChange={setAgeFilter}>
                <SelectTrigger className="w-40" data-testid="filter-age">
                  <SelectValue placeholder="Age" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ages</SelectItem>
                  <SelectItem value="under_24h">Under 24h</SelectItem>
                  <SelectItem value="one_to_three_days">1-3 Days</SelectItem>
                  <SelectItem value="over_three_days">Over 3 Days</SelectItem>
                </SelectContent>
              </Select>

              <span className="detail-text text-gray-500">
                {filteredExceptions.length} of {exceptions.length} exceptions
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Exceptions Table */}
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 w-8">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedExceptions(filteredExceptions.map(e => e.id));
                          } else {
                            setSelectedExceptions([]);
                          }
                        }}
                        checked={selectedExceptions.length === filteredExceptions.length && filteredExceptions.length > 0}
                      />
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-700">Loan #</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-700">Category</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-700">Exception</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-700">Severity</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-700">Age</th>
                    <th className="text-left py-2 px-3 text-xs font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExceptions.map((exception) => {
                    const CategoryIcon = getCategoryIcon(exception.category);
                    return (
                      <tr 
                        key={exception.id} 
                        className="border-b border-gray-100 hover:bg-gray-50"
                        data-testid={`exception-row-${exception.xp_loan_number}`}
                      >
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            checked={selectedExceptions.includes(exception.id)}
                            onChange={() => toggleException(exception.id)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <span className="code-text text-blue-600 font-medium">
                            {exception.xp_loan_number}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            <CategoryIcon className="w-4 h-4" />
                            <Badge className={`${getCategoryColor(exception.category)} text-xs`}>
                              {getCategoryLabel(exception.category)}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="body-text text-gray-900 font-medium">{exception.rule_name}</p>
                            <p className="detail-text text-gray-600">{exception.description}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Badge className={`${getSeverityColor(exception.severity)} text-xs`}>
                            {exception.severity}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`detail-text font-medium ${getAgeColor(exception.days_old)}`}>
                            {exception.days_old === 0 ? 'Today' : `${exception.days_old}d`}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2">
                            {exception.auto_fix_suggestion && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100"
                                data-testid={`auto-fix-${exception.xp_loan_number}`}
                              >
                                <Wrench className="w-3 h-3 mr-1" />
                                Auto-Fix
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveExceptionMutation.mutate({ exceptionId: exception.id })}
                              disabled={resolveExceptionMutation.isPending}
                              className="text-xs"
                              data-testid={`resolve-${exception.xp_loan_number}`}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Resolve
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {filteredExceptions.length === 0 && (
                <div className="text-center py-8" data-testid="no-exceptions">
                  <AlertTriangle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="body-text text-gray-500">
                    {exceptions.length === 0 
                      ? "No exceptions found" 
                      : "No exceptions match the current filters"
                    }
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </PageWithAssistant>
  );
}