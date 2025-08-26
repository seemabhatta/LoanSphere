import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { 
  Zap, 
  Download, 
  Play, 
  Settings, 
  FileText,
  Database,
  TrendingUp,
  Shield,
  CheckCircle,
  Clock
} from "lucide-react";

export default function SyntheticData() {
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedCount, setGeneratedCount] = useState(0);
  const queryClient = useQueryClient();

  // Form state
  const [dataType, setDataType] = useState("loans");
  const [recordCount, setRecordCount] = useState("100");
  const [complexityLevel, setComplexityLevel] = useState("medium");
  const [includeExceptions, setIncludeExceptions] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // Generation mutation
  const generateMutation = useMutation({
    mutationFn: async (config: any) => {
      setGenerationInProgress(true);
      setProgress(0);
      
      // Simulate generation progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      clearInterval(progressInterval);
      setProgress(100);
      setGeneratedCount(parseInt(recordCount));
      
      return { success: true, count: parseInt(recordCount) };
    },
    onSuccess: (data) => {
      toast({ 
        title: "Success", 
        description: `Generated ${data.count} synthetic ${dataType} records successfully` 
      });
      setGenerationInProgress(false);
      queryClient.invalidateQueries({ queryKey: ['/api/loans'] });
      queryClient.invalidateQueries({ queryKey: ['/api/commitments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to generate synthetic data. Please try again." 
      });
      setGenerationInProgress(false);
      setProgress(0);
    }
  });

  const handleGenerate = () => {
    const config = {
      dataType,
      recordCount: parseInt(recordCount),
      complexityLevel,
      includeExceptions,
      customPrompt
    };
    
    generateMutation.mutate(config);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-header">Synthetic Data Generation</h1>
              <p className="detail-text text-gray-600 mt-1">
                Generate realistic synthetic loan data for testing and development
              </p>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Generation Progress */}
            {generationInProgress && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Generating Synthetic Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <p className="detail-text text-gray-600">
                    Generating {recordCount} synthetic {dataType} records with {complexityLevel} complexity...
                  </p>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="generator" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="generator">Data Generator</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
                <TabsTrigger value="history">Generation History</TabsTrigger>
              </TabsList>

              {/* Generator Tab */}
              <TabsContent value="generator" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Configuration Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Generation Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Data Type</Label>
                        <Select value={dataType} onValueChange={setDataType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="loans">Loan Records</SelectItem>
                            <SelectItem value="commitments">Commitments</SelectItem>
                            <SelectItem value="documents">Documents</SelectItem>
                            <SelectItem value="borrowers">Borrower Profiles</SelectItem>
                            <SelectItem value="properties">Property Data</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Number of Records</Label>
                        <Select value={recordCount} onValueChange={setRecordCount}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 records</SelectItem>
                            <SelectItem value="50">50 records</SelectItem>
                            <SelectItem value="100">100 records</SelectItem>
                            <SelectItem value="500">500 records</SelectItem>
                            <SelectItem value="1000">1,000 records</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Complexity Level</Label>
                        <Select value={complexityLevel} onValueChange={setComplexityLevel}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple">Simple - Basic fields only</SelectItem>
                            <SelectItem value="medium">Medium - Standard complexity</SelectItem>
                            <SelectItem value="complex">Complex - Full data relationships</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Custom Requirements</Label>
                        <Textarea
                          placeholder="e.g., Include VA loans, focus on California properties, add specific exception scenarios..."
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <Button 
                        onClick={handleGenerate}
                        disabled={generationInProgress}
                        className="w-full"
                        data-testid="button-generate"
                      >
                        {generationInProgress ? (
                          <>
                            <Clock className="w-4 h-4 mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Generate Data
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Preview Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Data Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {generatedCount > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="detail-text">
                              Successfully generated {generatedCount} records
                            </span>
                          </div>
                          
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="detail-text text-gray-600">Data Type:</span>
                                  <span className="ml-2 font-medium">{dataType}</span>
                                </div>
                                <div>
                                  <span className="detail-text text-gray-600">Records:</span>
                                  <span className="ml-2 font-medium">{generatedCount}</span>
                                </div>
                                <div>
                                  <span className="detail-text text-gray-600">Complexity:</span>
                                  <span className="ml-2 font-medium">{complexityLevel}</span>
                                </div>
                                <div>
                                  <span className="detail-text text-gray-600">Status:</span>
                                  <span className="ml-2 font-medium text-green-600">Ready</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <Button variant="outline" className="w-full">
                            <Download className="w-4 h-4 mr-2" />
                            Export Data
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p>Generated data will appear here</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="metric-medium text-blue-600">2.5K</div>
                        <div className="detail-text text-gray-500">Records Generated Today</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="metric-medium text-green-600">98.5%</div>
                        <div className="detail-text text-gray-500">Quality Score</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="metric-medium text-purple-600">12</div>
                        <div className="detail-text text-gray-500">Active Templates</div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="metric-medium text-orange-600">1.2s</div>
                        <div className="detail-text text-gray-500">Avg Generation Time</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Data Templates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      <Settings className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>Custom data templates coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Generation History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-gray-500">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p>Generation history and analytics coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
    </div>
  );
}