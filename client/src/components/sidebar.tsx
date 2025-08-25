import { Link, useLocation } from "wouter";
import { 
  Plus,
  Folder, 
  Clock, 
  Database, 
  Workflow, 
  Zap,
  Store,
  FileText,
  BarChart3,
  Upload,
  Calendar,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "New", href: "/new", icon: Plus, highlight: true },
  { name: "Workspace", href: "/", icon: Folder },
  { name: "Recents", href: "/recents", icon: Clock },
  { name: "Catalog", href: "/documents", icon: Database },
  { name: "Jobs & Pipelines", href: "/pipeline", icon: Workflow },
  { name: "Compute", href: "/agents", icon: Zap, active: true },
  { name: "Marketplace", href: "/marketplace", icon: Store },
  { 
    name: "SQL", 
    href: "/sql", 
    icon: FileText, 
    section: true,
    children: [
      { name: "SQL Editor", href: "/sql/editor", icon: FileText },
      { name: "Queries", href: "/exceptions", icon: BarChart3 },
      { name: "Dashboards", href: "/analytics", icon: BarChart3 },
    ]
  },
  { name: "Genie", href: "/compliance", icon: Zap },
  { name: "Alerts", href: "/alerts", icon: AlertTriangle },
  { name: "Query History", href: "/history", icon: Clock },
  // Keep our custom features
  { name: "Staging", href: "/simple-staging", icon: Upload, custom: true },
  { name: "Scheduler", href: "/scheduler", icon: Calendar, custom: true },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-56 bg-neutral-50 border-r border-neutral-200 flex flex-col h-full">
      
      {/* Navigation */}
      <nav className="flex-1 py-3">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.active && location.startsWith('/agents'));
          
          if (item.highlight) {
            return (
              <div key={item.name} className="px-3 mb-2">
                <Link href={item.href}>
                  <a
                    className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-orange-100 to-pink-100 text-orange-700 hover:from-orange-200 hover:to-pink-200 transition-all duration-200"
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </a>
                </Link>
              </div>
            );
          }

          if (item.section) {
            return (
              <div key={item.name} className="px-3 mb-2">
                <div className="text-xs font-medium text-neutral-600 uppercase tracking-wide px-3 py-2 mb-1">
                  {item.name}
                </div>
                {item.children?.map((child) => (
                  <Link key={child.name} href={child.href}>
                    <a
                      className={cn(
                        "flex items-center space-x-3 px-6 py-2 rounded-md text-sm transition-colors ml-2",
                        location === child.href
                          ? "text-primary bg-white border-r-2 border-primary"
                          : "text-neutral-700 hover:bg-white hover:text-neutral-900"
                      )}
                      data-testid={`nav-${child.name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <child.icon className="w-4 h-4" />
                      <span>{child.name}</span>
                    </a>
                  </Link>
                ))}
              </div>
            );
          }

          return (
            <div key={item.name} className="px-3">
              <Link href={item.href}>
                <a
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "text-primary bg-white shadow-sm border-r-2 border-primary"
                      : "text-neutral-700 hover:bg-white hover:text-neutral-900",
                    item.custom && "border-t border-neutral-200 mt-2 pt-3"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                  {item.children && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </a>
              </Link>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
