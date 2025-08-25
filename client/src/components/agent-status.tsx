import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Agent {
  name: string;
  type: string;
  status: string;
  current_task?: string;
  last_activity?: string;
}

interface AgentStatusProps {
  agents: Agent[];
}

export default function AgentStatus({ agents }: AgentStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'w-3 h-3 bg-primary rounded-full animate-pulse';
      case 'active':
        return 'w-3 h-3 bg-success rounded-full';
      case 'error':
        return 'w-3 h-3 bg-error rounded-full';
      case 'wait':
        return 'w-3 h-3 bg-warning rounded-full';
      default:
        return 'w-3 h-3 bg-neutral-400 rounded-full';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'detail-text text-primary font-mono';
      case 'active':
        return 'detail-text text-success font-mono';
      case 'error':
        return 'detail-text text-error font-mono';
      case 'wait':
        return 'detail-text text-warning font-mono';
      default:
        return 'detail-text text-neutral-500 font-mono';
    }
  };

  const getAgentDescription = (type: string) => {
    switch (type) {
      case 'planner':
        return 'Task orchestration';
      case 'tool':
        return 'Pipeline execution';
      case 'verifier':
        return 'Rule validation';
      case 'document':
        return 'OCR & classification';
      default:
        return 'System agent';
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardHeader>
        <CardTitle className="section-header text-neutral-800">
          Agent Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {agents.map((agent) => (
            <div 
              key={agent.name}
              className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg"
              data-testid={`agent-status-${agent.name.toLowerCase()}`}
            >
              <div className="flex items-center space-x-3">
                <div className={getStatusColor(agent.status)}></div>
                <div>
                  <p className="font-medium text-neutral-800">{agent.name}</p>
                  <p className="text-xs text-neutral-500">
                    {getAgentDescription(agent.type)}
                  </p>
                  {agent.current_task && (
                    <p className="text-xs text-neutral-600 mt-1 max-w-48 truncate">
                      {agent.current_task}
                    </p>
                  )}
                </div>
              </div>
              <span className={getStatusBadgeColor(agent.status)}>
                {agent.status.toUpperCase()}
              </span>
            </div>
          ))}
          
          {agents.length === 0 && (
            <div className="text-center py-4 text-neutral-500" data-testid="no-agents">
              No agent data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
