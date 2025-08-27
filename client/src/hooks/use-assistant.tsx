import { useState } from "react";
import RightPanelAssistant from "@/components/right-panel-assistant";

interface UseAssistantOptions {
  pageName: string;
  enabled?: boolean;
  context?: Record<string, any>;
}

export function useAssistant({ pageName, enabled = true, context = {} }: UseAssistantOptions) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleAssistant = () => {
    setIsExpanded(!isExpanded);
  };

  const AssistantComponent = enabled ? (
    <RightPanelAssistant 
      currentPage={pageName}
      isExpanded={isExpanded}
      onToggle={toggleAssistant}
      context={context}
    />
  ) : null;

  return {
    AssistantComponent,
    isExpanded,
    toggleAssistant,
  };
}
