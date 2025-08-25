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
  Calendar,
  Home,
  TrendingUp,
  Zap,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationSections = [
  {
    title: "OPERATIONS",
    items: [
      { name: "Command Center", href: "/", icon: Activity, description: "Real-time dashboard", badge: "live" },
      { name: "Simple Staging", href: "/simple-staging", icon: Upload, description: "Upload & stage files" },
      { name: "Scheduler", href: "/scheduler", icon: Calendar, description: "Loan processing schedule" },
    ]
  },
  {
    title: "MONITORING",
    items: [
      { name: "Pipeline Monitor", href: "/pipeline", icon: Route, description: "Track loan progress" },
      { name: "Exceptions", href: "/exceptions", icon: AlertTriangle, description: "Review and resolve issues", badge: "3" },
      { name: "Agents", href: "/agents", icon: Settings, description: "AI agent status" },
    ]
  },
  {
    title: "GOVERNANCE",
    items: [
      { name: "Documents", href: "/documents", icon: FileText, description: "Document processing" },
      { name: "Compliance", href: "/compliance", icon: Shield, description: "RESPA/TILA tracking" },
      { name: "Analytics", href: "/analytics", icon: BarChart3, description: "Performance insights" },
    ]
  }
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-72 bg-neutral-50 border-r border-neutral-200 flex flex-col h-full">
      {/* Logo/Brand */}
      <div className="px-6 py-5 border-b border-neutral-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
            <Home className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-900" data-testid="brand-title">
              Co-Issue Boarding
            </h1>
            <p className="text-xs text-neutral-500">Multi-Agent Pipeline</p>
          </div>
        </div>
      </div>
      
      {/* Navigation Sections */}
      <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        {navigationSections.map((section) => (
          <div key={section.title}>
            {/* Section Header */}
            <div className="px-3 mb-3">
              <h3 className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                {section.title}
              </h3>
            </div>
            
            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <a
                      className={cn(
                        "group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-white text-blue-700 shadow-sm border border-blue-100"
                          : "text-neutral-700 hover:bg-white hover:text-neutral-900 hover:shadow-sm"
                      )}
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
                          isActive 
                            ? "bg-blue-100 text-blue-700" 
                            : "text-neutral-500 group-hover:text-neutral-700"
                        )}>
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-neutral-500 group-hover:text-neutral-600">
                            {item.description}
                          </div>
                        </div>
                      </div>
                      
                      {/* Badges */}
                      {item.badge && (
                        <div className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          item.badge === "live" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-red-100 text-red-700"
                        )}>
                          {item.badge}
                        </div>
                      )}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {/* System Status */}
      <div className="px-4 py-4 border-t border-neutral-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">System Status</span>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-600 font-medium">Operational</span>
          </div>
        </div>
        
        {/* User Profile */}
        <div className="flex items-center space-x-3 p-3 bg-neutral-50 rounded-lg" data-testid="user-profile">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center font-medium text-sm">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-neutral-900 truncate">System User</p>
            <p className="text-xs text-neutral-500">Loan Processing Analyst</p>
          </div>
        </div>
      </div>
    </div>
  );
}
