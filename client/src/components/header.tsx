import { Search, Menu, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="bg-white border-b border-neutral-200 h-14 flex items-center px-4 z-10">
      {/* Mobile menu toggle */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="lg:hidden mr-2"
        onClick={onMenuToggle}
        data-testid="mobile-menu-toggle"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Databricks-style logo */}
      <div className="flex items-center mr-6">
        <div className="bg-primary text-white rounded-sm w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">
          db
        </div>
        <span className="text-lg font-medium text-neutral-800 hidden sm:block">
          databricks
        </span>
      </div>

      {/* Search bar - Databricks style */}
      <div className="flex-1 max-w-2xl relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <Input
            type="text"
            placeholder="Search data, notebooks, recents, and more..."
            className="w-full pl-10 pr-12 bg-neutral-50 border-neutral-200 text-sm placeholder:text-neutral-500 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary"
            data-testid="global-search"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
            <kbd className="px-2 py-1 text-xs bg-white border border-neutral-200 rounded text-neutral-500 font-mono">
              ⌘
            </kbd>
            <kbd className="px-2 py-1 text-xs bg-white border border-neutral-200 rounded text-neutral-500 font-mono">
              P
            </kbd>
          </div>
        </div>
      </div>

      {/* Right side actions */}
      <div className="ml-4 flex items-center space-x-3">
        <Button variant="ghost" size="sm" data-testid="user-menu">
          <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-medium">
            SU
          </div>
        </Button>
      </div>
    </header>
  );
}