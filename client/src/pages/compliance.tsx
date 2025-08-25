import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  FileText,
  Calendar,
  TrendingUp
} from "lucide-react";

export default function Compliance() {
  const { data: complianceStatus } = useQuery({
    queryKey: ['/api/compliance/status'],
    refetchInterval: 60000
  });

  const { data: recentEvents } = useQuery({
    queryKey: ['/api/compliance/events/recent'],
    refetchInterval: 30000
  });

  const { data: overdueEvents } = useQuery({
    queryKey: ['/api/compliance/events/overdue'],
    refetchInterval: 30000
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-error" />;
      default:
        return <Clock className="w-5 h-5 text-neutral-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'border-green-200';
      case 'warning':
        return 'border-yellow-200';
      case 'error':
        return 'border-red-200';
      default:
        return 'border-gray-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center text-sm text-gray-500 mb-1">
          <span>Loan Boarding</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Compliance</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900" data-testid="page-title">
              Compliance
            </h1>
            <p className="text-gray-500 mt-1">
              Monitor RESPA/TILA compliance requirements
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge 
              className={`${complianceStatus?.overall_status === 'on_track' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
              data-testid="overall-status"
            >
              {complianceStatus?.overall_status === 'on_track' ? 'All On Track' : 'Attention Needed'}
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Compliance Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* RESPA Welcome Letters */}
              <Card className={`border-l-4 ${getStatusColor(complianceStatus?.respa_welcome?.status)}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-neutral-800">RESPA Welcome Letters</h3>
                    {getStatusIcon(complianceStatus?.respa_welcome?.status)}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-600">Compliance Rate</span>
                      <span className="text-2xl font-bold text-neutral-800" data-testid="respa-percentage">
                        {complianceStatus?.respa_welcome?.percentage || 0}%
                      </span>
                    </div>
                    
                    <Progress 
                      value={complianceStatus?.respa_welcome?.percentage || 0}
                      className="h-2"
                    />
                    
                    <div className="flex justify-between text-sm text-neutral-500">
                      <span>{complianceStatus?.respa_welcome?.on_time || 0} on time</span>
                      <span>{complianceStatus?.respa_welcome?.total || 0} total</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Escrow Setup */}
              <Card className={`border-l-4 ${getStatusColor(complianceStatus?.escrow_setup?.status)}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-neutral-800">Escrow Setup</h3>
                    {getStatusIcon(complianceStatus?.escrow_setup?.status)}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-600">Compliance Rate</span>
                      <span className="text-2xl font-bold text-neutral-800" data-testid="escrow-percentage">
                        {complianceStatus?.escrow_setup?.percentage || 0}%
                      </span>
                    </div>
                    
                    <Progress 
                      value={complianceStatus?.escrow_setup?.percentage || 0}
                      className="h-2"
                    />
                    
                    <div className="flex justify-between text-sm text-neutral-500">
                      <span>{complianceStatus?.escrow_setup?.on_time || 0} on time</span>
                      <span>{complianceStatus?.escrow_setup?.total || 0} total</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* TILA Disclosures */}
              <Card className={`border-l-4 ${getStatusColor(complianceStatus?.tila_disclosure?.status)}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-neutral-800">TILA Disclosures</h3>
                    {getStatusIcon(complianceStatus?.tila_disclosure?.status)}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-600">Compliance Rate</span>
                      <span className="text-2xl font-bold text-neutral-800" data-testid="tila-percentage">
                        {complianceStatus?.tila_disclosure?.percentage || 0}%
                      </span>
                    </div>
                    
                    <Progress 
                      value={complianceStatus?.tila_disclosure?.percentage || 0}
                      className="h-2"
                    />
                    
                    <div className="flex justify-between text-sm text-neutral-500">
                      <span>{complianceStatus?.tila_disclosure?.on_time || 0} on time</span>
                      <span>{complianceStatus?.tila_disclosure?.total || 0} total</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Events and Overdue */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>Recent Compliance Events</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentEvents?.events?.map((event: any, index: number) => (
                      <div 
                        key={event.id}
                        className="flex items-center space-x-3 p-3 border rounded-lg"
                        data-testid={`recent-event-${index}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          event.status === 'completed' ? 'bg-success' :
                          event.status === 'overdue' ? 'bg-error' :
                          'bg-warning'
                        }`}></div>
                        
                        <div className="flex-1">
                          <p className="text-sm font-medium text-neutral-800">
                            {event.description}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {event.xp_loan_number} • {new Date(event.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            event.status === 'completed' ? 'border-green-500 text-green-600' :
                            event.status === 'overdue' ? 'border-red-500 text-red-600' :
                            'border-yellow-500 text-yellow-600'
                          }`}
                        >
                          {event.status}
                        </Badge>
                      </div>
                    ))}
                    
                    {!recentEvents?.events?.length && (
                      <div className="text-center py-4 text-neutral-500" data-testid="no-recent-events">
                        No recent compliance events
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Overdue Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-error" />
                    <span>Overdue Events</span>
                    {overdueEvents?.total_overdue > 0 && (
                      <Badge className="bg-error text-white">
                        {overdueEvents.total_overdue}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {overdueEvents?.overdue_events?.map((event: any, index: number) => (
                      <div 
                        key={event.id}
                        className="p-3 border border-red-200 rounded-lg bg-red-50"
                        data-testid={`overdue-event-${index}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">
                              {event.description}
                            </p>
                            <p className="text-xs text-red-600 mt-1">
                              {event.xp_loan_number}
                            </p>
                            <p className="text-xs text-red-500 mt-1">
                              Due: {new Date(event.due_date).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <div className="text-right">
                            <Badge className="bg-error text-white text-xs">
                              {event.days_overdue} days overdue
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {!overdueEvents?.overdue_events?.length && (
                      <div className="text-center py-4 text-neutral-500" data-testid="no-overdue-events">
                        No overdue compliance events
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Compliance Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-neutral-500">
                  Detailed compliance events view coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-neutral-500">
                  Compliance reporting dashboard coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
