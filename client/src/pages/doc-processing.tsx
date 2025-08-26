import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { FileText, Files } from "lucide-react";

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

  // Group documents by loan number for better organization
  const groupedDocuments = documents.reduce((acc: Record<string, DocumentProcessing[]>, doc: DocumentProcessing) => {
    if (!acc[doc.xp_loan_number]) {
      acc[doc.xp_loan_number] = [];
    }
    acc[doc.xp_loan_number].push(doc);
    return acc;
  }, {});

  // Sort loan numbers
  const sortedLoanNumbers = Object.keys(groupedDocuments).sort();

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
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Total: {documents.length}</span>
            </div>
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
                  <span>Source</span>
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
              {sortedLoanNumbers.map(loanNumber => {
                const loanDocs = organizeWithinLoan(groupedDocuments[loanNumber]);
                
                return [
                  // Loan header row
                  <tr key={`header-${loanNumber}`} className="bg-neutral-100 border-t-2 border-t-neutral-300">
                    <td colSpan={10} className="p-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">📋</span>
                        <span className="font-bold text-neutral-800">Loan {loanNumber}</span>
                        <span className="text-sm text-neutral-500">({loanDocs.length} documents)</span>
                      </div>
                    </td>
                  </tr>,
                  // Documents for this loan
                  ...loanDocs.map((document, docIndex) => {
                    const isChild = document.is_split_document;
                    const nextDoc = docIndex < loanDocs.length - 1 ? loanDocs[docIndex + 1] : null;
                    const isLastChild = isChild && (!nextDoc || !nextDoc.is_split_document || nextDoc.parent_doc_id !== document.parent_doc_id);
                    
                    return (
                      <tr key={document.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${
                        isChild ? 'bg-blue-50/10' : document.split_count ? 'bg-green-50/10' : ''
                      }`}>
                        <td className="p-4 body-text text-neutral-600" data-testid={`loan-${document.id}`}>
                          <div className="flex items-center ml-6">
                            {isChild ? (
                              <span className="text-blue-400 mr-3 text-xs">{isLastChild ? '└─' : '├─'}</span>
                            ) : (
                              <span className="text-green-400 mr-3 text-xs">├─</span>
                            )}
                            {loanNumber}
                          </div>
                        </td>
                        <td className="p-4 body-text text-neutral-700" data-testid={`type-${document.id}`}>
                          <div className="flex items-center ml-6">
                            {isChild ? (
                              <span className="text-blue-400 mr-3 text-xs">{isLastChild ? '└─' : '├─'}</span>
                            ) : (
                              <span className="text-green-400 mr-3 text-xs">├─</span>
                            )}
                            <div className="flex items-center space-x-2">
                              {document.document_type}
                              {isChild && <span className="text-xs text-blue-500 bg-blue-100 px-1 rounded">split</span>}
                              {document.split_count && <span className="text-xs text-green-500 bg-green-100 px-1 rounded">→{document.split_count}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 code-text text-neutral-600" data-testid={`doc-id-${document.id}`}>
                          {document.xp_doc_id}
                        </td>
                        <td className="p-4" data-testid={`source-${document.id}`}>
                          {document.parent_doc_id ? (
                            <div className="flex items-center space-x-1">
                              <FileText className="w-3 h-3 text-blue-500" />
                              <span className="text-xs text-blue-600">blob</span>
                            </div>
                          ) : document.split_count ? (
                            <div className="flex items-center space-x-1">
                              <Files className="w-3 h-3 text-green-500" />
                              <span className="text-xs text-green-600">splits</span>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-400">single</span>
                          )}
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
              }).flat()}
            </tbody>
          </table>

          {!documents.length && (
            <div className="text-center py-12">
              <p className="text-gray-500">No documents in processing pipeline</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}