import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Download, List, Trash2, File, Calendar, FileText, CheckCircle, Folder } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function SimpleStaging() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filename, setFilename] = useState<string>("");
  const queryClient = useQueryClient();

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

  // Stage file mutation
  const stageMutation = useMutation({
    mutationFn: async (fileData: { filename: string; type: string; data: any }) => {
      const response = await fetch("/api/simple/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fileData)
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "File staged successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/simple/list"] });
      setSelectedFile(null);
      setFilename("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to stage file", variant: "destructive" });
    }
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/simple/delete/${id}`, {
        method: "DELETE"
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "File deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/simple/list"] });
    }
  });

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);
      
      stageMutation.mutate({
        filename: filename || selectedFile.name,
        type: selectedFile.type || "application/json",
        data: data
      });
    } catch (error) {
      toast({ title: "Error", description: "Invalid JSON file", variant: "destructive" });
    }
  };

  const getFileTypeInfo = (filename: string) => {
    const name = filename.toLowerCase();
    if (name.includes("commitment")) {
      return { type: "Commitment", color: "bg-blue-100 text-blue-800", icon: Calendar };
    }
    if (name.includes("purchase")) {
      return { type: "Purchase Advice", color: "bg-green-100 text-green-800", icon: FileText };
    }
    if (name.includes("loan") || name.includes("uldd")) {
      return { type: "Loan Data", color: "bg-purple-100 text-purple-800", icon: CheckCircle };
    }
    if (name.includes("document")) {
      return { type: "Document", color: "bg-orange-100 text-orange-800", icon: Folder };
    }
    return { type: "Other", color: "bg-neutral-100 text-neutral-800", icon: File };
  };

  const handleDownload = async (id: string, filename: string) => {
    try {
      const response = await fetch(`/api/simple/download/${id}`);
      const result = await response.json();
      
      if (result.success) {
        const blob = new Blob([JSON.stringify(result.file.data, null, 2)], { 
          type: "application/json" 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to download file", variant: "destructive" });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div>
          <h2 className="text-2xl font-medium text-neutral-800">Simple Staging</h2>
          <p className="text-neutral-500 mt-1">Stage, list, and download files</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* 1. Stage Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Stage File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="filename">Filename (optional)</Label>
              <Input
                id="filename"
                placeholder="Enter filename..."
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="file">JSON File</Label>
              <Input
                id="file"
                type="file"
                accept=".json"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
            
            <Button 
              onClick={handleFileUpload}
              disabled={!selectedFile || stageMutation.isPending}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {stageMutation.isPending ? "Staging..." : "Stage File"}
            </Button>
          </CardContent>
        </Card>

        {/* 2. List Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              Staged Files ({stagedFiles?.total || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-neutral-500">Loading...</div>
            ) : stagedFiles?.files?.length > 0 ? (
              <div className="space-y-3">
                {stagedFiles.files.map((file: any) => {
                  const fileTypeInfo = getFileTypeInfo(file.filename);
                  const IconComponent = fileTypeInfo.icon;
                  
                  return (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-5 h-5 text-blue-500" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{file.filename}</p>
                            <Badge className={`text-xs ${fileTypeInfo.color}`}>
                              {fileTypeInfo.type}
                            </Badge>
                          </div>
                          <p className="text-sm text-neutral-500">
                            {file.type} • {Math.round(file.size / 1024)}KB • {new Date(file.uploadedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(file.id, file.filename)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(file.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-500">
                No staged files. Upload a file to get started.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}