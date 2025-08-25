import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye, Tags, Database, CheckCircle } from "lucide-react";

interface ProcessingStage {
  queue: number;
  completed: number;
  progress: number;
}

interface DocumentProcessingStatus {
  ocr_processing?: ProcessingStage;
  classification?: ProcessingStage;
  extraction?: ProcessingStage;
  validation?: ProcessingStage;
}

interface DocumentProcessingProps {
  status: DocumentProcessingStatus;
}

export default function DocumentProcessing({ status }: DocumentProcessingProps) {
  const stages = [
    {
      name: "OCR Processing",
      icon: Eye,
      color: "primary",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
      data: status.ocr_processing
    },
    {
      name: "Classification", 
      icon: Tags,
      color: "secondary",
      bgColor: "bg-secondary/10", 
      textColor: "text-secondary",
      data: status.classification
    },
    {
      name: "Data Extraction",
      icon: Database,
      color: "success",
      bgColor: "bg-success/10",
      textColor: "text-success", 
      data: status.extraction
    },
    {
      name: "Validation",
      icon: CheckCircle,
      color: "warning", 
      bgColor: "bg-warning/10",
      textColor: "text-warning",
      data: status.validation
    }
  ];

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-neutral-800">
            Document Processing Pipeline
          </CardTitle>
          <div className="flex space-x-2">
            <span className="text-xs text-neutral-500">Last updated: 2 min ago</span>
            <Button 
              variant="link" 
              size="sm" 
              className="text-primary hover:underline text-xs"
              data-testid="button-refresh"
            >
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stages.map((stage) => (
            <div 
              key={stage.name}
              className="text-center"
              data-testid={`stage-${stage.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className={`w-16 h-16 ${stage.bgColor} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                <stage.icon className={`${stage.textColor} text-2xl w-8 h-8`} />
              </div>
              <h4 className="font-medium text-neutral-800 mb-2">{stage.name}</h4>
              <div className={`text-2xl font-bold ${stage.textColor} mb-1`}>
                {stage.data?.queue || 0}
              </div>
              <p className="text-xs text-neutral-500">
                {stage.name === "OCR Processing" ? "Documents in queue" :
                 stage.name === "Classification" ? "Documents classified" :
                 stage.name === "Data Extraction" ? "Fields extracted" :
                 "Pending review"}
              </p>
              <div className="w-full bg-neutral-200 rounded-full h-1 mt-2">
                <div 
                  className={`h-1 rounded-full transition-all duration-500 ${
                    stage.color === 'primary' ? 'bg-primary' :
                    stage.color === 'secondary' ? 'bg-secondary' :
                    stage.color === 'success' ? 'bg-success' :
                    'bg-warning'
                  }`}
                  style={{ width: `${stage.data?.progress || 0}%` }}
                ></div>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {stage.data?.progress || 0}% complete
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
