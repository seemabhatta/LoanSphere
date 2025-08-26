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

  // Group documents to show parent-child relationships
  const organizeDocuments = (docs: DocumentProcessing[]) => {
    const organized: DocumentProcessing[] = [];
    const parentDocs = docs.filter(doc => !doc.is_split_document);
    const childDocs = docs.filter(doc => doc.is_split_document);

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

  const sortedDocuments = organizeDocuments([...documents]).sort((a, b) => {
    // If sorting is applied, respect it but maintain parent-child grouping
    if (sortField && !a.is_split_document && !b.is_split_document) {
      let aVal = a[sortField as keyof DocumentProcessing];
      let bVal = b[sortField as keyof DocumentProcessing];
      
      if (sortField === 'created_at') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    }
    return 0;
  });

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
              {sortedDocuments.map((document: DocumentProcessing, index: number) => {
                const isParent = !document.is_split_document;
                const isChild = document.is_split_document;
                const prevDocument = index > 0 ? sortedDocuments[index - 1] : null;
                const nextDocument = index < sortedDocuments.length - 1 ? sortedDocuments[index + 1] : null;
                
                // Check if this is the last child in a group
                const isLastChild = isChild && (!nextDocument || !nextDocument.is_split_document || nextDocument.parent_doc_id !== document.parent_doc_id);
                
                return (
                  <tr key={document.id} className={`border-b border-neutral-100 hover:bg-neutral-50 ${
                    isChild ? 'bg-blue-50/20 border-l-4 border-l-blue-200' : 
                    document.split_count ? 'bg-green-50/20 border-l-4 border-l-green-200' : ''
                  }`}>
                    <td className="p-4 body-text text-neutral-900" data-testid={`loan-${document.id}`}>
                      <div className={`flex items-center ${isChild ? 'pl-4' : ''}`}>
                        {isChild && (
                          <div className="flex items-center mr-3 text-blue-400">
                            <div className="w-4 h-4 flex items-center justify-center">
                              {isLastChild ? '└─' : '├─'}
                            </div>
                          </div>
                        )}
                        {document.xp_loan_number}
                      </div>
                    </td>
                    <td className="p-4 body-text text-neutral-700" data-testid={`type-${document.id}`}>
                      <div className={`flex items-center ${isChild ? 'pl-4' : ''}`}>
                        {isChild && (
                          <div className="flex items-center mr-3 text-blue-400">
                            <div className="w-4 h-4 flex items-center justify-center text-xs">
                              {isLastChild ? '└─' : '├─'}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          {document.document_type}
                          {isChild && <span className="text-xs text-blue-500 bg-blue-100 px-1 rounded">from blob</span>}
                          {document.split_count && <span className="text-xs text-green-500 bg-green-100 px-1 rounded">splits to {document.split_count}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 code-text text-neutral-600" data-testid={`doc-id-${document.id}`}>
                      <div className={`${isChild ? 'pl-4' : ''}`}>
                        {isChild && (
                          <div className="flex items-center mr-3 text-blue-400">
                            <div className="w-4 h-4 flex items-center justify-center text-xs">
                              {isLastChild ? '└─' : '├─'}
                            </div>
                          </div>
                        )}
                        {document.xp_doc_id}
                      </div>
                    </td>
                    <td className="p-4" data-testid={`source-${document.id}`}>
                      {document.parent_doc_id ? (
                        <div className="flex items-center space-x-2">
                          <FileText className="w-3 h-3 text-blue-500" />
                          <span className="text-xs text-blue-600">← {document.parent_doc_id}</span>
                        </div>
                      ) : document.split_count ? (
                        <div className="flex items-center space-x-2">
                          <Files className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-green-600">→ Split → {document.split_count}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">Single</span>
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
              })}
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