import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Eye,
  Tags, 
  Database, 
  CheckCircle
} from "lucide-react";

export default function DocProcessing() {
  const { data: pipelineData } = useQuery({
    queryKey: ['/api/documents/pipeline/status'],
    queryFn: async () => {
      const response = await fetch('/api/documents/pipeline/status');
      if (!response.ok) {
        throw new Error('Failed to fetch pipeline status');
      }
      return response.json();
    },
    refetchInterval: 5000
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
              Monitor document processing stages and performance
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Auto-refresh: 5s</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Processing Pipeline Status */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* OCR Processing */}
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Eye className="text-blue-600 w-8 h-8" />
                </div>
                <h4 className="section-header text-neutral-800 mb-2">OCR Processing</h4>
                <div className="metric-large text-blue-600 mb-1" data-testid="ocr-queue">
                  {pipelineData?.ocr_processing?.queue || 0}
                </div>
                <p className="detail-text text-neutral-500">Documents in queue</p>
                <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                  <div 
                    className="bg-blue-600 h-1 rounded-full transition-all duration-500" 
                    style={{ width: `${pipelineData?.ocr_processing?.progress || 0}%` }}
                  ></div>
                </div>
                <p className="detail-text text-neutral-500 mt-1">
                  {pipelineData?.ocr_processing?.progress || 0}% complete
                </p>
              </div>

              {/* Classification */}
              <div className="text-center">
                <div className="w-16 h-16 bg-cyan-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Tags className="text-cyan-600 w-8 h-8" />
                </div>
                <h4 className="section-header text-neutral-800 mb-2">Classification</h4>
                <div className="metric-large text-cyan-600 mb-1" data-testid="classification-completed">
                  {pipelineData?.classification?.completed || 0}
                </div>
                <p className="detail-text text-neutral-500">Documents classified</p>
                <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                  <div 
                    className="bg-cyan-600 h-1 rounded-full transition-all duration-500" 
                    style={{ width: `${pipelineData?.classification?.progress || 0}%` }}
                  ></div>
                </div>
                <p className="detail-text text-neutral-500 mt-1">
                  {pipelineData?.classification?.progress || 0}% complete
                </p>
              </div>

              {/* Data Extraction */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Database className="text-green-600 w-8 h-8" />
                </div>
                <h4 className="section-header text-neutral-800 mb-2">Data Extraction</h4>
                <div className="metric-large text-green-600 mb-1" data-testid="extraction-completed">
                  {pipelineData?.extraction?.completed || 0}
                </div>
                <p className="detail-text text-neutral-500">Fields extracted</p>
                <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                  <div 
                    className="bg-green-600 h-1 rounded-full transition-all duration-500" 
                    style={{ width: `${pipelineData?.extraction?.progress || 0}%` }}
                  ></div>
                </div>
                <p className="detail-text text-neutral-500 mt-1">
                  {pipelineData?.extraction?.progress || 0}% complete
                </p>
              </div>

              {/* Validation */}
              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="text-yellow-600 w-8 h-8" />
                </div>
                <h4 className="section-header text-neutral-800 mb-2">Validation</h4>
                <div className="metric-large text-yellow-600 mb-1" data-testid="validation-pending">
                  {pipelineData?.validation?.queue || 0}
                </div>
                <p className="detail-text text-neutral-500">Pending review</p>
                <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                  <div 
                    className="bg-yellow-600 h-1 rounded-full transition-all duration-500" 
                    style={{ width: `${pipelineData?.validation?.progress || 0}%` }}
                  ></div>
                </div>
                <p className="detail-text text-neutral-500 mt-1">
                  {pipelineData?.validation?.progress || 0}% complete
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}