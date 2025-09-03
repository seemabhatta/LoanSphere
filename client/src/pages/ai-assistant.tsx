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
  Brain,
  Loader2,
  CheckCircle,
  AlertCircle
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
  data?: any;
}

interface QuickAction {
  label: string;
  query: string;
  icon: any;
  category: string;
}

type AgentMode = '@general' | '@datamodel';

interface SnowflakeConnection {
  id: string;
  name: string;
  account: string;
  username: string;
  database?: string;
  schema?: string;
  is_default: boolean;
  is_active: boolean;
}

export default function AIAssistant() {
  const { user } = useAuth();

  const getWelcomeMessage = (mode: AgentMode) => {
    if (mode === '@datamodel') {
      return `Hello! I'm your @datamodel agent. I can help you generate YAML data dictionaries from your Snowflake tables. I'll guide you through selecting databases, schemas, and tables to create comprehensive data models.`;
    }
    return `Hello! I'm your AI Assistant for Xpanse Loan Xchange. I can help you with loan boarding, exception management, analytics, and system operations. What would you like to know?`;
  };

  const [agentMode, setAgentMode] = useState<AgentMode>('@general');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState('');
  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [datamodelSessionId, setDatamodelSessionId] = useState<string | null>(null);
  const [connections, setConnections] = useState<SnowflakeConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load Snowflake connections on mount and auto-connect if in @datamodel mode
  useEffect(() => {
    const initializeConnections = async () => {
      await loadConnections();
      
      // Auto-connect if we're in @datamodel mode and have a selected connection
      if (agentMode === '@datamodel' && selectedConnection && !datamodelSessionId) {
        setTimeout(() => {
          startDatamodelSession(selectedConnection);
        }, 1000); // Wait 1 second for connections to load
      }
    };
    
    initializeConnections();
  }, []);

  // Reset session and messages when agent mode changes
  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    setDatamodelSessionId(null);
    setInputValue('');

    // Auto-connect to default connection when switching to @datamodel mode
    if (agentMode === '@datamodel' && selectedConnection && !datamodelSessionId) {
      const timer = setTimeout(() => {
        startDatamodelSession(selectedConnection);
      }, 500); // Small delay to let UI update
      
      return () => clearTimeout(timer);
    }
  }, [agentMode, selectedConnection]);

  const loadConnections = async () => {
    try {
      setConnectionsLoading(true);
      const result = await apiRequest('GET', '/api/snowflake/connections');
      setConnections(result);
      
      // Auto-select default or first active connection
      const defaultConn = result.find((c: SnowflakeConnection) => c.is_default && c.is_active);
      const firstActive = result.find((c: SnowflakeConnection) => c.is_active);
      let connectionToSelect = null;
      
      if (defaultConn) {
        connectionToSelect = defaultConn.id;
        setSelectedConnection(defaultConn.id);
      } else if (firstActive) {
        connectionToSelect = firstActive.id;
        setSelectedConnection(firstActive.id);
      }
      
      // Auto-connect if we're in @datamodel mode and just selected a connection
      if (agentMode === '@datamodel' && connectionToSelect && !datamodelSessionId) {
        setTimeout(() => {
          startDatamodelSession(connectionToSelect);
        }, 1000);
      }
    } catch (err: any) {
      console.error('Error loading connections:', err);
      toast({
        title: 'Connection Error',
        description: 'Failed to load Snowflake connections',
        variant: 'destructive'
      });
    } finally {
      setConnectionsLoading(false);
    }
  };

  const startDatamodelSession = async (connectionId: string) => {
    try {
      setIsTyping(true);
      setTypingMessage('Connecting to Snowflake database...');
      const result = await apiRequest('POST', '/api/ai-agent/datamodel/start', {
        connection_id: connectionId
      }, { timeout: 45000 }); // 45 second timeout for database connections
      
      setDatamodelSessionId(result.session_id);
      
      // Add auto-initialization message from the agent (like DataMind CLI)
      const initializationMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: result.initialization_message || `🎉 Connected to ${result.connection_name}!\n\nI'm ready to help you generate YAML data dictionaries. You can now type your request (e.g., "show databases", "list databases", etc.)`,
        timestamp: new Date()
      };
      
      setMessages([initializationMessage]);
      
      // Connect to SSE stream for auto-init progress updates
      connectToProgressStream(result.session_id);
      
      toast({
        title: '@datamodel Agent Started',
        description: `Connected to ${result.connection_name}`,
      });
      
    } catch (err: any) {
      toast({
        title: 'Connection Failed',
        description: err?.message || 'Failed to start @datamodel agent session',
        variant: 'destructive'
      });
    } finally {
      setIsTyping(false);
      setTypingMessage('');
    }
  };

  // Connect to SSE stream for progress updates
  const connectToProgressStream = (sessionId: string) => {
    // Use direct backend URL for SSE to bypass proxy issues
    const eventSourceUrl = `http://localhost:8000/api/ai-agent/datamodel/progress/${sessionId}`;
    const eventSource = new EventSource(eventSourceUrl);
    
    eventSource.onopen = () => {
      console.log('SSE connection opened for session:', sessionId);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'auto_init' && data.message) {
          // Add auto-init message to chat
          const autoInitMessage: Message = {
            id: `${Date.now()}-auto-init`,
            type: 'assistant',
            content: data.message,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, autoInitMessage]);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
    };
    
    // Store eventSource reference for cleanup
    return eventSource;
  };

  // SSE cleanup when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup any active EventSource connections
    };
  }, []);

  // Helper to send a direct query (used by graph node clicks)
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
      });
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
      toast({ title: 'AI Assistant Error', description: err?.message || 'Failed to contact AI service.', variant: 'destructive' });
    } finally {
      setIsTyping(false);
      setTypingMessage('');
    }
  };

  // Test SSE connection manually
  // SSE test functionality temporarily disabled

  const quickActions: QuickAction[] = agentMode === '@datamodel' ? [
    // @datamodel specific actions
    { label: 'Browse Databases', query: 'Show me the available databases', icon: FileText, category: 'Browse' },
    { label: 'Browse Schemas', query: 'List the schemas in my database', icon: FileText, category: 'Browse' },
    { label: 'Browse Tables', query: 'Show me the tables in my schema', icon: FileText, category: 'Browse' },
    { label: 'Generate Dictionary', query: 'Generate a YAML dictionary for my selected tables', icon: TrendingUp, category: 'Generate' },
  ] : [
    // @general mode actions
    { label: 'Recent Loans', query: 'List recent loans and summarize statuses', icon: FileText, category: 'Loans' },
    { label: 'Graph Latest Loan', query: 'Show the latest loan data and visualize it as a knowledge graph', icon: TrendingUp, category: 'Loans' },
    { label: 'Commitments', query: 'List commitments with IDs, then show details for the latest', icon: FileText, category: 'Commitments' },
    { label: 'Commitment (Raw)', query: 'Show raw commitment JSON for the latest commitment', icon: Lightbulb, category: 'Commitments' },
    { label: 'Purchase Advices', query: 'List purchase advices and show a concise summary of the latest', icon: FileText, category: 'Purchase Advice' },
    { label: 'PA (Raw)', query: 'Show raw purchase advice JSON for the latest purchase advice', icon: Lightbulb, category: 'Purchase Advice' },
    { label: 'Tracking Status', query: 'Show loan tracking status summary', icon: Clock, category: 'Loan Tracking' },
    { label: 'SLA Risks', query: 'Which loans are at risk of missing SLA targets?', icon: AlertTriangle, category: 'Loan Tracking' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return; // Prevent sending while already processing
    
    // Debounce: prevent rapid successive requests
    const now = Date.now();
    if (now - lastRequestTime < 1000) return; // 1 second debounce
    setLastRequestTime(now);

    // Handle @datamodel mode
    if (agentMode === '@datamodel') {
      await handleDatamodelMessage();
      return;
    }

    // Handle @general mode
    await handleGeneralMessage();
  };

  const handleGeneralMessage = async () => {
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
      setTypingMessage('');
    }
  };

  const handleDatamodelMessage = async () => {
    // If session doesn't exist, user needs to wait for auto-connection or select a connection
    if (!datamodelSessionId) {
      if (!selectedConnection) {
        toast({
          title: 'No Connection Selected',
          description: 'Please select a Snowflake connection above.',
          variant: 'destructive'
        });
        return;
      }
      
      // Connection is in progress, show message
      toast({
        title: 'Connecting...',
        description: 'Please wait while we establish the connection to Snowflake.',
      });
      return;
    }

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

    // SSE temporarily disabled - using simple loading states instead
    
    setTypingMessage('Processing your request...');
    
    // Detect if this is a long-running operation that needs async processing
    // ANY datamodel operation can be slow due to Snowflake connection time
    const isLongRunningOperation = agentMode === '@datamodel';

    let statusInterval: NodeJS.Timeout | null = null;
    let result;

    try {
      console.log('isLongRunningOperation:', isLongRunningOperation);
      console.log('agentMode:', agentMode);
      
      if (isLongRunningOperation) {
        // Use SSE streaming for @datamodel operations
        console.log('Using SSE streaming for:', outgoing);
        
        const eventSource = new EventSource(
          `/api/ai-agent/datamodel/chat/stream/${datamodelSessionId}?message=${encodeURIComponent(outgoing)}`
        );
        
        let streamResult: any = null;
        const streamPromise = new Promise((resolve, reject) => {
          // Set a timeout to prevent infinite waiting
          const timeout = setTimeout(() => {
            console.warn('SSE stream timeout after 5 minutes');
            eventSource.close();
            if (streamResult) {
              resolve(streamResult);
            } else {
              reject(new Error('Request timed out. Please try again.'));
            }
          }, 300000); // 5 minutes
          
          eventSource.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log('SSE message received:', data);
              
              if (data.type === 'chat_progress') {
                setTypingMessage(data.message);
              } else if (data.type === 'chat_result') {
                streamResult = data.data;
                clearTimeout(timeout);
                eventSource.close();
                resolve(streamResult);
              } else if (data.type === 'error') {
                clearTimeout(timeout);
                eventSource.close();
                reject(new Error(data.message));
              }
            } catch (parseError) {
              console.error('Error parsing SSE message:', parseError);
            }
          };
          
          eventSource.onerror = (error) => {
            console.error('SSE error:', error);
            clearTimeout(timeout);
            eventSource.close();
            
            // Check if we received any result before the error
            if (streamResult) {
              console.log('SSE connection closed but result was received, proceeding...');
              resolve(streamResult);
            } else {
              // Only reject if no result was received
              reject(new Error('Connection error during streaming'));
            }
          };
        });
        
        result = await streamPromise;
        
      } else {
        // Use synchronous processing for quick operations  
        console.log('Using SYNC processing for:', outgoing);
        setTypingMessage('Processing your request synchronously...');
        
        result = await apiRequest('POST', '/api/ai-agent/datamodel/chat', {
          session_id: datamodelSessionId,
          message: outgoing
        }, { timeout: 30000 }); // 30 second timeout for quick operations
      }

      console.log('@datamodel agent response received:', result);
      console.log('@datamodel agent response type:', typeof result);
      console.log('@datamodel agent response keys:', Object.keys(result || {}));

      const aiMessage: Message = {
        id: `${Date.now()}-assistant`,
        type: 'assistant',
        content: result?.response ?? 'No response received.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('@datamodel agent chat error:', err);
      console.error('@datamodel agent full error details:', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        response: err?.response
      });
      toast({
        title: '@datamodel Agent Error',
        description: err?.message || 'Failed to contact @datamodel agent.',
        variant: 'destructive'
      });
      const errMessage: Message = {
        id: `${Date.now()}-assistant-error`,
        type: 'assistant',
        content: `Sorry, I could not process your request right now. Error: ${err?.message || 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errMessage]);
    } finally {
      // Clear status polling interval
      if (statusInterval) {
        clearInterval(statusInterval);
      }
      setIsTyping(false);
      setTypingMessage('');
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
    <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
      {/* Header with Agent Mode Selector */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h1 className="text-lg font-semibold">
              {agentMode === '@datamodel' ? 'Data Model & Dictionary Generator' : 'AI Assistant'}
            </h1>
            <p className="text-sm text-gray-500">
              {agentMode === '@datamodel' 
                ? 'Generate YAML data dictionaries from Snowflake tables'
                : 'Your AI-powered assistant for loan operations'
              }
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Agent Mode Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Mode:</label>
              <select 
                value={agentMode}
                onChange={(e) => setAgentMode(e.target.value as AgentMode)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                data-testid="agent-mode-selector"
              >
                <option value="@general">@general</option>
                <option value="@datamodel">@datamodel</option>
              </select>
            </div>

            {/* Connection Picker for @datamodel mode */}
            {agentMode === '@datamodel' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Connection:</label>
                {connectionsLoading ? (
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading connections...
                  </div>
                ) : connections.length === 0 ? (
                  <div className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    No connections available
                  </div>
                ) : (
                  <>
                    <select 
                      value={selectedConnection}
                      onChange={(e) => {
                        setSelectedConnection(e.target.value);
                        setDatamodelSessionId(null); // Reset session when connection changes
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm min-w-48"
                      data-testid="connection-picker"
                      disabled={isTyping}
                    >
                      {connections.filter(c => c.is_active).map((conn) => (
                        <option key={conn.id} value={conn.id}>
                          {conn.name} {conn.is_default && '(Default)'}
                        </option>
                      ))}
                    </select>
                    
                    {/* Connection Status Indicator */}
                    <div className="flex items-center gap-1">
                      {datamodelSessionId ? (
                        <>
                          <div className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Connected
                          </div>
                        </>
                      ) : selectedConnection ? (
                        <div className="text-xs text-yellow-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Ready to connect
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Select connection
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col pb-20">
        {/* Welcome Section */}
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">
                {agentMode === '@datamodel' ? '📊 Data Model Generator' : '🤖 AI Assistant'}
              </h2>
              <p className="body-text text-gray-600 max-w-lg">
                {getWelcomeMessage(agentMode)}
              </p>
              
              {/* Connection Status for @datamodel mode */}
              {agentMode === '@datamodel' && (
                <div className="mt-4 p-3 rounded-lg" data-testid="connection-status">
                  {datamodelSessionId ? (
                    <div className="flex items-center justify-center gap-2 text-green-700 bg-green-50 p-2 rounded">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        ✅ Connected to {connections.find(c => c.id === selectedConnection)?.name}
                      </span>
                    </div>
                  ) : selectedConnection ? (
                    <div className="flex items-center justify-center gap-2 text-blue-700 bg-blue-50 p-2 rounded">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">
                        Connecting to {connections.find(c => c.id === selectedConnection)?.name || 'Snowflake'}...
                      </span>
                    </div>
                  ) : connections.length === 0 ? (
                    <div className="text-orange-700 text-sm bg-orange-50 p-2 rounded">
                      No Snowflake connections available. Please configure a connection first.
                    </div>
                  ) : (
                    <div className="text-orange-700 text-sm bg-orange-50 p-2 rounded">
                      Please select a Snowflake connection above.
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Suggestion Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
              {quickActions.slice(0, 4).map((action, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(action)}
                  className="p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid={`suggestion-${index}`}
                  disabled={isTyping}
                >
                  <action.icon className="w-5 h-5 text-gray-500 mb-3 group-hover:text-blue-600 transition-colors" />
                  <p className="text-gray-900 font-medium mb-1 text-[12px] group-hover:text-blue-900">{action.label}</p>
                  <p className="caption-text group-hover:text-blue-700 transition-colors">{action.query}</p>
                  <p className="text-xs text-gray-400 mt-2 group-hover:text-blue-500">Click to run →</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Interface */}
        {messages.length > 0 && (
          <div className="flex-1 flex flex-col p-6">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 max-w-4xl mx-auto w-full">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-4 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <div className="flex items-start space-x-3">
                      {message.type === 'assistant' && (
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Bot className="w-3 h-3 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="body-text whitespace-pre-line">{message.content}</p>
                        {message.type === 'assistant' && (message as any).data?.visualization && (
                          (message as any).data.visualization.type === 'graph' ? (
                            <AssistantGraphInteractive spec={(message as any).data.visualization} />
                          ) : (
                            <AssistantChart spec={(message as any).data.visualization} />
                          )
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
                  <div className="bg-gray-100 rounded-lg p-4 max-w-[80%]">
                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex space-x-1 mb-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        {typingMessage && (
                          <div className="text-xs text-gray-600 font-medium mb-2">
                            {typingMessage}
                          </div>
                        )}
                        {/* Progress updates temporarily disabled - using simple loading states */}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>
      {/* Input Area - Fixed at content bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-white p-6">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSendMessage()}
              placeholder={
                isTyping 
                  ? "Processing your request..." 
                  : agentMode === '@datamodel' 
                    ? "Ask about databases, schemas, tables, or dictionary generation..."
                    : "Ask me anything about loans, exceptions, metrics, or system status..."
              }
              className={`pr-12 ${isTyping ? 'bg-gray-50 text-gray-500' : ''}`}
              data-testid="ai-input"
              disabled={isTyping}
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
          <Button 
            onClick={handleSendMessage} 
            disabled={!inputValue.trim() || isTyping} 
            data-testid="send-button"
            className={`${isTyping ? 'bg-blue-500 text-white' : ''}`}
          >
            {isTyping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}