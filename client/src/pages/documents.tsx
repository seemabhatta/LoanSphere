import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Eye, 
  Tags, 
  Database, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Search,
  Filter 
} from "lucide-react";

export default function Documents() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: documentsData } = useQuery({
    queryKey: ['/api/documents', { 
      status: statusFilter, 
      document_type: typeFilter,
      search: searchQuery 
    }],
    refetchInterval: 10000
  });

  const { data: pipelineData } = useQuery({
    queryKey: ['/api/documents/pipeline/status'],
    refetchInterval: 5000
  });

  const { data: statsData } = useQuery({
    queryKey: ['/api/documents/stats/summary'],
    refetchInterval: 30000
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

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      case 'pending':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium text-neutral-800" data-testid="page-title">
              Documents
            </h2>
            <p className="text-neutral-500 mt-1">
              Monitor document processing pipeline
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]" data-testid="filter-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]" data-testid="filter-type">
                  <SelectValue placeholder="Document Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Appraisal">Appraisal</SelectItem>
                  <SelectItem value="Income_Documentation">Income Docs</SelectItem>
                  <SelectItem value="Credit_Report">Credit Report</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="pipeline" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-6">
            {/* Processing Pipeline Status */}
            <Card>
              <CardHeader>
                <CardTitle>Document Processing Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* OCR Processing */}
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Eye className="text-blue-600 text-2xl w-8 h-8" />
                    </div>
                    <h4 className="font-medium text-neutral-800 mb-2">OCR Processing</h4>
                    <div className="text-2xl font-bold text-blue-600 mb-1" data-testid="ocr-queue">
                      {pipelineData?.ocr_processing?.queue || 0}
                    </div>
                    <p className="text-xs text-neutral-500">Documents in queue</p>
                    <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                      <div 
                        className="bg-blue-600 h-1 rounded-full transition-all duration-500" 
                        style={{ width: `${pipelineData?.ocr_processing?.progress || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {pipelineData?.ocr_processing?.progress || 0}% complete
                    </p>
                  </div>

                  {/* Classification */}
                  <div className="text-center">
                    <div className="w-16 h-16 bg-cyan-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Tags className="text-cyan-600 text-2xl w-8 h-8" />
                    </div>
                    <h4 className="font-medium text-neutral-800 mb-2">Classification</h4>
                    <div className="text-2xl font-bold text-cyan-600 mb-1" data-testid="classification-completed">
                      {pipelineData?.classification?.completed || 0}
                    </div>
                    <p className="text-xs text-neutral-500">Documents classified</p>
                    <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                      <div 
                        className="bg-cyan-600 h-1 rounded-full transition-all duration-500" 
                        style={{ width: `${pipelineData?.classification?.progress || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {pipelineData?.classification?.progress || 0}% complete
                    </p>
                  </div>

                  {/* Data Extraction */}
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <Database className="text-green-600 text-2xl w-8 h-8" />
                    </div>
                    <h4 className="font-medium text-neutral-800 mb-2">Data Extraction</h4>
                    <div className="text-2xl font-bold text-green-600 mb-1" data-testid="extraction-completed">
                      {pipelineData?.extraction?.completed || 0}
                    </div>
                    <p className="text-xs text-neutral-500">Fields extracted</p>
                    <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                      <div 
                        className="bg-green-600 h-1 rounded-full transition-all duration-500" 
                        style={{ width: `${pipelineData?.extraction?.progress || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {pipelineData?.extraction?.progress || 0}% complete
                    </p>
                  </div>

                  {/* Validation */}
                  <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="text-yellow-600 text-2xl w-8 h-8" />
                    </div>
                    <h4 className="font-medium text-neutral-800 mb-2">Validation</h4>
                    <div className="text-2xl font-bold text-yellow-600 mb-1" data-testid="validation-pending">
                      {pipelineData?.validation?.queue || 0}
                    </div>
                    <p className="text-xs text-neutral-500">Pending review</p>
                    <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                      <div 
                        className="bg-yellow-600 h-1 rounded-full transition-all duration-500" 
                        style={{ width: `${pipelineData?.validation?.progress || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {pipelineData?.validation?.progress || 0}% complete
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            {/* Documents List */}
            <Card>
              <CardHeader>
                <CardTitle>Document List</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documentsData?.documents?.map((document: any) => (
                    <div 
                      key={document.id}
                      className="border border-neutral-200 rounded-lg p-4"
                      data-testid={`document-${document.xp_doc_id}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <FileText className="w-5 h-5 text-gray-500" />
                            <h3 className="font-medium text-neutral-800">
                              {document.xp_doc_id}
                            </h3>
                            <Badge className={getStatusColor(document.status)}>
                              {document.status}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-neutral-500">Loan:</span>
                              <span className="ml-2 font-mono">
                                {document.xp_loan_number}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500">Type:</span>
                              <span className="ml-2">
                                {document.document_type}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500">Created:</span>
                              <span className="ml-2">
                                {new Date(document.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-500">Updated:</span>
                              <span className="ml-2">
                                {new Date(document.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Processing Stages */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-neutral-100">
                        <div className="flex items-center space-x-2">
                          <div className={getStageStatusColor(document.ocr_status)}>
                            {getStageIcon(document.ocr_status)}
                          </div>
                          <span className="text-sm text-neutral-600">OCR</span>
                          <span className={`text-xs ${getStageStatusColor(document.ocr_status)}`}>
                            {document.ocr_status}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className={getStageStatusColor(document.classification_status)}>
                            {getStageIcon(document.classification_status)}
                          </div>
                          <span className="text-sm text-neutral-600">Classification</span>
                          <span className={`text-xs ${getStageStatusColor(document.classification_status)}`}>
                            {document.classification_status}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className={getStageStatusColor(document.extraction_status)}>
                            {getStageIcon(document.extraction_status)}
                          </div>
                          <span className="text-sm text-neutral-600">Extraction</span>
                          <span className={`text-xs ${getStageStatusColor(document.extraction_status)}`}>
                            {document.extraction_status}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <div className={getStageStatusColor(document.validation_status)}>
                            {getStageIcon(document.validation_status)}
                          </div>
                          <span className="text-sm text-neutral-600">Validation</span>
                          <span className={`text-xs ${getStageStatusColor(document.validation_status)}`}>
                            {document.validation_status}
                          </span>
                        </div>
                      </div>
                      
                      {/* Extracted Data Preview */}
                      {document.extracted_data && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                          <h4 className="text-sm font-medium text-neutral-800 mb-2">Extracted Data</h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                            {Object.entries(document.extracted_data).map(([key, value]: [string, any]) => (
                              <div key={key}>
                                <span className="text-neutral-500">{key}:</span>
                                <span className="ml-2 font-mono">
                                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {!documentsData?.documents?.length && (
                    <div className="text-center py-8 text-neutral-500" data-testid="no-documents">
                      No documents found matching the current filters
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Total Documents</p>
                      <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-total">
                        {statsData?.total_documents || 0}
                      </p>
                    </div>
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Processing Rate</p>
                      <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-processing-rate">
                        {statsData?.processing_rate || 0}%
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Pending</p>
                      <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-pending">
                        {statsData?.by_status?.pending || 0}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Errors</p>
                      <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-errors">
                        {statsData?.by_status?.error || 0}
                      </p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Document Type Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Document Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(statsData?.by_type || {}).map(([type, count]: [string, any]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-neutral-700">{type}</span>
                      <div className="flex items-center space-x-3">
                        <div className="w-32 bg-neutral-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                            style={{ 
                              width: `${(count / (statsData?.total_documents || 1) * 100)}%` 
                            }}
                          ></div>
                        </div>
                        <span className="text-neutral-600 font-mono text-sm w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
