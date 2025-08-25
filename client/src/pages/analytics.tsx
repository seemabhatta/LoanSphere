import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useState } from "react";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState('30');

  const { data: performanceSummary } = useQuery({
    queryKey: ['/api/metrics/performance/summary'],
    refetchInterval: 60000
  });

  const { data: dashboardMetrics } = useQuery({
    queryKey: ['/api/metrics/dashboard'],
    refetchInterval: 30000
  });

  const { data: fpyTrend } = useQuery({
    queryKey: ['/api/metrics/trends/first_pass_yield', { days: parseInt(timeRange) }],
    refetchInterval: 300000
  });

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'boarding_completion_rate':
        return <CheckCircle className="w-6 h-6" />;
      case 'exception_resolution_rate':
        return <AlertTriangle className="w-6 h-6" />;
      case 'compliance_completion_rate':
        return <Target className="w-6 h-6" />;
      default:
        return <BarChart3 className="w-6 h-6" />;
    }
  };

  const getMetricColor = (value: number, threshold: number = 90) => {
    if (value >= threshold) return 'text-success';
    if (value >= threshold * 0.8) return 'text-warning';
    return 'text-error';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center text-sm text-gray-500 mb-1">
          <span>Loan Boarding</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Analytics</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900" data-testid="page-title">
              Analytics
            </h1>
            <p className="text-gray-500 mt-1">
              Performance insights and trends
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]" data-testid="select-timerange">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="detailed" data-testid="tab-detailed">Detailed</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Boarding Completion Rate</p>
                      <p className={`text-3xl font-bold mt-2 ${getMetricColor(performanceSummary?.summary?.boarding_completion_rate || 0)}`} data-testid="kpi-boarding">
                        {performanceSummary?.summary?.boarding_completion_rate || 0}%
                      </p>
                      <div className="flex items-center mt-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-success mr-1" />
                        <span className="text-success">+2.3% vs last period</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Exception Resolution Rate</p>
                      <p className={`text-3xl font-bold mt-2 ${getMetricColor(performanceSummary?.summary?.exception_resolution_rate || 0, 85)}`} data-testid="kpi-exceptions">
                        {performanceSummary?.summary?.exception_resolution_rate || 0}%
                      </p>
                      <div className="flex items-center mt-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-success mr-1" />
                        <span className="text-success">+1.7% vs last period</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-neutral-500 text-sm font-medium">Compliance Rate</p>
                      <p className={`text-3xl font-bold mt-2 ${getMetricColor(performanceSummary?.summary?.compliance_completion_rate || 0, 95)}`} data-testid="kpi-compliance">
                        {performanceSummary?.summary?.compliance_completion_rate || 0}%
                      </p>
                      <div className="flex items-center mt-2 text-sm">
                        <TrendingDown className="w-4 h-4 text-error mr-1" />
                        <span className="text-error">-0.5% vs last period</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Current Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <h3 className="font-medium text-neutral-800 mb-1">Avg Time-to-Board</h3>
                    <p className="text-2xl font-bold text-blue-600" data-testid="metric-ttb">
                      {dashboardMetrics?.loan_metrics?.ttb || 0}h
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Target: 2.0h</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <h3 className="font-medium text-neutral-800 mb-1">First-Pass Yield</h3>
                    <p className="text-2xl font-bold text-green-600" data-testid="metric-fpy">
                      {dashboardMetrics?.loan_metrics?.fpy || 0}%
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Target: 90%</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <BarChart3 className="w-8 h-8 text-cyan-500 mx-auto mb-2" />
                    <h3 className="font-medium text-neutral-800 mb-1">Auto-Clear Rate</h3>
                    <p className="text-2xl font-bold text-cyan-600" data-testid="metric-autoclear">
                      {dashboardMetrics?.loan_metrics?.auto_clear_rate || 0}%
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Target: 75%</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                    <h3 className="font-medium text-neutral-800 mb-1">Open Exceptions</h3>
                    <p className="text-2xl font-bold text-orange-600" data-testid="metric-exceptions">
                      {dashboardMetrics?.loan_metrics?.open_exceptions || 0}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">Target: &lt;10</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Volume Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Volume Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <h3 className="text-lg font-medium text-neutral-800 mb-2">Total Loans</h3>
                    <p className="text-3xl font-bold text-neutral-800" data-testid="volume-total-loans">
                      {performanceSummary?.summary?.total_loans || 0}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-neutral-800 mb-2">Total Exceptions</h3>
                    <p className="text-3xl font-bold text-neutral-800" data-testid="volume-total-exceptions">
                      {performanceSummary?.summary?.total_exceptions || 0}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-neutral-800 mb-2">Compliance Events</h3>
                    <p className="text-3xl font-bold text-neutral-800" data-testid="volume-compliance-events">
                      {performanceSummary?.summary?.total_compliance_events || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-neutral-50 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 text-neutral-400 mx-auto mb-2" />
                    <p className="text-neutral-500">Trend charts coming soon</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {fpyTrend?.data_points?.length || 0} data points available for {timeRange} days
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detailed" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-neutral-500">
                  Detailed analytics dashboard coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
