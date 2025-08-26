import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageWithAssistant from "@/components/page-with-assistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, ChevronUp, ChevronDown, Eye } from "lucide-react";

interface Loan {
  id: string;
  xp_loan_number: string;
  tenant_id: string;
  seller_name?: string;
  seller_number?: string;
  servicer_number?: string;
  status: string;
  product?: string;
  commitment_id?: string;
  note_amount?: number;
  interest_rate?: number;
  pass_thru_rate?: number;
  property_value?: number;
  ltv_ratio?: number;
  credit_score?: number;
  boarding_readiness: string;
  boarding_status: string;
  first_pass_yield?: boolean;
  time_to_board?: number;
  metadata?: string;
  created_at?: string;
  updated_at?: string;
}

export default function Loans() {
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: loansData, refetch: refetchLoans } = useQuery({
    queryKey: ['/api/loans'],
    queryFn: async () => {
      const response = await fetch('/api/loans/');
      if (!response.ok) {
        throw new Error('Failed to fetch loans data');
      }
      return response.json();
    },
    refetchInterval: 10000
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'staged':
        return 'bg-blue-100 text-blue-800';
      case 'underwriting':
        return 'bg-yellow-100 text-yellow-800';
      case 'purchased':
        return 'bg-green-100 text-green-800';
      case 'boarded':
        return 'bg-emerald-100 text-emerald-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBoardingReadinessColor = (readiness: string) => {
    switch (readiness) {
      case 'ready_to_board':
        return 'bg-green-100 text-green-800';
      case 'data_received':
        return 'bg-blue-100 text-blue-800';
      case 'commitment_received':
        return 'bg-purple-100 text-purple-800';
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

  const handleRowClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDetailsOpen(true);
  };

  const sortedLoans = loansData?.loans ? [...loansData.loans].sort((a: Loan, b: Loan) => {
    if (!sortField) return 0;

    let aValue = '';
    let bValue = '';

    switch (sortField) {
      case 'xp_loan_number':
        aValue = a.xp_loan_number || '';
        bValue = b.xp_loan_number || '';
        break;
      case 'seller_name':
        aValue = a.seller_name || '';
        bValue = b.seller_name || '';
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      case 'boarding_readiness':
        aValue = a.boarding_readiness || '';
        bValue = b.boarding_readiness || '';
        break;
      case 'note_amount':
        aValue = (a.note_amount || 0).toString();
        bValue = (b.note_amount || 0).toString();
        break;
      case 'created_at':
        aValue = a.created_at || '';
        bValue = b.created_at || '';
        break;
    }

    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  }) : [];

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate?: number) => {
    if (!rate) return 'N/A';
    return `${(rate * 100).toFixed(3)}%`;
  };

  return (
    <PageWithAssistant pageName="Loans">
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Data & Docs</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Loans</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              Loans
            </h1>
            <p className="text-gray-500 mt-1">
              View and manage all loan records
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
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('xp_loan_number')}
                          data-testid="sort-loan-number"
                        >
                          <span>Loan Number</span>
                          {sortField === 'xp_loan_number' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('seller_name')}
                          data-testid="sort-seller"
                        >
                          <span>Seller</span>
                          {sortField === 'seller_name' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('status')}
                          data-testid="sort-status"
                        >
                          <span>Status</span>
                          {sortField === 'status' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('boarding_readiness')}
                          data-testid="sort-readiness"
                        >
                          <span>Readiness</span>
                          {sortField === 'boarding_readiness' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('note_amount')}
                          data-testid="sort-amount"
                        >
                          <span>Note Amount</span>
                          {sortField === 'note_amount' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <span>Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLoans?.map((loan: Loan) => (
                      <tr 
                        key={loan.id}
                        className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(loan)}
                        data-testid={`loan-row-${loan.xp_loan_number}`}
                      >
                        <td className="py-2 px-3 font-mono text-xs">
                          {loan.xp_loan_number || 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {loan.seller_name || 'Unknown'}
                        </td>
                        <td className="py-2 px-3">
                          <Badge 
                            variant="outline"
                            className={`text-xs px-2 py-0.5 ${getStatusColor(loan.status)}`}
                            data-testid={`status-${loan.xp_loan_number}`}
                          >
                            {loan.status || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          <Badge 
                            variant="outline"
                            className={`text-xs px-2 py-0.5 ${getBoardingReadinessColor(loan.boarding_readiness)}`}
                            data-testid={`readiness-${loan.xp_loan_number}`}
                          >
                            {loan.boarding_readiness || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs font-mono">
                          {formatCurrency(loan.note_amount)}
                        </td>
                        <td className="py-2 px-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(loan);
                            }}
                            data-testid={`view-details-${loan.xp_loan_number}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {!loansData?.loans?.length && (
                  <div className="text-center py-8 text-neutral-500" data-testid="no-loans">
                    No loans found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Loan Number</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{selectedLoan.xp_loan_number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Seller</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedLoan.seller_name || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <Badge className={`${getStatusColor(selectedLoan.status)} text-xs`}>
                    {selectedLoan.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Boarding Readiness</label>
                  <Badge className={`${getBoardingReadinessColor(selectedLoan.boarding_readiness)} text-xs`}>
                    {selectedLoan.boarding_readiness}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Note Amount</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{formatCurrency(selectedLoan.note_amount)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Interest Rate</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{formatPercentage(selectedLoan.interest_rate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Property Value</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{formatCurrency(selectedLoan.property_value)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Credit Score</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedLoan.credit_score || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Commitment ID</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{selectedLoan.commitment_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {selectedLoan.created_at ? new Date(selectedLoan.created_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
              
              {selectedLoan.metadata && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Metadata</label>
                  <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto border">
                    {JSON.stringify(JSON.parse(selectedLoan.metadata), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PageWithAssistant>
  );
}