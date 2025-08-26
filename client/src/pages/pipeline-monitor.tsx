import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <div className="space-y-6">
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
        </div>
      </div>
    </div>
  );
}
