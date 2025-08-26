import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ComplianceItem {
  percentage: number;
  status: string;
  total?: number;
  on_time?: number;
}

interface ComplianceStatus {
  respa_welcome?: ComplianceItem;
  escrow_setup?: ComplianceItem;
  tila_disclosure?: ComplianceItem;
  overall_status?: string;
}

interface ComplianceStatusProps {
  status: ComplianceStatus;
}

export default function ComplianceStatus({ status }: ComplianceStatusProps) {
  const getStatusColor = (itemStatus: string) => {
    switch (itemStatus) {
      case 'success':
        return 'border-success';
      case 'warning':
        return 'border-warning';
      case 'error':
        return 'border-error';
      default:
        return 'border-neutral-200';
    }
  };

  const getProgressColor = (itemStatus: string) => {
    switch (itemStatus) {
      case 'success':
        return 'bg-success';
      case 'warning':
        return 'bg-warning';
      case 'error':
        return 'bg-error';
      default:
        return 'bg-neutral-400';
    }
  };

  const complianceItems = [
    {
      title: "RESPA Welcome Letters",
      data: status.respa_welcome,
      description: "Welcome letter requirements"
    },
    {
      title: "Escrow Setup", 
      data: status.escrow_setup,
      description: "Escrow account setup timing"
    },
    {
      title: "TILA Disclosures",
      data: status.tila_disclosure,
      description: "Truth in Lending disclosures"
    }
  ];

  const recentEvents = [
    {
      type: "success",
      message: "Welcome letter sent for XP12345678",
      timeAgo: "2h ago"
    },
    {
      type: "success", 
      message: "Escrow setup completed for XP12345677",
      timeAgo: "4h ago"
    },
    {
      type: "warning",
      message: "Escrow setup delayed for XP12345681", 
      timeAgo: "6h ago"
    }
  ];

  const getEventColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'w-2 h-2 bg-success rounded-full';
      case 'warning':
        return 'w-2 h-2 bg-warning rounded-full';
      case 'error':
        return 'w-2 h-2 bg-error rounded-full';
      default:
        return 'w-2 h-2 bg-neutral-400 rounded-full';
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="section-header text-neutral-800">
            Compliance Status
          </CardTitle>
          <Badge 
            className={`detail-text font-medium px-2 py-1 ${
              status.overall_status === 'on_track' 
                ? 'text-success bg-green-50' 
                : 'text-warning bg-yellow-50'
            }`}
            data-testid="compliance-overall-status"
          >
            {status.overall_status === 'on_track' ? 'All On Track' : 'Attention Needed'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {complianceItems.map((item) => (
            <div 
              key={item.title}
              className={`border-l-4 pl-4 ${getStatusColor(item.data?.status || 'unknown')}`}
              data-testid={`compliance-item-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="label-text text-neutral-800">{item.title}</h4>
                <span className="detail-text text-success">
                  {item.data?.percentage || 0}% On Time
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 mb-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(item.data?.status || 'unknown')}`}
                  style={{ width: `${item.data?.percentage || 0}%` }}
                ></div>
              </div>
              <p className="detail-text text-neutral-500">
                {item.data?.on_time || 0} on time of {item.data?.total || 0} total
              </p>
            </div>
          ))}
        </div>
        
        {/* Recent Compliance Events */}
        <div className="mt-6 pt-6 border-t border-neutral-200">
          <h4 className="label-text text-neutral-800 mb-4">Recent Events</h4>
          <div className="space-y-3 detail-text">
            {recentEvents.map((event, index) => (
              <div 
                key={index}
                className="flex items-center space-x-3"
                data-testid={`recent-event-${index}`}
              >
                <span className={getEventColor(event.type)}></span>
                <span className="flex-1">{event.message}</span>
                <span className="text-neutral-500">{event.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
