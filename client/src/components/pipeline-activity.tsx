import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

interface ActivityItem {
  id: string;
  xp_loan_number?: string;
  activity_type: string;
  status: string;
  message: string;
  agent_name?: string;
  timestamp: string;
}

interface PipelineActivityProps {
  activity: ActivityItem[];
}

export default function PipelineActivity({ activity }: PipelineActivityProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'w-2 h-2 bg-success rounded-full';
      case 'ERROR':
        return 'w-2 h-2 bg-error rounded-full';
      case 'RUNNING':
        return 'w-2 h-2 bg-primary rounded-full';
      default:
        return 'w-2 h-2 bg-neutral-400 rounded-full';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'text-success';
      case 'ERROR':
        return 'text-error';
      case 'RUNNING':
        return 'text-primary';
      default:
        return 'text-neutral-600';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-neutral-800">
            Pipeline Activity
          </CardTitle>
          <div className="flex space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-neutral-600 hover:text-primary"
              data-testid="button-last-24h"
            >
              Last 24h
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary bg-blue-50 hover:bg-blue-100"
              data-testid="button-real-time"
            >
              Real-time
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Chart placeholder */}
        <div className="h-64 bg-neutral-50 rounded-lg flex items-center justify-center mb-4">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
            <p className="text-neutral-500">Pipeline Throughput Chart</p>
            <p className="text-xs text-neutral-400">Updates every 30 seconds</p>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="space-y-3">
          <h4 className="font-medium text-neutral-800 text-sm mb-3">Recent Activity</h4>
          
          {activity.slice(0, 10).map((item, index) => (
            <div 
              key={item.id || index}
              className="flex items-center space-x-4 text-sm"
              data-testid={`activity-${index}`}
            >
              <span className="text-xs text-neutral-400 font-mono min-w-[70px]">
                {formatTime(item.timestamp)}
              </span>
              <span className={getStatusColor(item.status)}></span>
              <span className="flex-1">{item.message}</span>
              {item.xp_loan_number && (
                <span className="text-xs font-mono text-neutral-500">
                  {item.xp_loan_number}
                </span>
              )}
              <span className={`text-xs font-mono ${getStatusBadgeColor(item.status)}`}>
                {item.status}
              </span>
            </div>
          ))}
          
          {activity.length === 0 && (
            <div className="text-center py-4 text-neutral-500" data-testid="no-activity">
              No recent pipeline activity
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
