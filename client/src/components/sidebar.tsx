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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-20 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-12 bottom-0 w-60 bg-white border-r border-gray-200 flex flex-col z-50 shadow-lg">
      {/* Logo/Brand */}
      <div className="px-4 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center">
            <Home className="w-3 h-3 text-white" />
          </div>
          <h1 className="text-sm font-medium text-gray-900" data-testid="brand-title">
            Co-Issue Boarding
          </h1>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navigationSections.map((section) => (
          <div key={section.title} className="mb-6">
            {/* Section Items */}
            <div>
              {section.items.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center px-4 py-2 text-sm transition-colors cursor-pointer",
                        isActive
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="w-4 h-4 mr-3" />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {/* User Profile */}
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex items-center space-x-2" data-testid="user-profile">
          <div className="w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs">
            <User className="w-3 h-3" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700 truncate">System User</p>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
