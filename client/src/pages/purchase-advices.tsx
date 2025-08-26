import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, ChevronUp, ChevronDown, Eye } from "lucide-react";

interface PurchaseAdvice {
  id: string;
  purchase_data: any;
  source_file_id: string;
  processed_at: string;
}

export default function PurchaseAdvices() {
  const [selectedPurchaseAdvice, setSelectedPurchaseAdvice] = useState<PurchaseAdvice | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: purchaseAdvicesData, refetch: refetchPurchaseAdvices } = useQuery({
    queryKey: ['/api/purchase-advices'],
    queryFn: async () => {
      const response = await fetch('/api/purchase-advices/');
      if (!response.ok) {
        throw new Error('Failed to fetch purchase advices data');
      }
      return response.json();
    },
    refetchInterval: 10000
  });

  const extractLoanNumber = (purchaseData: any): string => {
    return purchaseData?.eventMetadata?.xpLoanNumber || 
           purchaseData?.loanNumber || 
           purchaseData?.investorLoanNumber || 
           'N/A';
  };

  const extractCommitmentNo = (purchaseData: any): string => {
    return purchaseData?.commitmentNo || 
           purchaseData?.commitmentNumber || 
           'N/A';
  };

  const extractSellerNumber = (purchaseData: any): string => {
    return purchaseData?.sellerNumber || 
           purchaseData?.seller?.number || 
           'N/A';
  };

  const extractPurchasedAmount = (purchaseData: any): number | null => {
    return purchaseData?.prinPurchased || 
           purchaseData?.purchasedAmount || 
           null;
  };

  const extractInterestRate = (purchaseData: any): number | null => {
    return purchaseData?.interestRate || 
           purchaseData?.noteRate || 
           null;
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (purchaseAdvice: PurchaseAdvice) => {
    setSelectedPurchaseAdvice(purchaseAdvice);
    setIsDetailsOpen(true);
  };

  const sortedPurchaseAdvices = purchaseAdvicesData?.purchase_advices ? [...purchaseAdvicesData.purchase_advices].sort((a: PurchaseAdvice, b: PurchaseAdvice) => {
    if (!sortField) return 0;

    let aValue = '';
    let bValue = '';

    switch (sortField) {
      case 'loan_number':
        aValue = extractLoanNumber(a.purchase_data);
        bValue = extractLoanNumber(b.purchase_data);
        break;
      case 'commitment_no':
        aValue = extractCommitmentNo(a.purchase_data);
        bValue = extractCommitmentNo(b.purchase_data);
        break;
      case 'seller_number':
        aValue = extractSellerNumber(a.purchase_data);
        bValue = extractSellerNumber(b.purchase_data);
        break;
      case 'purchased_amount':
        aValue = (extractPurchasedAmount(a.purchase_data) || 0).toString();
        bValue = (extractPurchasedAmount(b.purchase_data) || 0).toString();
        break;
      case 'processed_at':
        aValue = a.processed_at;
        bValue = b.processed_at;
        break;
    }

    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  }) : [];

  const formatCurrency = (amount?: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (rate?: number | null) => {
    if (!rate) return 'N/A';
    return `${(rate * 100).toFixed(3)}%`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Data & Docs</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Purchase Advices</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              Purchase Advices
            </h1>
            <p className="text-gray-500 mt-1">
              View and manage all purchase advice documents
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                refetchPurchaseAdvices();
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
                          onClick={() => handleSort('loan_number')}
                          data-testid="sort-loan-number"
                        >
                          <span>Loan Number</span>
                          {sortField === 'loan_number' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('commitment_no')}
                          data-testid="sort-commitment-no"
                        >
                          <span>Commitment No.</span>
                          {sortField === 'commitment_no' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('seller_number')}
                          data-testid="sort-seller-number"
                        >
                          <span>Seller</span>
                          {sortField === 'seller_number' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('purchased_amount')}
                          data-testid="sort-purchased-amount"
                        >
                          <span>Purchased Amount</span>
                          {sortField === 'purchased_amount' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('processed_at')}
                          data-testid="sort-processed-at"
                        >
                          <span>Processed</span>
                          {sortField === 'processed_at' && (
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
                    {sortedPurchaseAdvices?.map((purchaseAdvice: PurchaseAdvice) => (
                      <tr 
                        key={purchaseAdvice.id}
                        className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(purchaseAdvice)}
                        data-testid={`purchase-advice-row-${purchaseAdvice.id}`}
                      >
                        <td className="py-2 px-3 font-mono text-xs">
                          {extractLoanNumber(purchaseAdvice.purchase_data)}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">
                          {extractCommitmentNo(purchaseAdvice.purchase_data)}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <Badge 
                            variant="outline"
                            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                          >
                            {extractSellerNumber(purchaseAdvice.purchase_data)}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs font-mono">
                          {formatCurrency(extractPurchasedAmount(purchaseAdvice.purchase_data))}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600">
                          {new Date(purchaseAdvice.processed_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-2 px-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(purchaseAdvice);
                            }}
                            data-testid={`view-details-${purchaseAdvice.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {!purchaseAdvicesData?.purchase_advices?.length && (
                  <div className="text-center py-8 text-neutral-500" data-testid="no-purchase-advices">
                    No purchase advices found
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
            <DialogTitle>Purchase Advice Details</DialogTitle>
          </DialogHeader>
          {selectedPurchaseAdvice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Loan Number</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{extractLoanNumber(selectedPurchaseAdvice.purchase_data)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Commitment Number</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{extractCommitmentNo(selectedPurchaseAdvice.purchase_data)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Seller Number</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{extractSellerNumber(selectedPurchaseAdvice.purchase_data)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Purchased Amount</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{formatCurrency(extractPurchasedAmount(selectedPurchaseAdvice.purchase_data))}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Interest Rate</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{formatPercentage(extractInterestRate(selectedPurchaseAdvice.purchase_data))}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Processed</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {new Date(selectedPurchaseAdvice.processed_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Raw Purchase Advice Data</label>
                <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto border">
                  {JSON.stringify(selectedPurchaseAdvice.purchase_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}