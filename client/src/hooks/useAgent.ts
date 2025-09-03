/**
 * Unified Agent Hook for LoanSphere
 * Handles all agent interactions with simplified state management
 */
import { useReducer, useRef, useCallback, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

// Types
export type AgentMode = '@general' | '@datamodel';

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SnowflakeConnection {
  id: string;
  name: string;
  account: string;
  username: string;
  database?: string;
  schema?: string;
  warehouse?: string;
  role?: string;
  authenticator: string;
  is_default: boolean;
  is_active: boolean;
}

export interface AgentModeInfo {
  mode: string;
  requires_connection: boolean;
  timeout: number;
  description: string;
}

export interface AgentState {
  // Current mode and messages
  mode: AgentMode;
  messages: Message[];
  sessionId: string | null;  // Track session for conversation continuity
  
  // UI state
  isTyping: boolean;
  typingMessage: string;
  isListening: boolean;
  
  // Connections
  connections: SnowflakeConnection[];
  selectedConnection: string;
  connectionsLoading: boolean;
  
  // Available modes
  availableModes: AgentModeInfo[];
  modesLoading: boolean;
  
  // Error handling
  error: string | null;
}

// Actions
type AgentAction = 
  | { type: 'SET_MODE'; mode: AgentMode }
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'SET_SESSION_ID'; sessionId: string | null }
  | { type: 'SET_TYPING'; isTyping: boolean; message?: string }
  | { type: 'SET_LISTENING'; isListening: boolean }
  | { type: 'SET_CONNECTIONS'; connections: SnowflakeConnection[] }
  | { type: 'SET_SELECTED_CONNECTION'; connectionId: string }
  | { type: 'SET_CONNECTIONS_LOADING'; loading: boolean }
  | { type: 'SET_AVAILABLE_MODES'; modes: AgentModeInfo[] }
  | { type: 'SET_MODES_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'CLEAR_MESSAGES' };

// Initial state
const initialState: AgentState = {
  mode: '@general',
  messages: [],
  sessionId: null,
  isTyping: false,
  typingMessage: '',
  isListening: false,
  connections: [],
  selectedConnection: '',
  connectionsLoading: false,
  availableModes: [],
  modesLoading: false,
  error: null,
};

// Reducer
const agentReducer = (state: AgentState, action: AgentAction): AgentState => {
  switch (action.type) {
    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
        error: null,
      };
      
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };
      
    case 'SET_SESSION_ID':
      return {
        ...state,
        sessionId: action.sessionId,
      };
      
    case 'SET_TYPING':
      return {
        ...state,
        isTyping: action.isTyping,
        typingMessage: action.message || '',
      };
      
    case 'SET_LISTENING':
      return {
        ...state,
        isListening: action.isListening,
      };
      
    case 'SET_CONNECTIONS':
      return {
        ...state,
        connections: action.connections,
        connectionsLoading: false,
        // Auto-select default connection if none selected
        selectedConnection: state.selectedConnection || 
          action.connections.find(c => c.is_default)?.id ||
          action.connections[0]?.id ||
          '',
      };
      
    case 'SET_SELECTED_CONNECTION':
      return {
        ...state,
        selectedConnection: action.connectionId,
      };
      
    case 'SET_CONNECTIONS_LOADING':
      return {
        ...state,
        connectionsLoading: action.loading,
      };
      
    case 'SET_AVAILABLE_MODES':
      return {
        ...state,
        availableModes: action.modes,
        modesLoading: false,
      };
      
    case 'SET_MODES_LOADING':
      return {
        ...state,
        modesLoading: action.loading,
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        isTyping: false,
        typingMessage: '',
      };
      
    case 'CLEAR_MESSAGES':
      return {
        ...state,
        messages: [],
        sessionId: null,  // Clear session when clearing messages
        error: null,
      };
      
    default:
      return state;
  }
};

// Custom hook
export const useAgent = () => {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const lastRequestTime = useRef<number>(0);
  
  // Load available modes on mount
  useEffect(() => {
    loadAvailableModes();
  }, []);
  
  // Load connections when switching to datamodel mode
  useEffect(() => {
    if (state.mode === '@datamodel' && state.connections.length === 0 && !state.connectionsLoading) {
      loadConnections();
    }
  }, [state.mode]);
  
  const loadAvailableModes = useCallback(async () => {
    dispatch({ type: 'SET_MODES_LOADING', loading: true });
    try {
      const result = await apiRequest('GET', '/api/agent/modes');
      dispatch({ type: 'SET_AVAILABLE_MODES', modes: result.modes });
    } catch (error) {
      console.error('Failed to load available modes:', error);
      dispatch({ type: 'SET_ERROR', error: 'Failed to load available modes' });
    }
  }, []);
  
  const loadConnections = useCallback(async () => {
    dispatch({ type: 'SET_CONNECTIONS_LOADING', loading: true });
    try {
      const result = await apiRequest('GET', '/api/snowflake/connections');
      dispatch({ type: 'SET_CONNECTIONS', connections: result });
    } catch (error) {
      console.error('Failed to load connections:', error);
      dispatch({ type: 'SET_ERROR', error: 'Failed to load connections' });
    }
  }, []);
  
  const setMode = useCallback((mode: AgentMode) => {
    dispatch({ type: 'SET_MODE', mode });
  }, []);
  
  const setSelectedConnection = useCallback((connectionId: string) => {
    dispatch({ type: 'SET_SELECTED_CONNECTION', connectionId });
  }, []);
  
  const clearMessages = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' });
  }, []);
  
  const addUserMessage = useCallback((content: string) => {
    const message: Message = {
      id: `${Date.now()}-user`,
      type: 'user',
      content,
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_MESSAGE', message });
    return message;
  }, []);
  
  const addAssistantMessage = useCallback((content: string) => {
    const message: Message = {
      id: `${Date.now()}-assistant`,
      type: 'assistant', 
      content,
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_MESSAGE', message });
    return message;
  }, []);
  
  const sendSimpleMessage = useCallback(async (message: string) => {
    dispatch({ type: 'SET_TYPING', isTyping: true, message: 'Processing your request...' });
    
    try {
      const result = await apiRequest('POST', '/api/agent/chat/simple', {
        mode: state.mode.replace('@', ''),
        message,
        connection_id: state.selectedConnection || undefined,
        session_id: state.sessionId || undefined,
      }, { timeout: 180000 }); // 3 minute timeout for complex operations
      
      addAssistantMessage(result.response);
      
      // Save session_id from response for next request
      if (result.session_id) {
        dispatch({ type: 'SET_SESSION_ID', sessionId: result.session_id });
      }
      
    } catch (error: any) {
      console.error('Chat error:', error);
      dispatch({ type: 'SET_ERROR', error: error.message || 'Failed to send message' });
    } finally {
      dispatch({ type: 'SET_TYPING', isTyping: false });
    }
  }, [state.mode, state.selectedConnection, state.sessionId, addAssistantMessage]);

  const sendMessage = useCallback(async (message: string) => {
    // Rate limiting
    const now = Date.now();
    if (now - lastRequestTime.current < 1000) {
      dispatch({ type: 'SET_ERROR', error: 'Please wait a moment between messages' });
      return;
    }
    lastRequestTime.current = now;
    
    // Clear any previous errors
    dispatch({ type: 'SET_ERROR', error: null });
    
    // Add user message
    addUserMessage(message);
    
    // Check if connection is required
    const modeInfo = state.availableModes.find(m => m.mode === state.mode.replace('@', ''));
    if (modeInfo?.requires_connection && !state.selectedConnection) {
      dispatch({ type: 'SET_ERROR', error: 'Please select a connection first' });
      return;
    }
    
    // Use simple message sending for all cases
    await sendSimpleMessage(message);
  }, [state.mode, state.selectedConnection, state.availableModes, addUserMessage, sendSimpleMessage]);
  
  // No cleanup needed for simple HTTP requests

  // Auto-trigger initialization when connection is selected for datamodel mode
  useEffect(() => {
    if (state.mode === '@datamodel' && state.selectedConnection && state.messages.length === 0) {
      // Send initialization trigger message to agent
      const connectionName = state.connections.find(c => c.id === state.selectedConnection)?.name || 'Unknown';
      sendMessage(`[INITIALIZE] Connection selected: ${connectionName}. Please connect to Snowflake and show me the available databases.`);
    }
  }, [state.mode, state.selectedConnection, state.connections, sendMessage]);
  
  return {
    state,
    actions: {
      setMode,
      setSelectedConnection,
      clearMessages,
      sendMessage,
      loadConnections,
      loadAvailableModes,
    },
  };
};