import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { 
  Bot,
  Send,
  Mic,
  MicOff,
  X,
  ChevronLeft,
  ChevronRight,
  User,
  Minimize2,
  Maximize2
} from "lucide-react";
import AssistantChart from "@/components/assistant-chart";
import AssistantGraph from "@/components/assistant-graph";
import AssistantGraphInteractive from "@/components/assistant-graph-interactive";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface RightPanelAssistantProps {
  currentPage?: string;
  isExpanded: boolean;
  onToggle: () => void;
  context?: Record<string, any>;
}

export default function RightPanelAssistant({ 
  currentPage = "", 
  isExpanded, 
  onToggle,
  context = {}
}: RightPanelAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `Hi! I'm here to help with ${currentPage || 'your loan boarding tasks'}. What can I assist you with?`,
      timestamp: new Date(),
      suggestions: getContextualSuggestions(currentPage)
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update context when page changes
  useEffect(() => {
    if (messages.length === 1) {
      setMessages([{
        id: '1',
        type: 'assistant',
        content: `Hi! I'm here to help with ${currentPage || 'your loan boarding tasks'}. What can I assist you with?`,
        timestamp: new Date(),
        suggestions: getContextualSuggestions(currentPage)
      }]);
    }
  }, [currentPage]);

  function getContextualSuggestions(page: string): string[] {
    const suggestions: { [key: string]: string[] } = {
      'exceptions': [
        'Show critical exceptions',
        'Auto-fix available items',
        'Exception trends'
      ],
      'command-center': [
        'System status',
        'Performance metrics',
        'Recent alerts'
      ],
      'analytics': [
        'FPY analysis',
        'Trend explanation',
        'Performance insights'
      ],
      'pipeline': [
        'Pipeline status',
        'Bottlenecks',
        'Processing times'
      ],
      'default': [
        'System overview',
        'Show exceptions',
        'Performance summary'
      ]
    };

    const pageKey = page.toLowerCase().replace(/[^a-z]/g, '');
    return suggestions[pageKey] || suggestions.default;
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const outgoing = inputValue;
    setInputValue('');
    setIsTyping(true);

    try {
      const result = await apiRequest('POST', '/api/ai-agent/chat', {
        message: outgoing,
        session_id: sessionId ?? undefined,
        page: currentPage || undefined,
        context: context && Object.keys(context).length ? context : undefined,
      });

      if (result?.session_id && result.session_id !== sessionId) {
        setSessionId(result.session_id);
      }

      const aiMessage: Message = {
        id: `${Date.now()}-assistant`,
        type: 'assistant',
        content: result?.response ?? 'No response received.',
        timestamp: new Date(),
        // Optionally keep contextual suggestions based on page
        suggestions: getContextualSuggestions(currentPage)
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('AI chat error:', err);
      toast({
        title: 'AI Assistant Error',
        description: err?.message || 'Failed to contact AI service.',
        variant: 'destructive'
      });
      const errMessage: Message = {
        id: `${Date.now()}-assistant-error`,
        type: 'assistant',
        content: 'Sorry, I could not reach the AI service right now.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Helper to send an ad-hoc query (used by graph clicks)
  const sendAgentQuery = async (query: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    try {
      const result = await apiRequest('POST', '/api/ai-agent/chat', {
        message: query,
        session_id: sessionId ?? undefined,
        page: currentPage || undefined,
        context: context && Object.keys(context).length ? context : undefined,
      });
      if (result?.session_id && result.session_id !== sessionId) {
        setSessionId(result.session_id);
      }
      const aiMessage: Message = {
        id: `${Date.now()}-assistant`,
        type: 'assistant',
        content: result?.response ?? 'No response received.',
        timestamp: new Date(),
        suggestions: getContextualSuggestions(currentPage)
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      toast({ title: 'AI Assistant Error', description: err?.message || 'Failed to contact AI service.', variant: 'destructive' });
    } finally {
      setIsTyping(false);
    }
  };

  const generateContextualResponse = (query: string, page: string): Message => {
    const lowerQuery = query.toLowerCase();
    
    // Page-specific responses
    if (page === 'Exceptions' && (lowerQuery.includes('exception') || lowerQuery.includes('critical'))) {
      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: `Based on your Exceptions page, here's what I see:\n\n🔴 **2 Critical Issues:**\n• XP12345 - Missing docs (auto-fix available)\n• XP12346 - Rate mismatch\n\n🟡 **3 Medium Priority:**\n• Review needed items\n\nWould you like me to auto-resolve the fixable exceptions?`,
        timestamp: new Date(),
        suggestions: ['Auto-resolve fixables', 'Show details', 'Export report']
      };
    }

    if (page === 'Command Center' && lowerQuery.includes('status')) {
      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: `**System Status from Dashboard:**\n\n✅ **All systems operational**\n• FPY: 87.3% (exceeding target)\n• Processing: 23 loans active\n• Uptime: 99.9%\n\n🎯 **Today's Highlights:**\n• 15 loans boarded successfully\n• 2 exceptions auto-resolved`,
        timestamp: new Date(),
        suggestions: ['View details', 'Check alerts', 'Performance trends']
      };
    }

    // Generic contextual response
    return {
      id: Date.now().toString(),
      type: 'assistant',
      content: `I can help you with ${page || 'loan boarding operations'}. ${getPageSpecificHelp(page)}\n\nWhat specific information do you need?`,
      timestamp: new Date(),
      suggestions: getContextualSuggestions(page),
    };
  };

  const getPageSpecificHelp = (page: string): string => {
    const helpText: { [key: string]: string } = {
      'Exceptions': 'I can help analyze exceptions, suggest auto-fixes, and explain resolution steps.',
      'Analytics': 'I can explain trends, provide performance insights, and suggest improvements.',
      'Pipeline': 'I can show pipeline status, identify bottlenecks, and track processing times.',
      'Command Center': 'I can provide system status, performance metrics, and operational insights.'
    };
    
    return helpText[page] || 'I can help with system operations, data analysis, and workflow optimization.';
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <div className={`fixed right-0 top-0 h-full z-50 transition-all duration-300 ease-in-out ${
      isExpanded ? 'w-96' : 'w-12'
    }`}>
      {/* Collapsed State - Toggle Button */}
      {!isExpanded && (
        <div className="h-full bg-white border-l border-gray-200 shadow-lg">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="w-full h-16 rounded-none border-b border-gray-200 flex flex-col items-center justify-center hover:bg-blue-50"
            data-testid="expand-assistant"
          >
            <Bot className="w-5 h-5 text-blue-600" />
            <ChevronLeft className="w-3 h-3 text-gray-400 mt-1" />
          </Button>
        </div>
      )}

      {/* Expanded State - Full Assistant */}
      {isExpanded && (
        <div className="h-full bg-white border-l border-gray-200 shadow-lg flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-blue-600" />
              <span className="body-text font-medium">Assistant</span>
              {currentPage && (
                <Badge variant="outline" className="text-xs px-2 py-0">
                  {currentPage}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggle}
                className="p-1 h-6 w-6 hover:bg-gray-200"
                data-testid="collapse-assistant"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-2 text-sm ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <div className="flex items-start space-x-2">
                    {message.type === 'assistant' && (
                      <Bot className="w-3 h-3 mt-0.5 text-blue-600 flex-shrink-0" />
                    )}
                    {message.type === 'user' && (
                      <User className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    )}
                      <div className="flex-1 min-w-0">
                        <p className="whitespace-pre-line text-xs leading-relaxed">{message.content}</p>
                        {message.type === 'assistant' && (message as any).data?.visualization && (
                          (message as any).data.visualization.type === 'graph' ? (
                            <AssistantGraphInteractive
                              spec={(message as any).data.visualization}
                              // On node click, send a follow-up query to the agent
                              onNodeClick={(nodeId: string, label?: string) => {
                                const pretty = label ? `${nodeId} (${label})` : nodeId;
                                const q = `Show details for graph node ${pretty}. If this is a loan node, show loan data summary and graph related entities.`;
                                sendAgentQuery(q);
                              }}
                            />
                          ) : (
                            <AssistantChart spec={(message as any).data.visualization} />
                          )
                        )}
                      </div>
                  </div>
                  
                  {/* Suggestions */}
                  {message.suggestions && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                          data-testid={`suggestion-${index}`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-2">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-3 h-3 text-blue-600" />
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Area */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`Ask about ${currentPage || 'anything'}...`}
                  className="pr-8 text-sm h-8"
                  data-testid="assistant-input"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleListening}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 h-6 w-6 ${
                    isListening ? 'text-red-600' : 'text-gray-400'
                  }`}
                  data-testid="voice-button"
                >
                  {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                </Button>
              </div>
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputValue.trim()} 
                size="sm"
                className="h-8 w-8 p-0"
                data-testid="send-button"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
