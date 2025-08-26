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
  Clock,
  CreditCard,
  FileCheck,
  Receipt,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationSections = [
  {
    title: "COMMAND CENTER",
    items: [
      { name: "Assistant", href: "/", icon: Bot, description: "Natural language interface" },
      { name: "Command Center", href: "/command-center", icon: Home, description: "Mission control dashboard" },
    ]
  },
  {
    title: "WORKSPACE",
    items: [
      { name: "Stage", href: "/simple-staging", icon: Upload, description: "Upload & stage files" },
      { name: "Process", href: "/scheduler", icon: Calendar, description: "Loan processing schedule" },
      { name: "Synthetic Data Generation", href: "/synthetic-data", icon: Zap, description: "Generate synthetic loan data" },
    ]
  },
  {
    title: "DATA & WORKFLOWS",
    items: [
      { name: "Loans", href: "/loans", icon: CreditCard, description: "Loan management" },
      { name: "Commitments", href: "/commitments", icon: FileCheck, description: "Commitment tracking" },
      { name: "PurchaseAdvices", href: "/purchase-advices", icon: Receipt, description: "Purchase advice management" },
      { name: "Documents", href: "/documents", icon: FileText, description: "Document processing" },
    ]
  },
  {
    title: "PIPELINE",
    items: [
      { name: "Loan Boarding", href: "/pipeline", icon: Route, description: "Track loan progress" },
      { name: "Doc Processing", href: "/doc-processing", icon: Zap, description: "Document processing pipeline" },
      { name: "Exceptions", href: "/exceptions", icon: AlertTriangle, description: "Review and resolve issues", badge: "5" },
    ]
  },
  {
    title: "GOVERNANCE",
    items: [
      { name: "Compliance", href: "/compliance", icon: Shield, description: "RESPA/TILA tracking" },
      { name: "Analytics", href: "/analytics", icon: BarChart3, description: "Performance insights" },
    ]
  }
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
}

export default function Sidebar({ isOpen, onClose, collapsed = false }: SidebarProps) {
  const [location] = useLocation();

  return (
    <div className={cn(
      "bg-gray-100 flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navigationSections.map((section) => (
          <div key={section.title} className="mb-6">
            {/* Section Header */}
            {!collapsed && (
              <div className="px-4 mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {section.title}
                </h3>
              </div>
            )}
            
            {/* Section Items */}
            <div>
              {section.items.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center transition-colors cursor-pointer group relative",
                        collapsed ? "px-3 py-3 justify-center" : "px-4 py-2",
                        isActive
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                      data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                      title={collapsed ? item.name : undefined}
                    >
                      <item.icon className={cn(
                        "w-4 h-4",
                        collapsed ? "mx-auto" : "mr-3"
                      )} />
                      {!collapsed && <span className="nav-text">{item.name}</span>}
                      
                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                          {item.name}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {/* User Profile */}
      <div className={cn(
        "border-t border-gray-200",
        collapsed ? "px-3 py-3" : "px-4 py-3"
      )}>
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "space-x-2"
        )} data-testid="user-profile">
          <div className="w-6 h-6 bg-gray-400 text-white rounded-full flex items-center justify-center detail-text">
            <User className="w-3 h-3" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="nav-text text-gray-700 truncate">System User</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
