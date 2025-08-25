import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import xpanseLogo from "@assets/image_1756159502281.png";

interface TopHeaderProps {
  onToggleSidebar: () => void;
}

export default function TopHeader({ onToggleSidebar }: TopHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 sticky top-0 z-30">
      {/* Left side - Hamburger and Logo */}
      <div className="flex items-center space-x-4 w-64">
        <button
          onClick={onToggleSidebar}
          className="p-1 hover:bg-gray-100 rounded"
          data-testid="hamburger-menu"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="flex items-center space-x-2">
          <img 
            src={xpanseLogo} 
            alt="Xpanse" 
            className="w-8 h-8"
          />
          <span className="text-sm font-bold text-gray-900 hidden sm:inline">
            Xpanse Loan Xchange
          </span>
        </div>
      </div>

      {/* Center - Search */}
      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search loans, documents, exceptions, and more..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full bg-gray-50 border-gray-200 text-sm"
            data-testid="global-search"
          />
        </div>
      </div>

      {/* Right side - Shortcuts */}
      <div className="flex items-center justify-end space-x-2 text-sm text-gray-500 w-64">
        <span className="hidden md:inline">⌘ + P</span>
      </div>
    </header>
  );
}