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
    <div className="space-y-4">
      {files.length > 0 ? (
        files.map((file: any) => {
          const isProcessed = processedFiles.has(file.id);
          const isProcessing = processMutation.isPending;
          
          // Define vibrant gradients based on file type
          const getFileGradient = (type: string) => {
            if (type.includes("Commitment")) return "bg-gradient-primary";
            if (type.includes("Purchase")) return "bg-gradient-cyber";
            if (type.includes("Loan")) return "bg-gradient-pink";
            return "bg-gradient-sunset";
          };

          const getStatusColor = (type: string) => {
            if (type.includes("Commitment")) return { bg: "bg-violet/10", text: "text-violet", border: "border-violet/20", emoji: "💜" };
            if (type.includes("Purchase")) return { bg: "bg-cyan/10", text: "text-cyan", border: "border-cyan/20", emoji: "🧊" };
            if (type.includes("Loan")) return { bg: "bg-pink/10", text: "text-pink", border: "border-pink/20", emoji: "💖" };
            return { bg: "bg-orange/10", text: "text-orange", border: "border-orange/20", emoji: "🔥" };
          };

          const statusColor = getStatusColor(type);
          
          return (
            <div key={file.id} className="interactive-card bg-gradient-card border border-neutral-200 rounded-xl p-6 hover:border-violet/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${getFileGradient(type)} rounded-xl flex items-center justify-center shadow-soft`}>
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-neutral-900 mb-1">{file.filename}</h4>
                    <div className="flex items-center gap-4 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        📁 {Math.round(file.size / 1024)}KB
                      </span>
                      <span className="flex items-center gap-1">
                        🕒 {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        ⏰ {new Date(file.uploadedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {isProcessed ? (
                    <>
                      <div className={`status-indicator ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium">✅ Processed</span>
                      </div>
                      <Button size="sm" variant="outline" className={`button-professional border-blue ${statusColor.text} hover:${statusColor.bg}`} asChild>
                        <a href="/" className="flex items-center gap-2">
                          <ExternalLink className="w-4 h-4" />
                          View Pipeline
                        </a>
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className={`status-indicator ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${statusColor.text.replace('text-', 'bg-')}`}></div>
                        <span className="font-medium">{statusColor.emoji} Staged</span>
                      </div>
                      <Button
                        size="sm"
                        className={`button-professional ${getFileGradient(type)} text-white shadow-soft border-0`}
                        onClick={() => processMutation.mutate({ id: file.id, type })}
                        disabled={isProcessing}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {isProcessing ? "⚡ Processing..." : "🚀 Process File"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-neutral-300" />
          </div>
          <h4 className="font-semibold text-neutral-600 mb-2">No {type.toLowerCase()} files staged</h4>
          <p className="text-sm text-neutral-500 mb-4">
            Upload files to Simple Staging to get started with processing
          </p>
          <Button variant="outline" size="sm" className="button-professional" asChild>
            <a href="/simple-staging" className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Go to Simple Staging
            </a>
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Vibrant Tech Header */}
      <header className="bg-gradient-to-r from-violet/5 via-pink/5 to-orange/5 border-b border-violet/20 px-8 py-6 shadow-soft backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 bg-gradient-sunset rounded-xl flex items-center justify-center shadow-soft">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-violet to-pink bg-clip-text text-transparent">
                  🚀 Loan Processing Scheduler
                </h2>
                <p className="text-neutral-600 font-medium">Automated multi-agent pipeline for mortgage loan boarding ⚡</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="status-indicator bg-cyan/10 text-cyan border border-cyan/20">
              <div className="w-2 h-2 bg-cyan rounded-full animate-pulse"></div>
              🟢 System Active
            </div>
            <div className="status-indicator bg-violet/10 text-violet border border-violet/20">
              <div className="w-2 h-2 bg-violet rounded-full animate-pulse"></div>
              💜 AI Enabled
            </div>
            <Button variant="outline" size="sm" className="button-professional bg-gradient-blue text-white border-0 shadow-soft">
              <ExternalLink className="w-4 h-4 mr-2" />
              🔗 View Pipeline
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        
        {/* Vibrant Processing Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="metric-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-soft">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="status-indicator bg-violet/10 text-violet border border-violet/20">
                🟣 Live
              </div>
            </div>
            <h3 className="text-3xl font-bold text-violet mb-1">{(stagedFiles as any)?.total || 0}</h3>
            <p className="text-neutral-600 font-medium">Files Staged</p>
            <div className="mt-4 w-full bg-neutral-200 rounded-full h-2">
              <div 
                className="bg-gradient-primary h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((((stagedFiles as any)?.total || 0) / 10) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-cyber rounded-xl flex items-center justify-center shadow-soft">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="status-indicator bg-cyan/10 text-cyan border border-cyan/20">
                🟢 +{processedFiles.size > 0 ? processedFiles.size : 0}
              </div>
            </div>
            <h3 className="text-3xl font-bold text-cyan mb-1">{processedFiles.size}</h3>
            <p className="text-neutral-600 font-medium">Files Processed</p>
            <div className="mt-4 w-full bg-neutral-200 rounded-full h-2">
              <div 
                className="bg-gradient-cyber h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((processedFiles.size / 10) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-sunset rounded-xl flex items-center justify-center shadow-soft">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div className="status-indicator bg-orange/10 text-orange border border-orange/20">
                🟠 Active
              </div>
            </div>
            <h3 className="text-3xl font-bold text-orange mb-1">{(pipelineData as any)?.loans?.length || 0}</h3>
            <p className="text-neutral-600 font-medium">Active Loans</p>
            <div className="mt-4 w-full bg-neutral-200 rounded-full h-2">
              <div 
                className="bg-gradient-sunset h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((((pipelineData as any)?.loans?.length || 0) / 20) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          
          <div className="metric-card">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-blue rounded-xl flex items-center justify-center shadow-soft">
                <ExternalLink className="w-6 h-6 text-white" />
              </div>
              <Button size="sm" variant="outline" className="button-professional border-blue text-blue hover:bg-blue/10" asChild>
                <a href="/">🔗 Dashboard</a>
              </Button>
            </div>
            <h3 className="text-lg font-semibold text-blue mb-1">Command Center</h3>
            <p className="text-neutral-600 font-medium">View Full Pipeline</p>
            <div className="mt-4">
              <Button variant="outline" size="sm" className="w-full button-professional bg-gradient-blue text-white border-0" asChild>
                <a href="/" className="flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open Dashboard
                </a>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Professional File Processing Tabs */}
        <div className="card-professional p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900">File Processing Pipeline</h3>
          </div>
          
          <Tabs defaultValue="commitment" className="space-y-8">
            <TabsList className="grid w-full max-w-4xl grid-cols-4 h-auto p-3 bg-gradient-to-r from-violet/5 to-blue/5 rounded-xl border border-violet/10">
              <TabsTrigger 
                value="commitment" 
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-soft transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">💜 Commitment</p>
                  <p className="text-xs opacity-75">({commitmentFiles.length} files)</p>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="purchase" 
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-lg data-[state=active]:bg-gradient-cyber data-[state=active]:text-white data-[state=active]:shadow-soft transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gradient-cyber rounded-lg flex items-center justify-center shadow-soft">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">🧊 Purchase Advice</p>
                  <p className="text-xs opacity-75">({purchaseFiles.length} files)</p>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="loan-data" 
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-lg data-[state=active]:bg-gradient-pink data-[state=active]:text-white data-[state=active]:shadow-soft transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gradient-pink rounded-lg flex items-center justify-center shadow-soft">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">💖 Loan Data</p>
                  <p className="text-xs opacity-75">({loanDataFiles.length} files)</p>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="documents" 
                className="flex flex-col items-center gap-2 py-4 px-6 rounded-lg data-[state=active]:bg-gradient-sunset data-[state=active]:text-white data-[state=active]:shadow-soft transition-all duration-200"
              >
                <div className="w-8 h-8 bg-gradient-sunset rounded-lg flex items-center justify-center shadow-soft">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm">🔥 Documents</p>
                  <p className="text-xs opacity-75">({documentFiles.length} files)</p>
                </div>
              </TabsTrigger>
            </TabsList>

          {/* Commitment Tab */}
          <TabsContent value="commitment">
            <Card>
              <CardHeader>
                <CardTitle>Commitment Files</CardTitle>
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
                <CardTitle>Purchase Advice Files</CardTitle>
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
                <CardTitle>Loan Data Files</CardTitle>
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
                <CardTitle>Document Files</CardTitle>
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
    </div>
  );
}