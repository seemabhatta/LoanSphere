import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Upload, 
  Download, 
  Database, 
  Plus, 
  Trash2, 
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle,
  Settings,
  Play
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function SampleData() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<string>("commitment");
  const [generateCount, setGenerateCount] = useState<number>(5);
  const queryClient = useQueryClient();

  // Fetch staged data summary
  const { data: stagedSummary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["/api/staging/staged/summary"],
    refetchInterval: 5000
  });

  // Generate synthetic data mutations
  const generateLoansMutation = useMutation({
    mutationFn: (count: number) => 
      fetch(`/api/staging/generate/loans/${count}`, { method: "POST" })
        .then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Synthetic loans generated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/staging/staged/summary"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const generateScenariosMutation = useMutation({
    mutationFn: () => 
      fetch("/api/staging/generate/scenarios", { method: "POST" })
        .then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Test scenarios generated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/staging/staged/summary"] });
    }
  });

  const loadFixturesMutation = useMutation({
    mutationFn: () => 
      fetch("/api/staging/load/fixtures", { method: "POST" })
        .then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Business rules and configurations loaded" });
    }
  });

  const clearStagedMutation = useMutation({
    mutationFn: () => 
      fetch("/api/staging/staged/clear", { method: "DELETE" })
        .then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Staged data cleared successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/staging/staged/summary"] });
    }
  });

  // Stage data mutations
  const stageCommitmentMutation = useMutation({
    mutationFn: (data: any) => 
      fetch("/api/staging/stage/commitment", { 
        method: "POST", 
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "Commitment data staged successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/staging/staged/summary"] });
    }
  });

  const stageUlddMutation = useMutation({
    mutationFn: (data: any) => 
      fetch("/api/staging/stage/uldd", { 
        method: "POST", 
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      }).then(res => res.json()),
    onSuccess: () => {
      toast({ title: "Success", description: "ULDD data staged successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/staging/staged/summary"] });
    }
  });

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({ title: "Error", description: "Please select a file", variant: "destructive" });
      return;
    }

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      if (uploadType === "commitment") {
        stageCommitmentMutation.mutate(data);
      } else if (uploadType === "uldd") {
        stageUlddMutation.mutate(data);
      }

      setSelectedFile(null);
    } catch (error) {
      toast({ title: "Error", description: "Invalid JSON file", variant: "destructive" });
    }
  };

  const downloadSampleFile = (type: string) => {
    const sampleData: { [key: string]: any } = {
      commitment: {
        commitmentId: "SAMPLE001",
        investorLoanNumber: "LN123456",
        sellerNumber: "SE001",
        servicerNumber: "SV001",
        commitmentDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        currentCommitmentAmount: 500000,
        product: { productType: "30Y Fixed" }
      },
      uldd: {
        loanIdentifier: { originalLoanNumber: "LN123456" },
        loanDetails: { noteAmount: 425000, interestRate: 0.0675 },
        borrower: { firstName: "John", lastName: "Smith", creditScore: 750 },
        property: { appraisedValue: 475000, ltvRatio: 0.8947 }
      }
    };

    const blob = new Blob([JSON.stringify(sampleData[type], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample-${type}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-medium text-neutral-800" data-testid="page-title">
              Sample Data Management
            </h2>
            <p className="text-neutral-500 mt-1">
              Generate, stage, and manage sample data for testing
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/staging/staged/summary"] })}
              variant="outline"
              size="sm"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="generate" data-testid="tab-generate">Generate</TabsTrigger>
            <TabsTrigger value="upload" data-testid="tab-upload">Upload</TabsTrigger>
            <TabsTrigger value="staged" data-testid="tab-staged">Staged</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Total Staged</p>
                      <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-total-staged">
                        {(stagedSummary as any)?.summary?.totalStaged || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Database className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Ready for Boarding</p>
                      <p className="text-3xl font-bold text-green-600 mt-2" data-testid="stat-ready-boarding">
                        {(stagedSummary as any)?.summary?.readyForBoarding || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Data Sources</p>
                      <p className="text-3xl font-bold text-neutral-800 mt-2" data-testid="stat-data-sources">
                        {Object.keys((stagedSummary as any)?.summary?.bySource || {}).length}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Settings className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Sources Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Data Sources Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries((stagedSummary as any)?.summary?.bySource || {}).map(([source, count]: [string, any]) => (
                    <div key={source} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-4 h-4 text-neutral-500" />
                        <span className="font-medium">{source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Generate Synthetic Loans</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="loan-count">Number of Loans</Label>
                    <Input
                      id="loan-count"
                      type="number"
                      value={generateCount}
                      onChange={(e) => setGenerateCount(parseInt(e.target.value) || 5)}
                      min="1"
                      max="50"
                      data-testid="input-loan-count"
                    />
                  </div>
                  <Button 
                    onClick={() => generateLoansMutation.mutate(generateCount)}
                    disabled={generateLoansMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-loans"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {generateLoansMutation.isPending ? "Generating..." : "Generate Loans"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Generate Test Scenarios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Creates realistic test scenarios including high-performing loans, problem loans, and document processing workflows.
                  </p>
                  <Button 
                    onClick={() => generateScenariosMutation.mutate()}
                    disabled={generateScenariosMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-scenarios"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {generateScenariosMutation.isPending ? "Generating..." : "Generate Scenarios"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Load Business Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Loads business rules, agency configurations, and validation packs into the system.
                  </p>
                  <Button 
                    onClick={() => loadFixturesMutation.mutate()}
                    disabled={loadFixturesMutation.isPending}
                    className="w-full"
                    data-testid="button-load-fixtures"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {loadFixturesMutation.isPending ? "Loading..." : "Load Fixtures"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clear Staged Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Removes all staged data from the system. This action cannot be undone.
                  </p>
                  <Button 
                    onClick={() => clearStagedMutation.mutate()}
                    disabled={clearStagedMutation.isPending}
                    variant="destructive"
                    className="w-full"
                    data-testid="button-clear-staged"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {clearStagedMutation.isPending ? "Clearing..." : "Clear All Staged"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Upload Sample Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="upload-type">Data Type</Label>
                    <Select value={uploadType} onValueChange={setUploadType}>
                      <SelectTrigger data-testid="select-upload-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commitment">Commitment Data</SelectItem>
                        <SelectItem value="uldd">ULDD Data</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="file-upload">JSON File</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".json"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      data-testid="input-file-upload"
                    />
                  </div>

                  <Button 
                    onClick={handleFileUpload}
                    disabled={!selectedFile || stageCommitmentMutation.isPending || stageUlddMutation.isPending}
                    className="w-full"
                    data-testid="button-upload-file"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {(stageCommitmentMutation.isPending || stageUlddMutation.isPending) ? "Uploading..." : "Upload File"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Download Sample Files</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-neutral-600">
                    Download sample JSON files to use as templates for your own data.
                  </p>
                  
                  <div className="space-y-2">
                    <Button 
                      onClick={() => downloadSampleFile("commitment")}
                      variant="outline"
                      className="w-full"
                      data-testid="button-download-commitment"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Sample Commitment
                    </Button>
                    
                    <Button 
                      onClick={() => downloadSampleFile("uldd")}
                      variant="outline"
                      className="w-full"
                      data-testid="button-download-uldd"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Sample ULDD
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Staged Tab */}
          <TabsContent value="staged" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Staged Data Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingSummary ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-neutral-500" />
                  </div>
                ) : (stagedSummary as any)?.stagedLoans?.length > 0 ? (
                  <div className="space-y-4">
                    {(stagedSummary as any).stagedLoans.map((loan: any) => (
                      <div key={loan.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{loan.xpLoanNumber}</p>
                            <p className="text-sm text-neutral-500">
                              {loan.sellerName} • {loan.status}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={loan.boardingReadiness === "ready" ? "default" : "secondary"}>
                            {loan.boardingReadiness}
                          </Badge>
                          {loan.boardingReadiness === "data_received" && (
                            <Button 
                              size="sm"
                              onClick={() => {
                                // Promote to active pipeline
                                fetch(`/api/staging/staged/${loan.id}/promote`, { method: "POST" })
                                  .then(() => {
                                    toast({ title: "Success", description: "Loan promoted to active pipeline" });
                                    queryClient.invalidateQueries({ queryKey: ["/api/staging/staged/summary"] });
                                  });
                              }}
                              data-testid="button-promote-loan"
                            >
                              Promote
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                    <p className="text-neutral-500">No staged data available</p>
                    <p className="text-sm text-neutral-400 mt-1">
                      Generate or upload sample data to get started
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}