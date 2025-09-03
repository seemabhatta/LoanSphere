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
  Bot,
  History,
  LogOut,
  ChevronDown,
  Brain,
  Cable
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigationSections = [
  {
    title: "OVERVIEW", 
    items: [
      { name: "Assistant", href: "/", icon: Bot, description: "Natural language interface" },
      { name: "AI Assistant (New)", href: "/ai-new", icon: Brain, description: "Unified agent system" },
      { name: "Command Center", href: "/command-center", icon: Home, description: "Mission control dashboard" },
    ]
  },
  {
    title: "OPERATIONS",
    items: [
      { name: "Pipeline", href: "/pipeline", icon: Route, description: "Track loan progress" },
      { name: "Doc Processing", href: "/doc-processing", icon: Zap, description: "Document processing pipeline" },
      { name: "Exceptions", href: "/exceptions", icon: AlertTriangle, description: "Review and resolve issues" },
    ]
  },
  {
    title: "DATA",
    items: [
      { name: "Loans", href: "/loans", icon: CreditCard, description: "Loan management" },
      { name: "Commitments", href: "/commitments", icon: FileCheck, description: "Commitment tracking" },
      { name: "Purchase Advices", href: "/purchase-advices", icon: Receipt, description: "Purchase advice management" },
      { name: "Documents", href: "/documents", icon: FileText, description: "Document processing" },
    ]
  },
  {
    title: "PLATFORM",
    items: [
      { name: "Integrations", href: "/integrations", icon: Cable, description: "Connectors & platform integrations" },
      { name: "Agent Studio", href: "/agent-studio", icon: Brain, description: "Tools, prompts, behavior" },
      { name: "Stage", href: "/simple-staging", icon: Upload, description: "Upload & stage files" },
      { name: "Scheduler", href: "/scheduler", icon: Calendar, description: "Loan processing schedule" },
      { name: "Synthetic Data", href: "/synthetic-data", icon: Zap, description: "Generate synthetic loan data" },
    ]
  },
  {
    title: "GOVERNANCE",
    items: [
      { name: "Analytics", href: "/analytics", icon: BarChart3, description: "Performance insights" },
      { name: "Compliance", href: "/compliance", icon: Shield, description: "RESPA/TILA tracking" },
      { name: "Audit Log", href: "/audit-log", icon: History, description: "System audit trail" },
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
  const { user } = useAuth();

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
        {collapsed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full h-auto p-1 hover:bg-gray-50"
                data-testid="user-profile-collapsed"
              >
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                    {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 
                     user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              <div className="px-2 py-2">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.firstName && user?.lastName ? 
                    `${user.firstName} ${user.lastName}` : 
                    user?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="w-full cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile & Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => window.location.href = "/api/auth/logout"}
                className="text-red-600 hover:text-red-700 cursor-pointer"
                data-testid="button-logout-collapsed"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-auto p-2 hover:bg-gray-50"
                data-testid="user-profile"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {user?.profileImageUrl ? (
                    <img 
                      src={user.profileImageUrl} 
                      alt="Profile" 
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 
                       user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user?.firstName && user?.lastName ? 
                        `${user.firstName} ${user.lastName}` : 
                        user?.email || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="w-full cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile & Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => window.location.href = "/api/auth/logout"}
                className="text-red-600 hover:text-red-700 cursor-pointer"
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
