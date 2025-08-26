import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, FileText, Play, CheckCircle, ExternalLink, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function Scheduler() {
  const queryClient = useQueryClient();
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set());

  // Get staged files
  const { data: stagedFiles, isLoading } = useQuery({
    queryKey: ["/api/simple/list"],
    queryFn: async () => {
      const response = await fetch("/api/simple/list");
      if (!response.ok) {
        throw new Error("Failed to fetch staged files");
      }
      return response.json();
    },
    refetchInterval: 5000
  });

  // Get loan pipeline data to show processing results
  const { data: pipelineData } = useQuery({
    queryKey: ["/api/loans"],
    queryFn: async () => {
      const response = await fetch("/api/loans/");
      if (!response.ok) {
        throw new Error("Failed to fetch loans");
      }
      return response.json();
    },
    refetchInterval: 10000
  });

  // Process file mutation - actually integrate into loan boarding pipeline
  const processMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      // Download the file data
      const response = await fetch(`/api/simple/download/${id}`);
      const result = await response.json();
      
      if (result.success) {
        const fileData = result.file.data;
        
        // Use the loan tracking service for processing
        const stagingResponse = await fetch("/api/staging/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileData: fileData,
            fileType: type.includes("Commitment") ? "commitment" : 
                     type.includes("Loan") ? "loan_data" :
                     type.includes("Purchase") ? "purchase_advice" : "unknown",
            sourceFileId: id
          })
        });
        
        const stagingResult = await stagingResponse.json();
        
        if (stagingResult.success) {
          // Delete the staged file after successful processing
          await fetch(`/api/simple/delete/${id}`, {
            method: "DELETE"
          });
          
          return { 
            ...result, 
            processedType: type,
            loanId: stagingResult.loan?.id,
            xpLoanNumber: stagingResult.loan?.xpLoanNumber,
            boardingReadiness: stagingResult.loan?.boardingReadiness
          };
        }
        throw new Error(stagingResult.error || "Staging failed");
      }
      throw new Error("Failed to process");
    },
    onSuccess: (data, variables) => {
      // Mark file as processed
      setProcessedFiles(prev => new Set([...Array.from(prev), variables.id]));
      
      toast({ 
        title: "Processing Complete", 
        description: `${variables.type} added to loan pipeline (${data.xpLoanNumber})` 
      });
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/simple/list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
    },
    onError: (error: any, variables) => {
      toast({ 
        title: "Processing Failed", 
        description: `Failed to process ${variables.type}: ${error.message}`, 
        variant: "destructive" 
      });
    }
  });

  // Filter files by type (based on filename)
  const filterFilesByType = (files: any[], type: string) => {
    if (!files) return [];
    return files.filter((file: any) => 
      file.filename.toLowerCase().includes(type.toLowerCase()) ||
      file.type.includes(type)
    );
  };

  const commitmentFiles = filterFilesByType((stagedFiles as any)?.files || [], "commitment");
  const purchaseFiles = filterFilesByType((stagedFiles as any)?.files || [], "purchase");
  const loanDataFiles = filterFilesByType((stagedFiles as any)?.files || [], "loan");
  const documentFiles = filterFilesByType((stagedFiles as any)?.files || [], "document");

  const renderFileList = (files: any[], type: string) => (
    <div className="space-y-3">
      {files.length > 0 ? (
        files.map((file: any) => {
          const isProcessed = processedFiles.has(file.id);
          const isProcessing = processMutation.isPending;
          
          return (
            <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="label-text">{file.filename}</p>
                  <p className="caption-text text-gray-500">
                    {Math.round(file.size / 1024)}KB • {new Date(file.uploadedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isProcessed ? (
                  <>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Processed
                    </Badge>
                    <Button size="sm" variant="outline" asChild>
                      <a href="/" className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        View Pipeline
                      </a>
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="secondary">Staged</Badge>
                    <Button
                      size="sm"
                      onClick={() => processMutation.mutate({ id: file.id, type })}
                      disabled={isProcessing}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      {isProcessing ? "Processing..." : "Process"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p>No {type.toLowerCase()} files staged</p>
          <p className="caption-text text-gray-400 mt-1">
            Upload files to Simple Staging first
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center caption-text mb-1">
          <span>Loan Boarding</span>
          <span className="mx-2">›</span>
          <span className="body-text text-gray-900">Staging Scheduler</span>
        </div>
        <div>
          <h1 className="page-title text-gray-900">Staging Scheduler</h1>
          <p className="body-text text-gray-500 mt-1">Process staged files by type</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* Processing Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="section-header flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Processing Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="metric-large text-blue-600">{(stagedFiles as any)?.total || 0}</p>
                <p className="caption-text text-gray-500">Files Staged</p>
              </div>
              <div className="text-center">
                <p className="metric-large text-green-600">{processedFiles.size}</p>
                <p className="caption-text text-gray-500">Files Processed</p>
              </div>
              <div className="text-center">
                <p className="metric-large text-purple-600">{(pipelineData as any)?.loans?.length || 0}</p>
                <p className="caption-text text-gray-500">Active Loans</p>
              </div>
              <div className="text-center">
                <Button size="sm" variant="outline" asChild>
                  <a href="/" className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    View Command Center
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="commitment" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="commitment" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Commitment ({commitmentFiles.length})
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Purchase Advice ({purchaseFiles.length})
            </TabsTrigger>
            <TabsTrigger value="loan-data" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Loan Data ({loanDataFiles.length})
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents ({documentFiles.length})
            </TabsTrigger>
          </TabsList>

          {/* Commitment Tab */}
          <TabsContent value="commitment">
            <Card>
              <CardHeader>
                <CardTitle className="section-header">Commitment Files</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-neutral-500">Loading...</div>
                ) : (
                  renderFileList(commitmentFiles, "Commitment")
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Advice Tab */}
          <TabsContent value="purchase">
            <Card>
              <CardHeader>
                <CardTitle className="section-header">Purchase Advice Files</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-neutral-500">Loading...</div>
                ) : (
                  renderFileList(purchaseFiles, "Purchase Advice")
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loan Data Tab */}
          <TabsContent value="loan-data">
            <Card>
              <CardHeader>
                <CardTitle className="section-header">Loan Data Files</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-neutral-500">Loading...</div>
                ) : (
                  renderFileList(loanDataFiles, "Loan Data")
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle className="section-header">Document Files</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-neutral-500">Loading...</div>
                ) : (
                  renderFileList(documentFiles, "Documents")
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}