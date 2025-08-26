import { useState } from "react";
import RightPanelAssistant from "@/components/right-panel-assistant";

interface UseAssistantOptions {
  pageName: string;
  enabled?: boolean;
}

export function useAssistant({ pageName, enabled = true }: UseAssistantOptions) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleAssistant = () => {
    setIsExpanded(!isExpanded);
  };

  const AssistantComponent = enabled ? (
    <RightPanelAssistant 
      currentPage={pageName}
      isExpanded={isExpanded}
      onToggle={toggleAssistant}
    />
  ) : null;

  return {
    AssistantComponent,
    isExpanded,
    toggleAssistant,
  };
}