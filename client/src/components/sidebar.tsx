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
  Database,
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
  { name: "Sample Data", href: "/sample-data", icon: Database },
  { name: "Simple Staging", href: "/simple-staging", icon: Upload },
  { name: "Scheduler", href: "/scheduler", icon: Calendar },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-white shadow-lg border-r border-neutral-200 flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-neutral-200">
        <h1 className="text-xl font-medium text-primary" data-testid="brand-title">
          Co-Issue Boarding
        </h1>
        <p className="text-sm text-neutral-500 mt-1">Multi-Agent Pipeline</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors",
                  isActive
                    ? "text-primary bg-blue-50"
                    : "text-neutral-600 hover:bg-neutral-100"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </a>
            </Link>
          );
        })}
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-neutral-200">
        <div className="flex items-center space-x-3" data-testid="user-profile">
          <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-medium">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">System User</p>
            <p className="text-xs text-neutral-500">Loan Analyst</p>
          </div>
        </div>
      </div>
    </div>
  );
}
