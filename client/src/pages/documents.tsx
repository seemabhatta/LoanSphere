import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageWithAssistant from "@/components/page-with-assistant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  FileText,
  Eye,
  ArrowUpDown,
  Upload,
  File,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface Document {
  id: string;
  xp_doc_id: string;
  xp_loan_number: string;
  document_type: string;
  status: string;
  ocr_status?: string;
  classification_status?: string;
  extraction_status?: string;
  validation_status?: string;
  created_at: string;
  updated_at: string;
  extracted_data?: any;
}

export default function Documents() {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // Upload states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState("");
  const [loanNumber, setLoanNumber] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const queryClient = useQueryClient();

  const { data: documentsData, refetch: refetchDocuments } = useQuery({
    queryKey: ['/api/documents'],
    queryFn: async () => {
      const response = await fetch('/api/documents/');
      if (!response.ok) {
        throw new Error('Failed to fetch documents data');
      }
      return response.json();
    },
    refetchInterval: 10000
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
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

  const getSortedDocuments = () => {
    if (!documentsData?.documents) return [];
    
    const documents = [...documentsData.documents];
    
    if (sortField) {
      documents.sort((a, b) => {
        let aValue = a[sortField as keyof Document];
        let bValue = b[sortField as keyof Document];
        
        // Handle different data types
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return documents;
  };

  const handleViewDetails = (document: Document) => {
    setSelectedDocument(document);
    setIsDetailsOpen(true);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // File upload handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (uploadData: { files: File[], documentType: string, loanNumber: string }) => {
      const formData = new FormData();
      uploadData.files.forEach((file, index) => {
        formData.append(`files`, file);
      });
      formData.append('document_type', uploadData.documentType);
      formData.append('loan_number', uploadData.loanNumber);

      // Simulate upload with progress
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: `Successfully uploaded ${selectedFiles.length} document(s)`,
      });
      setSelectedFiles([]);
      setDocumentType("");
      setLoanNumber("");
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: (error) => {
      toast({
        title: "Upload Error",
        description: "Failed to upload documents. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one file to upload.",
        variant: "destructive",
      });
      return;
    }
    
    if (!documentType) {
      toast({
        title: "Document Type Required",
        description: "Please select a document type.",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ files: selectedFiles, documentType, loanNumber });
  };

  const sortedDocuments = getSortedDocuments();

  return (
    <PageWithAssistant pageName="Documents">
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Data & Docs</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Documents</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              Documents
            </h1>
            <p className="text-gray-500 mt-1">
              View and manage processed documents
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Total: {documentsData?.total || 0}</span>
              <span>•</span>
              <span>Auto-refresh: 10s</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="section-header flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Selection */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">Select Files</Label>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.txt"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                  data-testid="input-file-upload"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document-type">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger id="document-type" data-testid="select-document-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loan-application">Loan Application</SelectItem>
                    <SelectItem value="income-verification">Income Verification</SelectItem>
                    <SelectItem value="property-appraisal">Property Appraisal</SelectItem>
                    <SelectItem value="credit-report">Credit Report</SelectItem>
                    <SelectItem value="bank-statements">Bank Statements</SelectItem>
                    <SelectItem value="tax-returns">Tax Returns</SelectItem>
                    <SelectItem value="employment-verification">Employment Verification</SelectItem>
                    <SelectItem value="insurance">Insurance Documents</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="loan-number">Loan Number (Optional)</Label>
                <Input
                  id="loan-number"
                  value={loanNumber}
                  onChange={(e) => setLoanNumber(e.target.value)}
                  placeholder="e.g., XP-2024-001"
                  data-testid="input-loan-number"
                />
              </div>
            </div>

            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({selectedFiles.length})</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-blue-500" />
                        <span className="text-sm truncate">{file.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFile(index)}
                        className="h-6 w-6 p-0"
                        data-testid={`button-remove-file-${index}`}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending || selectedFiles.length === 0}
                className="min-w-32"
                data-testid="button-upload-documents"
              >
                {uploadMutation.isPending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}` : 'Files'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle className="section-header">Documents List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('xp_doc_id')}
                        className="text-xs font-bold text-gray-700 hover:text-gray-900 p-0 h-auto"
                        data-testid="sort-doc-id"
                      >
                        Document ID
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('xp_loan_number')}
                        className="text-xs font-bold text-gray-700 hover:text-gray-900 p-0 h-auto"
                        data-testid="sort-loan-number"
                      >
                        Loan Number
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('document_type')}
                        className="text-xs font-bold text-gray-700 hover:text-gray-900 p-0 h-auto"
                        data-testid="sort-document-type"
                      >
                        Document Type
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('status')}
                        className="text-xs font-bold text-gray-700 hover:text-gray-900 p-0 h-auto"
                        data-testid="sort-status"
                      >
                        Status
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleSort('created_at')}
                        className="text-xs font-bold text-gray-700 hover:text-gray-900 p-0 h-auto"
                        data-testid="sort-created"
                      >
                        Created Date
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </th>
                    <th className="text-left py-3 px-4">
                      <span className="text-xs font-bold text-gray-700">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDocuments.map((document: Document) => (
                    <tr key={document.id} className="border-b border-gray-100 hover:bg-gray-50" data-testid={`document-row-${document.id}`}>
                      <td className="py-3 px-4 text-xs font-mono">{document.xp_doc_id}</td>
                      <td className="py-3 px-4 text-xs font-mono">{document.xp_loan_number}</td>
                      <td className="py-3 px-4 text-xs">{document.document_type}</td>
                      <td className="py-3 px-4">
                        <Badge className={`text-xs ${getStatusColor(document.status)}`}>
                          {document.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs">{formatDate(document.created_at)}</td>
                      <td className="py-3 px-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(document)}
                          className="text-xs"
                          data-testid={`button-view-${document.id}`}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {!sortedDocuments.length && (
                <div className="text-center py-8 text-gray-500" data-testid="no-documents">
                  <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p>No documents found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-document-details">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Document Details</span>
            </DialogTitle>
            <DialogDescription>
              Detailed information for document {selectedDocument?.xp_doc_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDocument && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Document ID</label>
                  <p className="text-sm font-mono mt-1" data-testid="detail-doc-id">{selectedDocument.xp_doc_id}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Loan Number</label>
                  <p className="text-sm font-mono mt-1" data-testid="detail-loan-number">{selectedDocument.xp_loan_number}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Document Type</label>
                  <p className="text-sm mt-1" data-testid="detail-document-type">{selectedDocument.document_type}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Status</label>
                  <div className="mt-1">
                    <Badge className={`text-xs ${getStatusColor(selectedDocument.status)}`}>
                      {selectedDocument.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Created Date</label>
                  <p className="text-sm mt-1" data-testid="detail-created">{formatDate(selectedDocument.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Updated Date</label>
                  <p className="text-sm mt-1" data-testid="detail-updated">{formatDate(selectedDocument.updated_at)}</p>
                </div>
              </div>

              {/* Processing Status */}
              {(selectedDocument.ocr_status || selectedDocument.classification_status || selectedDocument.extraction_status || selectedDocument.validation_status) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Processing Status</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedDocument.ocr_status && (
                      <div>
                        <label className="text-xs text-gray-600">OCR</label>
                        <Badge className={`block text-xs mt-1 ${getStatusColor(selectedDocument.ocr_status)}`}>
                          {selectedDocument.ocr_status}
                        </Badge>
                      </div>
                    )}
                    {selectedDocument.classification_status && (
                      <div>
                        <label className="text-xs text-gray-600">Classification</label>
                        <Badge className={`block text-xs mt-1 ${getStatusColor(selectedDocument.classification_status)}`}>
                          {selectedDocument.classification_status}
                        </Badge>
                      </div>
                    )}
                    {selectedDocument.extraction_status && (
                      <div>
                        <label className="text-xs text-gray-600">Extraction</label>
                        <Badge className={`block text-xs mt-1 ${getStatusColor(selectedDocument.extraction_status)}`}>
                          {selectedDocument.extraction_status}
                        </Badge>
                      </div>
                    )}
                    {selectedDocument.validation_status && (
                      <div>
                        <label className="text-xs text-gray-600">Validation</label>
                        <Badge className={`block text-xs mt-1 ${getStatusColor(selectedDocument.validation_status)}`}>
                          {selectedDocument.validation_status}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Extracted Data */}
              {selectedDocument.extracted_data && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Extracted Data</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-xs text-gray-800 whitespace-pre-wrap" data-testid="detail-extracted-data">
                      {JSON.stringify(selectedDocument.extracted_data, null, 2)}
                    </pre>
                  </div>
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