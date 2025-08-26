import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  FileText,
  Eye,
  Tags, 
  Database, 
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  ChevronRight
} from "lucide-react";

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
}

export default function DocProcessing() {
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

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'failed':
      case 'error':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const documents = documentsData?.documents || [];

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
              <span>•</span>
              <span>Auto-refresh: 10s</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {documents.map((document: DocumentProcessing) => (
          <Card key={document.id} className="border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              {/* Document Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Loan {document.xp_loan_number}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {document.document_type} • {document.xp_doc_id}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={`text-xs px-2 py-1 ${
                    document.status === 'completed' ? 'bg-green-100 text-green-800' :
                    document.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    document.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {document.status}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {formatDate(document.created_at)}
                  </span>
                </div>
              </div>

              {/* Processing Flow */}
              <div className="flex items-center justify-between space-x-2">
                {/* OCR Stage */}
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs ${getStageStatusColor(document.ocr_status)}`}>
                  <Eye className="w-4 h-4" />
                  <span className="font-medium">OCR</span>
                  {getStageIcon(document.ocr_status)}
                </div>
                
                <ChevronRight className="w-4 h-4 text-gray-400" />
                
                {/* Classification Stage */}
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs ${getStageStatusColor(document.classification_status)}`}>
                  <Tags className="w-4 h-4" />
                  <span className="font-medium">Classification</span>
                  {getStageIcon(document.classification_status)}
                </div>
                
                <ChevronRight className="w-4 h-4 text-gray-400" />
                
                {/* Extraction Stage */}
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs ${getStageStatusColor(document.extraction_status)}`}>
                  <Database className="w-4 h-4" />
                  <span className="font-medium">Extraction</span>
                  {getStageIcon(document.extraction_status)}
                </div>
                
                <ChevronRight className="w-4 h-4 text-gray-400" />
                
                {/* Validation Stage */}
                <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs ${getStageStatusColor(document.validation_status)}`}>
                  <CheckCircle className="w-4 h-4" />
                  <span className="font-medium">Validation</span>
                  {getStageIcon(document.validation_status)}
                </div>
              </div>

              {/* Processing Details */}
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">OCR:</span>
                  <span className={`ml-1 font-medium ${
                    document.ocr_status === 'completed' ? 'text-green-600' :
                    document.ocr_status === 'processing' ? 'text-blue-600' :
                    document.ocr_status === 'failed' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {document.ocr_status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Classification:</span>
                  <span className={`ml-1 font-medium ${
                    document.classification_status === 'completed' ? 'text-green-600' :
                    document.classification_status === 'processing' ? 'text-blue-600' :
                    document.classification_status === 'failed' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {document.classification_status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Extraction:</span>
                  <span className={`ml-1 font-medium ${
                    document.extraction_status === 'completed' ? 'text-green-600' :
                    document.extraction_status === 'processing' ? 'text-blue-600' :
                    document.extraction_status === 'failed' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {document.extraction_status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Validation:</span>
                  <span className={`ml-1 font-medium ${
                    document.validation_status === 'completed' ? 'text-green-600' :
                    document.validation_status === 'processing' ? 'text-blue-600' :
                    document.validation_status === 'failed' ? 'text-red-600' :
                    'text-yellow-600'
                  }`}>
                    {document.validation_status}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!documents.length && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No documents in processing pipeline</p>
          </div>
        )}
      </div>
    </div>
  );
}