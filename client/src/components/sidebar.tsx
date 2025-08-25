import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Route, 
  AlertTriangle, 
  FileText, 
  Shield, 
  Settings, 
  BarChart3,
  User,
  Upload,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Command Center", href: "/", icon: Activity },
  { name: "Pipeline Monitor", href: "/pipeline", icon: Route },
  { name: "Exceptions", href: "/exceptions", icon: AlertTriangle },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "Compliance", href: "/compliance", icon: Shield },
  { name: "Agents", href: "/agents", icon: Settings },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Simple Staging", href: "/simple-staging", icon: Upload },
  { name: "Scheduler", href: "/scheduler", icon: Calendar },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-72 bg-gradient-card shadow-professional border-r border-neutral-100 flex flex-col backdrop-blur-xl">
      {/* Logo/Brand */}
      <div className="p-8 border-b border-neutral-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-soft">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900" data-testid="brand-title">
              Co-Issue Boarding
            </h1>
            <p className="text-sm text-neutral-500 font-medium">Multi-Agent Pipeline</p>
          </div>
        </div>
        <div className="bg-gradient-primary text-white px-3 py-1 rounded-full text-xs font-medium inline-block">
          Enterprise Suite
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "group flex items-center space-x-4 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 relative overflow-hidden",
                  isActive
                    ? "text-primary bg-gradient-primary/10 shadow-soft border border-primary/20 font-semibold"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 hover:shadow-soft hover:scale-[1.02]"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-primary rounded-r-full"></div>
                )}
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-gradient-primary text-white shadow-soft" 
                    : "bg-neutral-100 group-hover:bg-neutral-200 group-hover:scale-110"
                )}>
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <div className="w-2 h-2 bg-gradient-primary rounded-full animate-pulse"></div>
                )}
              </a>
            </Link>
          );
        })}
      </nav>
      
      {/* User Profile */}
      <div className="p-6 border-t border-neutral-100">
        <div className="bg-gradient-card p-4 rounded-xl border border-neutral-200 shadow-soft" data-testid="user-profile">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-gradient-primary text-white rounded-xl flex items-center justify-center font-medium shadow-soft">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-neutral-900">System User</p>
              <p className="text-xs text-neutral-500 font-medium">Senior Loan Analyst</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span className="text-xs text-success font-medium">Online</span>
            </div>
            <Settings className="w-4 h-4 text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
