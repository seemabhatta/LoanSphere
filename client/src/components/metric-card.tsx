import { Card, CardContent } from "@/components/ui/card";
import { 
  CheckCircle, 
  Clock, 
  Zap, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  trend?: string;
  trendType?: "positive" | "negative" | "warning";
  icon: "check-circle" | "clock" | "zap" | "alert-triangle";
  testId?: string;
}

export default function MetricCard({ 
  title, 
  value, 
  trend, 
  trendType = "positive", 
  icon,
  testId 
}: MetricCardProps) {
  const getIcon = () => {
    switch (icon) {
      case "check-circle":
        return <CheckCircle className="text-success text-xl w-6 h-6" />;
      case "clock":
        return <Clock className="text-primary text-xl w-6 h-6" />;
      case "zap":
        return <Zap className="text-secondary text-xl w-6 h-6" />;
      case "alert-triangle":
        return <AlertTriangle className="text-warning text-xl w-6 h-6" />;
      default:
        return <CheckCircle className="text-success text-xl w-6 h-6" />;
    }
  };

  const getIconBackground = () => {
    switch (icon) {
      case "check-circle":
        return "bg-success/10";
      case "clock":
        return "bg-primary/10";
      case "zap":
        return "bg-secondary/10";
      case "alert-triangle":
        return "bg-warning/10";
      default:
        return "bg-success/10";
    }
  };

  const getTrendColor = () => {
    switch (trendType) {
      case "positive":
        return "text-success";
      case "negative":
        return "text-error";
      case "warning":
        return "text-warning";
      default:
        return "text-success";
    }
  };

  const getTrendIcon = () => {
    switch (trendType) {
      case "positive":
        return <ArrowUp className="w-4 h-4 mr-1" />;
      case "negative":
        return <ArrowDown className="w-4 h-4 mr-1" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 mr-1" />;
      default:
        return <ArrowUp className="w-4 h-4 mr-1" />;
    }
  };

  return (
    <Card className="bg-white shadow-sm border border-neutral-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="label-text text-neutral-500">{title}</p>
            <p 
              className="text-3xl font-bold text-neutral-800 mt-2" 
              data-testid={testId}
            >
              {value}
            </p>
            {trend && (
              <p className={`body-text mt-2 flex items-center ${getTrendColor()}`}>
                {getTrendIcon()}
                {trend}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getIconBackground()}`}>
            {getIcon()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
