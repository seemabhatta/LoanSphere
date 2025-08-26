import { ReactNode } from "react";
import { useAssistant } from "@/hooks/use-assistant";

interface PageWithAssistantProps {
  children: ReactNode;
  pageName: string;
  className?: string;
}

export default function PageWithAssistant({ 
  children, 
  pageName, 
  className = "" 
}: PageWithAssistantProps) {
  const { AssistantComponent, isExpanded } = useAssistant({ pageName });

  return (
    <div className={`relative ${className}`}>
      {/* Main content with dynamic padding */}
      <div className={`transition-all duration-300 ${
        isExpanded ? 'pr-96' : 'pr-12'
      }`}>
        {children}
      </div>
      
      {/* Assistant Panel */}
      {AssistantComponent}
    </div>
  );
}