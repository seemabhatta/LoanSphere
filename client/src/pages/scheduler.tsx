import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, FileText, Play, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function Scheduler() {
  const queryClient = useQueryClient();

  // Get staged files
  const { data: stagedFiles, isLoading } = useQuery({
    queryKey: ["/api/simple/list"],
    refetchInterval: 5000
  });

  // Process file mutation
  const processMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const response = await fetch(`/api/simple/download/${id}`);
      const result = await response.json();
      
      if (result.success) {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { ...result, processedType: type };
      }
      throw new Error("Failed to process");
    },
    onSuccess: (data, variables) => {
      toast({ 
        title: "Success", 
        description: `${variables.type} processed successfully` 
      });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to process file", 
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

  const commitmentFiles = filterFilesByType(stagedFiles?.files || [], "commitment");
  const purchaseFiles = filterFilesByType(stagedFiles?.files || [], "purchase");
  const loanDataFiles = filterFilesByType(stagedFiles?.files || [], "loan");
  const documentFiles = filterFilesByType(stagedFiles?.files || [], "document");

  const renderFileList = (files: any[], type: string) => (
    <div className="space-y-3">
      {files.length > 0 ? (
        files.map((file: any) => (
          <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500" />
              <div>
                <p className="font-medium">{file.filename}</p>
                <p className="text-sm text-neutral-500">
                  {Math.round(file.size / 1024)}KB • {new Date(file.uploadedAt).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Staged</Badge>
              <Button
                size="sm"
                onClick={() => processMutation.mutate({ id: file.id, type })}
                disabled={processMutation.isPending}
              >
                <Play className="w-4 h-4 mr-1" />
                Process
              </Button>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-neutral-500">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <p>No {type.toLowerCase()} files staged</p>
          <p className="text-sm text-neutral-400 mt-1">
            Upload files to Simple Staging first
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div>
          <h2 className="text-2xl font-medium text-neutral-800">Scheduler</h2>
          <p className="text-neutral-500 mt-1">Process staged files by type</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
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
  );
}