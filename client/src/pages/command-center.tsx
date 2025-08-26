import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Activity,
  FileText,
  Users,
  Target,
  Zap,
  RefreshCw,
  Play
} from "lucide-react";

interface SystemStatus {
  status: 'healthy' | 'warning' | 'critical';
  uptime: string;
  activeAgents: number;
  totalAgents: number;
}

interface KPI {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  target?: string;
}

interface RecentActivity {
  id: string;
  type: 'loan_boarded' | 'exception_resolved' | 'document_processed' | 'compliance_check';
  message: string;
  timestamp: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

interface CriticalException {
  id: string;
  loanNumber: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  age: string;
  autoFix: boolean;
}

export default function CommandCenter() {
  const { data: systemStatus } = useQuery({
    queryKey: ['/api/system/status'],
    queryFn: async () => ({
      status: 'healthy' as const,
      uptime: '23h 45m',
      activeAgents: 4,
      totalAgents: 4
    }),
    refetchInterval: 10000
  });

  const { data: kpis } = useQuery({
    queryKey: ['/api/metrics/kpis'],
    queryFn: async () => ([
      { label: 'First-Pass Yield', value: '87.3%', change: '+2.1%', trend: 'up' as const, target: '85%' },
      { label: 'Time to Board', value: '1.8h', change: '-0.3h', trend: 'up' as const, target: '2h' },
      { label: 'Exception Auto-Clear', value: '73%', change: '+5%', trend: 'up' as const, target: '70%' },
      { label: 'Compliance Score', value: '100%', change: '0%', trend: 'neutral' as const, target: '100%' },
    ]),
    refetchInterval: 30000
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['/api/activity/recent'],
    queryFn: async () => ([
      { id: '1', type: 'loan_boarded' as const, message: 'Loan XP12351 successfully boarded', timestamp: '2 min ago', severity: 'success' as const },
      { id: '2', type: 'exception_resolved' as const, message: 'Auto-fixed rate mismatch in XP12346', timestamp: '5 min ago', severity: 'success' as const },
      { id: '3', type: 'document_processed' as const, message: 'W-2 documents processed for XP12345', timestamp: '8 min ago', severity: 'info' as const },
      { id: '4', type: 'compliance_check' as const, message: 'RESPA compliance verified for batch #247', timestamp: '12 min ago', severity: 'success' as const },
      { id: '5', type: 'exception_resolved' as const, message: 'Manual review completed for XP12349', timestamp: '15 min ago', severity: 'warning' as const },
    ]),
    refetchInterval: 15000
  });

  const { data: criticalExceptions } = useQuery({
    queryKey: ['/api/exceptions/critical'],
    queryFn: async () => ([
      { id: '1', loanNumber: 'XP12345', description: 'Missing W-2 Documents', severity: 'HIGH' as const, age: '2 days', autoFix: false },
      { id: '2', loanNumber: 'XP12347', description: 'DTI Ratio Exceeds Guidelines', severity: 'MEDIUM' as const, age: '1 day', autoFix: false },
      { id: '3', loanNumber: 'XP12348', description: 'API Connection Failed', severity: 'LOW' as const, age: '4 hours', autoFix: true },
    ]),
    refetchInterval: 15000
  });

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'loan_boarded': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'exception_resolved': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case 'document_processed': return <FileText className="w-4 h-4 text-purple-600" />;
      case 'compliance_check': return <Target className="w-4 h-4 text-orange-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: SystemStatus['status']) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
    }
  };

  const getSeverityColor = (severity: CriticalException['severity']) => {
    switch (severity) {
      case 'HIGH': return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'LOW': return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center caption-text mb-1">
              <span className="text-gray-500">Command Center</span>
            </div>
            <h1 className="page-title text-gray-900" data-testid="page-title">
              Mission Control
            </h1>
            <p className="body-text text-gray-500 mt-1">
              Real-time operational dashboard and system overview
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm" data-testid="button-refresh">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button size="sm" data-testid="button-start-boarding">
              <Play className="w-4 h-4 mr-2" />
              Start Boarding
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* System Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Badge className={getStatusColor(systemStatus?.status || 'healthy')}>
                    {systemStatus?.status?.toUpperCase() || 'HEALTHY'}
                  </Badge>
                  <span className="detail-text text-gray-600">
                    Uptime: {systemStatus?.uptime || '0h 0m'}
                  </span>
                  <span className="detail-text text-gray-600">
                    Agents: {systemStatus?.activeAgents || 0}/{systemStatus?.totalAgents || 0} Active
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-green-600" />
                  <span className="detail-text text-green-600 font-medium">All Systems Operational</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis?.map((kpi, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="detail-text text-gray-600">{kpi.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                      {kpi.target && (
                        <p className="detail-text text-gray-500 mt-1">Target: {kpi.target}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      {kpi.trend === 'up' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : kpi.trend === 'down' ? (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      <p className={`detail-text font-medium mt-1 ${
                        kpi.trend === 'up' ? 'text-green-600' : 
                        kpi.trend === 'down' ? 'text-red-600' : 
                        'text-gray-600'
                      }`}>
                        {kpi.change}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Critical Exceptions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                    Critical Exceptions
                  </div>
                  <Badge variant="secondary">{criticalExceptions?.length || 0}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {criticalExceptions?.map((exception) => (
                    <div key={exception.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <Badge className={getSeverityColor(exception.severity)}>
                            {exception.severity}
                          </Badge>
                          <span className="nav-text font-medium">{exception.loanNumber}</span>
                          {exception.autoFix && (
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                              Auto-Fix Available
                            </Badge>
                          )}
                        </div>
                        <p className="detail-text text-gray-600 mt-1">{exception.description}</p>
                        <p className="detail-text text-gray-500 mt-1">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {exception.age}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-view-exception-${exception.id}`}>
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentActivity?.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
                      {getActivityIcon(activity.type)}
                      <div className="flex-1 min-w-0">
                        <p className="nav-text text-gray-900">{activity.message}</p>
                        <p className="detail-text text-gray-500 mt-1">{activity.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}