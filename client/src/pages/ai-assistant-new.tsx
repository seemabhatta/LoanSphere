/**
 * Simplified AI Assistant Component using Unified Agent System
 */
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, MicOff, Send, MessageSquare, Database, Trash2, RefreshCcw, Search } from "lucide-react";

import { useAgent, type AgentMode, type Message } from "@/hooks/useAgent";

export default function AIAssistantNew() {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { state, actions } = useAgent();
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);
  
  // Focus input when not typing
  useEffect(() => {
    if (!state.isTyping) {
      inputRef.current?.focus();
    }
  }, [state.isTyping]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || state.isTyping) return;
    
    const message = inputValue.trim();
    setInputValue('');
    
    await actions.sendMessage(message);
  };
  
  const handleModeChange = (newMode: string) => {
    actions.setMode(newMode as AgentMode);
    actions.clearMessages();
  };
  
  const handleConnectionChange = (connectionId: string) => {
    actions.setSelectedConnection(connectionId);
  };
  
  const getModeIcon = (mode: AgentMode) => {
    switch (mode) {
      case '@general':
        return <MessageSquare className="w-4 h-4" />;
      case '@datamodel':
        return <Database className="w-4 h-4" />;
      case '@query':
        return <Search className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };
  
  const getModeDisplay = (mode: AgentMode) => {
    return mode.replace('@', '').charAt(0).toUpperCase() + mode.slice(2);
  };
  
  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">AI Assistant</h1>
              <p className="text-muted-foreground">
                Unified agent system for loan data and Snowflake operations
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={actions.clearMessages}
              disabled={state.messages.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
          
          {/* Mode and Connection Selection */}
          <div className="flex gap-4">
            {/* Mode Selection */}
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Agent Mode</label>
              <Select value={state.mode} onValueChange={handleModeChange}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    {getModeIcon(state.mode)}
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {state.availableModes.map((mode) => (
                    <SelectItem key={mode.mode} value={`@${mode.mode}`}>
                      <div className="flex items-center gap-2">
                        {getModeIcon(`@${mode.mode}` as AgentMode)}
                        <span>{getModeDisplay(`@${mode.mode}` as AgentMode)}</span>
                        {mode.requires_connection && <span className="text-xs text-muted-foreground">(requires connection)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Connection Selection (only for modes that require it) */}
            {state.availableModes.find(m => m.mode === state.mode.replace('@', ''))?.requires_connection && (
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Snowflake Connection</label>
                  {state.connectionsLoading && (
                    <RefreshCcw className="w-3 h-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                <Select 
                  value={state.selectedConnection} 
                  onValueChange={handleConnectionChange}
                  disabled={state.connectionsLoading || state.connections.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      state.connectionsLoading 
                        ? "Loading connections..." 
                        : state.connections.length === 0 
                          ? "No connections available"
                          : "Select a connection"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {state.connections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <div className="flex flex-col">
                          <span>{conn.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {conn.account} • {conn.database || 'No DB'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {/* Status Messages */}
          {state.error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{state.error}</p>
            </div>
          )}
          
          {/* Connection Status */}
          {(state.mode === '@datamodel' || state.mode === '@query') && state.selectedConnection && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                ✅ Connected to {state.connections.find(c => c.id === state.selectedConnection)?.name}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full">
          <ScrollArea className="h-full p-4">
            {state.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="p-8">
                  {getModeIcon(state.mode)}
                  <h3 className="text-lg font-medium mt-4 mb-2">
                    Welcome to {getModeDisplay(state.mode)} Agent
                  </h3>
                  <p className="text-muted-foreground max-w-md">
                    {state.mode === '@general' 
                      ? "Ask me about loan data, commitments, boarding metrics, or any loan-related questions."
                      : state.mode === '@datamodel'
                        ? "I'll help you explore Snowflake databases and generate YAML data dictionaries. Make sure you've selected a connection above."
                        : state.mode === '@query'
                          ? "I'll help you query your Snowflake data using natural language. I can generate SQL queries, execute them, and create visualizations from the results."
                          : "How can I help you today?"
                    }
                  </p>
                  {(state.mode === '@datamodel' || state.mode === '@query') && !state.selectedConnection && (
                    <p className="text-sm text-orange-600 mt-2">
                      Please select a Snowflake connection to get started.
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {state.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* Typing Indicator */}
            {state.isTyping && (
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  {getModeIcon(state.mode)}
                </div>
                <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-75" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-150" />
                    </div>
                    <span className="text-sm text-muted-foreground">{state.typingMessage}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </ScrollArea>
        </div>
      </div>
      
      {/* Input Area */}
      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                (state.mode === '@datamodel' || state.mode === '@query') && !state.selectedConnection
                  ? "Select a connection first..."
                  : state.mode === '@general'
                    ? "Ask about loans, commitments, or boarding metrics..."
                    : state.mode === '@datamodel'
                      ? "Ask about databases, schemas, or request YAML generation..."
                      : state.mode === '@query'
                        ? "Ask natural language questions about your data, request SQL queries or charts..."
                        : "How can I help you today?"
              }
              disabled={
                state.isTyping || 
                ((state.mode === '@datamodel' || state.mode === '@query') && !state.selectedConnection)
              }
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={
                !inputValue.trim() || 
                state.isTyping || 
                ((state.mode === '@datamodel' || state.mode === '@query') && !state.selectedConnection)
              }
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.type === 'user';
  
  return (
    <div className={`flex items-start gap-3 mb-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-primary-foreground" />
        </div>
      )}
      
      <div className={`max-w-[70%] ${isUser ? 'order-first' : ''}`}>
        <div className={`rounded-lg p-3 ${
          isUser 
            ? 'bg-primary text-primary-foreground ml-auto' 
            : 'bg-muted'
        }`}>
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
        <div className={`text-xs text-muted-foreground mt-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
      
      {isUser && (
        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
          <span className="text-sm font-medium">You</span>
        </div>
      )}
    </div>
  );
}