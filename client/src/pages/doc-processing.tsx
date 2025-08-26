import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { FileText, Files, Search, Filter, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface DocumentProcessing {
  id: string;
  xp_doc_id: string;
  xp_loan_number: string;
  document_type: string;
  status: string;
  ocr_status: string;
  classification_status: string;
  extraction_status: string;
  validation_status: string;
  created_at: string;
  parent_doc_id?: string;
  is_split_document?: boolean;
  split_count?: number;
}

export default function DocProcessing() {
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'hierarchy' | 'flat'>('hierarchy');

  const { data: documentsData } = useQuery({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents/');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      return response.json();
    },
    refetchInterval: 10000
  });

  const getStatusBadge = (status: string) => {
    const baseClasses = "text-xs px-2 py-1";
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'processing':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'failed':
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const documents = documentsData?.documents || [];

  // Filter documents based on search and status
  const filteredDocuments = documents.filter((doc: DocumentProcessing) => {
    const matchesSearch = searchTerm === '' || 
      doc.xp_loan_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.xp_doc_id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Group filtered documents by loan number
  const groupedDocuments = filteredDocuments.reduce((acc: Record<string, DocumentProcessing[]>, doc: DocumentProcessing) => {
    if (!acc[doc.xp_loan_number]) {
      acc[doc.xp_loan_number] = [];
    }
    acc[doc.xp_loan_number].push(doc);
    return acc;
  }, {});

  // Sort loan numbers
  const sortedLoanNumbers = Object.keys(groupedDocuments).sort();

  // For flat view, sort all filtered documents
  const sortedFlatDocuments = [...filteredDocuments].sort((a, b) => {
    let aVal = a[sortField as keyof DocumentProcessing];
    let bVal = b[sortField as keyof DocumentProcessing];
    
    if (sortField === 'created_at') {
      aVal = new Date(aVal as string).getTime();
      bVal = new Date(bVal as string).getTime();
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Function to organize documents within a loan (parent-child relationships)
  const organizeWithinLoan = (docs: DocumentProcessing[]) => {
    const organized: DocumentProcessing[] = [];
    const parentDocs = docs.filter(doc => !doc.is_split_document);
    const childDocs = docs.filter(doc => doc.is_split_document);

    // Add parent documents and their children
    for (const parent of parentDocs) {
      organized.push(parent);
      // Find children of this parent
      const children = childDocs.filter(child => child.parent_doc_id === parent.xp_doc_id);
      organized.push(...children);
    }

    // Add any orphaned child documents
    const addedChildIds = new Set(organized.filter(doc => doc.is_split_document).map(doc => doc.id));
    const orphans = childDocs.filter(doc => !addedChildIds.has(doc.id));
    organized.push(...orphans);

    return organized;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Pipeline</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Doc Processing</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              Document Processing Pipeline
            </h1>
            <p className="text-gray-500 mt-1">
              Track individual document processing steps by loan
            </p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2">
            <Button 
              variant={viewMode === 'hierarchy' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewMode('hierarchy')}
              data-testid="button-hierarchy-view"
            >
              Tree View
            </Button>
            <Button 
              variant={viewMode === 'flat' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewMode('flat')}
              data-testid="button-flat-view"
            >
              Table View
            </Button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex items-center space-x-4 mt-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input
              placeholder="Search by loan number, document type, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-neutral-500" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(searchTerm || statusFilter !== 'all') && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
              }}
              data-testid="button-clear-filters"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span className="caption-text">
              {viewMode === 'hierarchy' ? (
                <>Showing {Object.keys(groupedDocuments).length} loan(s), {filteredDocuments.length} docs</>
              ) : (
                <>Showing {filteredDocuments.length} documents</>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="overflow-x-auto h-full">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('xp_loan_number')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-loan-number"
                  >
                    Loan Number {sortField === 'xp_loan_number' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('document_type')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-document-type"
                  >
                    Document Type {sortField === 'document_type' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('xp_doc_id')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-doc-id"
                  >
                    Document ID {sortField === 'xp_doc_id' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('status')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-status"
                  >
                    Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('ocr_status')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-ocr"
                  >
                    OCR {sortField === 'ocr_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('classification_status')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-classification"
                  >
                    Classification {sortField === 'classification_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('extraction_status')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-extraction"
                  >
                    Extraction {sortField === 'extraction_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('validation_status')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-validation"
                  >
                    Validation {sortField === 'validation_status' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
                <th className="text-left py-2 px-3 text-xs font-bold text-neutral-700">
                  <button 
                    onClick={() => handleSort('created_at')}
                    className="text-xs font-bold text-neutral-700 hover:text-neutral-900"
                    data-testid="header-created"
                  >
                    Created {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {viewMode === 'hierarchy' ? (
                sortedLoanNumbers.map(loanNumber => {
                  const loanDocs = organizeWithinLoan(groupedDocuments[loanNumber]);
                  
                  return [
                  // Documents for this loan
                  ...loanDocs.map((document, docIndex) => {
                    const isChild = document.is_split_document;
                    const nextDoc = docIndex < loanDocs.length - 1 ? loanDocs[docIndex + 1] : null;
                    const isLastChild = isChild && (!nextDoc || !nextDoc.is_split_document || nextDoc.parent_doc_id !== document.parent_doc_id);
                    
                    // Check if this is the last document under the loan
                    const isLastInLoan = docIndex === loanDocs.length - 1;
                    
                    return (
                      <tr key={document.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${
                        isChild ? 'bg-blue-50/10' : document.split_count ? 'bg-green-50/10' : ''
                      }`}>
                        <td className="p-4 body-text text-neutral-600" data-testid={`loan-${document.id}`}>
                          <span className="caption-text">{loanNumber}</span>
                        </td>
                        <td className="p-4 body-text text-neutral-700" data-testid={`type-${document.id}`}>
                          <div className="flex items-center space-x-2">
                            <span className={`body-text ${isChild ? 'text-blue-700' : 'text-green-700'}`}>
                              {document.document_type}
                            </span>
                            {isChild && (
                              <span className="detail-text text-blue-500 bg-blue-100 px-2 py-1 rounded">
                                from {document.parent_doc_id}
                              </span>
                            )}
                            {document.split_count && (
                              <span className="detail-text text-green-500 bg-green-100 px-2 py-1 rounded">
                                splits into {document.split_count} docs
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 code-text text-neutral-600" data-testid={`doc-id-${document.id}`}>
                          <span className={`code-text ${isChild ? 'text-blue-600' : 'text-green-600'}`}>
                            {document.xp_doc_id}
                          </span>
                        </td>
                        <td className="p-4" data-testid={`status-${document.id}`}>
                          <Badge className={getStatusBadge(document.status)}>
                            {document.status}
                          </Badge>
                        </td>
                        <td className="p-4" data-testid={`ocr-${document.id}`}>
                          <Badge className={getStatusBadge(document.ocr_status)}>
                            {document.ocr_status}
                          </Badge>
                        </td>
                        <td className="p-4" data-testid={`classification-${document.id}`}>
                          <Badge className={getStatusBadge(document.classification_status)}>
                            {document.classification_status}
                          </Badge>
                        </td>
                        <td className="p-4" data-testid={`extraction-${document.id}`}>
                          <Badge className={getStatusBadge(document.extraction_status)}>
                            {document.extraction_status}
                          </Badge>
                        </td>
                        <td className="p-4" data-testid={`validation-${document.id}`}>
                          <Badge className={getStatusBadge(document.validation_status)}>
                            {document.validation_status}
                          </Badge>
                        </td>
                        <td className="p-4 detail-text text-neutral-500" data-testid={`created-${document.id}`}>
                          {formatDate(document.created_at)}
                        </td>
                      </tr>
                    );
                  })
                ];
              }).flat()
              ) : (
                // Flat table view with full sorting capability
                sortedFlatDocuments.map((document) => (
                  <tr key={document.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${
                    document.is_split_document ? 'bg-blue-50/10' : document.split_count ? 'bg-green-50/10' : ''
                  }`}>
                    <td className="p-4 body-text text-neutral-900" data-testid={`loan-${document.id}`}>
                      {document.xp_loan_number}
                    </td>
                    <td className="p-4 body-text text-neutral-700" data-testid={`type-${document.id}`}>
                      <div className="flex items-center space-x-2">
                        <span className={`body-text ${document.is_split_document ? 'text-blue-700' : 'text-green-700'}`}>
                          {document.document_type}
                        </span>
                        {document.is_split_document && (
                          <span className="detail-text text-blue-500 bg-blue-100 px-2 py-1 rounded">
                            from {document.parent_doc_id}
                          </span>
                        )}
                        {document.split_count && (
                          <span className="detail-text text-green-500 bg-green-100 px-2 py-1 rounded">
                            splits into {document.split_count} docs
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 code-text text-neutral-600" data-testid={`doc-id-${document.id}`}>
                      <span className={`code-text ${document.is_split_document ? 'text-blue-600' : 'text-green-600'}`}>
                        {document.xp_doc_id}
                      </span>
                    </td>
                    <td className="p-4" data-testid={`status-${document.id}`}>
                      <Badge className={getStatusBadge(document.status)}>
                        {document.status}
                      </Badge>
                    </td>
                    <td className="p-4" data-testid={`ocr-${document.id}`}>
                      <Badge className={getStatusBadge(document.ocr_status)}>
                        {document.ocr_status}
                      </Badge>
                    </td>
                    <td className="p-4" data-testid={`classification-${document.id}`}>
                      <Badge className={getStatusBadge(document.classification_status)}>
                        {document.classification_status}
                      </Badge>
                    </td>
                    <td className="p-4" data-testid={`extraction-${document.id}`}>
                      <Badge className={getStatusBadge(document.extraction_status)}>
                        {document.extraction_status}
                      </Badge>
                    </td>
                    <td className="p-4" data-testid={`validation-${document.id}`}>
                      <Badge className={getStatusBadge(document.validation_status)}>
                        {document.validation_status}
                      </Badge>
                    </td>
                    <td className="p-4 detail-text text-neutral-500" data-testid={`created-${document.id}`}>
                      {formatDate(document.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!documents.length && (
            <div className="text-center py-12">
              <p className="body-text text-gray-500">No documents in processing pipeline</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}