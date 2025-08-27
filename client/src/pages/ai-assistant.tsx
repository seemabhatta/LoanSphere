import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { 
  Bot,
  Send,
  Mic,
  MicOff,
  Zap,
  TrendingUp,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Lightbulb,
  Brain
} from "lucide-react";
import AssistantChart from "@/components/assistant-chart";

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  data?: any;
}

interface QuickAction {
  label: string;
  query: string;
  icon: any;
  category: string;
}

export default function AIAssistant() {
  const { user } = useAuth();
  
  const getWelcomeMessage = () => {
    return `Hello! I'm your AI Assistant for Xpanse Loan Xchange. I can help you with loan boarding, exception management, analytics, and system operations. What would you like to know?`;
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const quickActions: QuickAction[] = [
    { label: 'Critical Exceptions', query: 'Show me all critical exceptions requiring immediate attention', icon: AlertTriangle, category: 'Operations' },
    { label: 'System Status', query: 'What is the current system status and performance?', icon: Zap, category: 'Monitoring' },
    { label: 'FPY Analysis', query: 'Analyze first-pass yield trends and suggest improvements', icon: TrendingUp, category: 'Analytics' },
    { label: 'Loan Pipeline', query: 'Show me the current loan boarding pipeline status', icon: FileText, category: 'Pipeline' },
    { label: 'SLA Alerts', query: 'Which loans are at risk of missing SLA targets?', icon: Clock, category: 'Alerts' },
    { label: 'Auto-Fix Options', query: 'What exceptions can be auto-resolved right now?', icon: Lightbulb, category: 'Automation' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


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
        session_id: sessionId ?? undefined
      });

      // result: { response: string, session_id: string }
      if (result?.session_id && result.session_id !== sessionId) {
        setSessionId(result.session_id);
      }

      const aiMessage: Message = {
        id: `${Date.now()}-assistant`,
        type: 'assistant',
        content: result?.response ?? 'No response received.',
        timestamp: new Date(),
        data: result?.visualization ? { visualization: result.visualization } : undefined,
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
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateAIResponse = (query: string): Message => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('exception') || lowerQuery.includes('critical')) {
      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: `I found 5 active exceptions requiring attention:\n\n🔴 **HIGH Priority:**\n• XP12345 - Missing W-2 Documents (2 days old)\n• XP12346 - Interest Rate Mismatch (Auto-fix available)\n\n🟡 **MEDIUM Priority:**\n• XP12347 - DTI Ratio Exceeds Guidelines (1 day old)\n• XP12349 - Credit Score Variance (Manual review needed)\n\n🟢 **LOW Priority:**\n• XP12348 - API Connection Failed (4 hours, Auto-fix available)\n\nWould you like me to auto-resolve the fixable exceptions or provide detailed analysis for any specific loan?`,
        timestamp: new Date(),
        suggestions: ['Auto-resolve fixable exceptions', 'Analyze XP12345 documents', 'Show exception trends'],
        data: { exceptions: 5, autoFixAvailable: 2, highPriority: 2 }
      };
    }
    
    if (lowerQuery.includes('status') || lowerQuery.includes('system')) {
      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: `🟢 **System Status: HEALTHY**\n\n📊 **Current Metrics:**\n• First-Pass Yield: 87.3% (+2.1% ↗️)\n• Time to Board: 1.8h (-0.3h improvement)\n• Exception Auto-Clear: 73% (+5%)\n• Compliance Score: 100%\n\n⚡ **System Health:**\n• Uptime: 23h 45m\n• Active Agents: 4/4 operational\n• Processing Capacity: 78% utilized\n• No critical alerts\n\nAll systems are performing within optimal parameters. Great job on exceeding your FPY target!`,
        timestamp: new Date(),
        suggestions: ['Show detailed metrics', 'View agent performance', 'Check pipeline capacity'],
        data: { fpy: 87.3, timeToBoard: 1.8, compliance: 100 }
      };
    }

    if (lowerQuery.includes('fpy') || lowerQuery.includes('first-pass') || lowerQuery.includes('yield')) {
      return {
        id: Date.now().toString(),
        type: 'assistant',
        content: `📈 **First-Pass Yield Analysis**\n\n**Current Performance:**\n• FPY: 87.3% (Target: 85%) ✅\n• Trend: +2.1% improvement over last period\n• Ranking: Exceeding industry benchmarks\n\n**Contributing Factors:**\n✅ Improved document pre-validation (+3.2%)\n✅ Enhanced OCR accuracy (+1.8%)\n✅ Better exception auto-resolution (+2.7%)\n\n**Recommendations:**\n🎯 Continue current document validation protocols\n🎯 Expand auto-fix rules to cover more scenarios\n🎯 Consider implementing predictive exception detection\n\nYou're on track to achieve 90% FPY by month-end!`,
        timestamp: new Date(),
        suggestions: ['Implement predictive detection', 'Analyze failed loans', 'Export FPY report'],
        data: { currentFPY: 87.3, target: 85, improvement: 2.1 }
      };
    }

    // Default response
    return {
      id: Date.now().toString(),
      type: 'assistant',
      content: `I understand you're asking about "${query}". I can help you with:\n\n🎯 **Operations:** Exception management, loan boarding, document processing\n📊 **Analytics:** Performance metrics, trends, compliance reporting\n⚙️ **System:** Status monitoring, agent performance, pipeline health\n🔧 **Automation:** Auto-fix suggestions, workflow optimization\n\nCould you be more specific about what you'd like to know? I'm here to help optimize your loan boarding operations!`,
      timestamp: new Date(),
      suggestions: ['Show system overview', 'List current exceptions', 'Analyze performance trends', 'Check compliance status'],
    };
  };

  const handleQuickAction = (action: QuickAction) => {
    setInputValue(action.query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    // Voice recognition would be implemented here
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <header className="px-6 py-4">
        <div className="flex items-center caption-text mb-1">
          <span>Command Center</span>
          <span className="mx-2">›</span>
          <span className="text-gray-900">Assistant</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="section-header text-gray-900" data-testid="page-title">
              Assistant
            </h1>
            <p className="body-text text-gray-500 mt-1">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}! Manage your loan boarding operations from your central dashboard.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <Brain className="w-3 h-3 mr-1" />
              GPT-5 Powered
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Zap className="w-3 h-3 mr-1" />
              Real-time Data
            </Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action)}
                className="p-3 rounded-lg border hover:bg-gray-50 transition-colors group text-center"
                data-testid={`quick-action-${index}`}
              >
                <action.icon className="w-5 h-5 mx-auto mb-2 text-gray-600 group-hover:text-blue-600" />
                <p className="label-text text-gray-900">{action.label}</p>
                <p className="caption-text">{action.category}</p>
              </button>
            ))}
          </div>
          
          {/* Chat Interface */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <div className="flex items-start space-x-2">
                      {message.type === 'assistant' && (
                        <Bot className="w-4 h-4 mt-0.5 text-blue-600" />
                      )}
                      {message.type === 'user' && (
                        <User className="w-4 h-4 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="body-text whitespace-pre-line">{message.content}</p>
                        {message.type === 'assistant' && message.data?.visualization && (
                          <AssistantChart spec={message.data.visualization} />
                        )}
                        <p className={`caption-text mt-2 ${message.type === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Suggestions */}
                    {message.suggestions && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="caption-text px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
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
                  <div className="bg-gray-100 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Bot className="w-4 h-4 text-blue-600" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>
        
      {/* Input Area - Fixed at bottom */}
      <div className="px-6 pb-6">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask me anything about loans, exceptions, metrics, or system status..."
              className="pr-12"
              data-testid="ai-input"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleListening}
              className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 h-6 w-6 ${
                isListening ? 'text-red-600' : 'text-gray-400'
              }`}
              data-testid="voice-button"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          </div>
          <Button onClick={handleSendMessage} disabled={!inputValue.trim()} data-testid="send-button">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
