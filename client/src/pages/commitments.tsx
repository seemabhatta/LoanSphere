import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageWithAssistant from "@/components/page-with-assistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RefreshCw, ChevronUp, ChevronDown, Eye } from "lucide-react";

interface CommitmentDocument {
  id: string;
  commitmentId: string;
  investorLoanNumber: string;
  agency: string;
  status: string;
  data: any;
  createdAt: number;
  updatedAt: number;
  metadata: {
    source: string;
    stagedAt: string;
    expiresAt?: string;
  };
}

export default function Commitments() {
  const [selectedCommitment, setSelectedCommitment] = useState<CommitmentDocument | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const { data: commitmentsData, refetch: refetchCommitments } = useQuery({
    queryKey: ['/api/commitments'],
    queryFn: async () => {
      const response = await fetch('/api/commitments/');
      if (!response.ok) {
        throw new Error('Failed to fetch commitments data');
      }
      return response.json();
    },
    refetchInterval: 10000
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'staged':
        return 'bg-blue-100 text-blue-800';
      case 'processed':
        return 'bg-green-100 text-green-800';
      case 'expired':
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

  const handleRowClick = (commitment: CommitmentDocument) => {
    setSelectedCommitment(commitment);
    setIsDetailsOpen(true);
  };

  const sortedCommitments = commitmentsData?.commitments ? [...commitmentsData.commitments].sort((a: CommitmentDocument, b: CommitmentDocument) => {
    if (!sortField) return 0;

    let aValue = '';
    let bValue = '';

    switch (sortField) {
      case 'commitmentId':
        aValue = a.commitmentId || '';
        bValue = b.commitmentId || '';
        break;
      case 'investorLoanNumber':
        aValue = a.investorLoanNumber || '';
        bValue = b.investorLoanNumber || '';
        break;
      case 'agency':
        aValue = a.agency || '';
        bValue = b.agency || '';
        break;
      case 'status':
        aValue = a.status || '';
        bValue = b.status || '';
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).toISOString();
        bValue = new Date(b.createdAt).toISOString();
        break;
    }

    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  }) : [];

  return (
    <PageWithAssistant pageName="Commitments">
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Data & Docs</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Commitments</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              Commitments
            </h1>
            <p className="text-gray-500 mt-1">
              View and manage all commitment documents
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                refetchCommitments();
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
                          onClick={() => handleSort('commitmentId')}
                          data-testid="sort-commitment-id"
                        >
                          <span>Commitment ID</span>
                          {sortField === 'commitmentId' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('investorLoanNumber')}
                          data-testid="sort-loan-number"
                        >
                          <span>Loan Number</span>
                          {sortField === 'investorLoanNumber' && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                        <button 
                          className="flex items-center space-x-1 hover:text-neutral-900"
                          onClick={() => handleSort('agency')}
                          data-testid="sort-agency"
                        >
                          <span>Agency</span>
                          {sortField === 'agency' && (
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
                          onClick={() => handleSort('createdAt')}
                          data-testid="sort-created-at"
                        >
                          <span>Received</span>
                          {sortField === 'createdAt' && (
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
                    {sortedCommitments?.map((commitment: CommitmentDocument) => (
                      <tr 
                        key={commitment.id}
                        className="border-b hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleRowClick(commitment)}
                        data-testid={`commitment-row-${commitment.commitmentId}`}
                      >
                        <td className="py-2 px-3 font-mono text-xs">
                          {commitment.commitmentId || 'N/A'}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs">
                          {commitment.investorLoanNumber || 'N/A'}
                        </td>
                        <td className="py-2 px-3 text-xs">
                          <Badge 
                            variant="outline"
                            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-200"
                          >
                            {commitment.agency || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          <Badge 
                            variant="outline"
                            className={`text-xs px-2 py-0.5 ${getStatusColor(commitment.status)}`}
                            data-testid={`status-${commitment.commitmentId}`}
                          >
                            {commitment.status || 'Unknown'}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-600">
                          {new Date(commitment.createdAt).toLocaleDateString('en-US', {
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
                              handleRowClick(commitment);
                            }}
                            data-testid={`view-details-${commitment.commitmentId}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {!commitmentsData?.commitments?.length && (
                  <div className="text-center py-8 text-neutral-500" data-testid="no-commitments">
                    No commitments found
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
            <DialogTitle>Commitment Details</DialogTitle>
          </DialogHeader>
          {selectedCommitment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Commitment ID</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{selectedCommitment.commitmentId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Loan Number</label>
                  <p className="text-sm font-mono bg-gray-50 p-2 rounded">{selectedCommitment.investorLoanNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Agency</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedCommitment.agency}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <Badge className={`${getStatusColor(selectedCommitment.status)} text-xs`}>
                    {selectedCommitment.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Received</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">
                    {new Date(selectedCommitment.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Source</label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedCommitment.metadata.source}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Raw Commitment Data</label>
                <pre className="text-xs bg-gray-50 p-4 rounded overflow-x-auto border">
                  {JSON.stringify(selectedCommitment.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PageWithAssistant>
  );
}