import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, FileText, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import PlotlyChart from '@/components/plotly-chart';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  visualization?: { type: string; html: string };
}

export default function AIAssistantDatamind() {
  const [mode, setMode] = useState<'query' | 'generate'>('query');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Auto-initialize when mode changes
  useEffect(() => {
    initializeAgent();
  }, [mode]);
  
  const initializeAgent = async () => {
    setIsInitializing(true);
    setMessages([]);
    setSessionId(null);
    setIsLoading(true);
    
    try {
      const data = await apiRequest('POST', '/api/datamind/chat', {
        message: '[INIT]',
        mode: mode
      }, {
        timeout: 120000 // 2 minutes timeout
      });
      setSessionId(data.session_id);
      setMessages([
        { 
          type: 'assistant', 
          content: data.response, 
          timestamp: new Date(),
          visualization: data.visualization
        }
      ]);
    } catch (error) {
      console.error('Error initializing agent:', error);
      setMessages([
        { 
          type: 'assistant', 
          content: 'Error initializing agent. Please try again.', 
          timestamp: new Date() 
        }
      ]);
    } finally {
      setIsInitializing(false);
      setIsLoading(false);
    }
  };
  
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    
    // Add user message
    setMessages(prev => [...prev, { 
      type: 'user', 
      content: userMessage, 
      timestamp: new Date() 
    }]);
    
    try {
      // Send to API
      const data = await apiRequest('POST', '/api/datamind/chat', {
        message: userMessage,
        mode: mode,
        session_id: sessionId
      }, {
        timeout: 180000 // 3 minutes timeout
      });
      
      // Add assistant response
      setMessages(prev => [...prev, { 
        type: 'assistant', 
        content: data.response, 
        timestamp: new Date(),
        visualization: data.visualization
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        type: 'assistant', 
        content: 'Error processing your message. Please try again.', 
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Datamind Assistant
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {sessionId ? `Session: ${sessionId.slice(-8)}` : 'No Session'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Mode:</span>
              <Select value={mode} onValueChange={(value: 'query' | 'generate') => setMode(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="query">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Natural Language Query
                    </div>
                  </SelectItem>
                  <SelectItem value="generate">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Dictionary Generator
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Chat messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {isInitializing && (
                <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    Initializing {mode === 'query' ? 'Query' : 'Dictionary Generator'} agent...
                  </span>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg ${
                    msg.type === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <div className="whitespace-pre-wrap text-sm">
                      {msg.content}
                    </div>
                    {msg.visualization && msg.visualization.type === 'plotly' && (
                      <PlotlyChart html={msg.visualization.html} />
                    )}
                    <div className={`text-xs mt-1 opacity-70`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && !isInitializing && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input area */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  mode === 'query' 
                    ? "Ask about your data..." 
                    : "Select tables to generate dictionary..."
                }
                disabled={isInitializing || isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage} 
                disabled={isInitializing || isLoading || !input.trim()}
                size="sm"
              >
                Send
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}