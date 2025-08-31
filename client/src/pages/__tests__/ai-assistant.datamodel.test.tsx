/**
 * Test-Driven Development for AI Assistant @datamodel Mode
 * Tests written FIRST, then UI implementation follows
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import AIAssistant from '../ai-assistant';
import { apiRequest } from '@/lib/api';

// Mock dependencies
vi.mock('@/lib/api');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { name: 'Test User' } })
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

const mockApiRequest = apiRequest as any;

describe('AI Assistant - @datamodel Mode Integration (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Snowflake connections API
    mockApiRequest.mockImplementation((method: string, url: string, data?: any) => {
      if (url === '/api/settings/snowflake/connections') {
        return Promise.resolve([
          {
            id: 'conn-1',
            name: 'Test Snowflake Connection',
            account: 'test-account',
            username: 'test-user',
            database: 'TEST_DB',
            schema: 'TEST_SCHEMA',
            is_default: true,
            is_active: true
          },
          {
            id: 'conn-2', 
            name: 'Production Snowflake',
            account: 'prod-account',
            username: 'prod-user',
            is_default: false,
            is_active: true
          }
        ]);
      }
      
      if (url === '/api/agents/datamodel/start' && method === 'POST') {
        return Promise.resolve({
          session_id: 'datamodel_session_123',
          connection_name: 'Test Snowflake Connection'
        });
      }
      
      if (url === '/api/agents/datamodel/chat' && method === 'POST') {
        const message = data?.message || '';
        if (message.includes('database')) {
          return Promise.resolve({
            response: '📊 Found 2 databases: 1. TEST_DB  2. DEMO_DB. Which would you like to explore?',
            session_id: 'datamodel_session_123',
            context: {
              connection_id: 'conn-1',
              databases_available: ['TEST_DB', 'DEMO_DB']
            }
          });
        } else if (message === '1' && data?.context?.databases_available) {
          return Promise.resolve({
            response: '✅ Selected database: TEST_DB. Now browsing schemas...',
            session_id: 'datamodel_session_123',
            context: {
              connection_id: 'conn-1',
              current_database: 'TEST_DB',
              databases_available: ['TEST_DB', 'DEMO_DB']
            }
          });
        } else {
          return Promise.resolve({
            response: 'I can help you generate YAML data dictionaries! Let me connect to Snowflake and guide you through selecting databases, schemas, and tables.',
            session_id: 'datamodel_session_123',
            context: {
              connection_id: 'conn-1'
            }
          });
        }
      }
      
      return Promise.resolve({});
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('@datamodel Mode Selection', () => {
    it('should display @datamodel as an agent mode option', async () => {
      render(<AIAssistant />);
      
      // Should be able to find @datamodel mode option
      // This test will fail initially until we implement the mode selector
      await waitFor(() => {
        expect(screen.getByText('@datamodel')).toBeInTheDocument();
      });
    });

    it('should switch to @datamodel mode when selected', async () => {
      render(<AIAssistant />);
      
      // Find mode selector and switch to @datamodel
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      
      const datamodelOption = screen.getByText('@datamodel');
      fireEvent.click(datamodelOption);
      
      await waitFor(() => {
        expect(screen.getByText('Data Model & Dictionary Generator')).toBeInTheDocument();
        expect(screen.getByText(/generate YAML data dictionaries/i)).toBeInTheDocument();
      });
    });

    it('should show different welcome message for @datamodel mode', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByText(/I can help you generate YAML data dictionaries/i)).toBeInTheDocument();
        expect(screen.queryByText(/loan boarding/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Snowflake Connection Picker', () => {
    it('should load and display available Snowflake connections in @datamodel mode', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('GET', '/api/settings/snowflake/connections');
      });
      
      // Should show connection picker
      expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      expect(screen.getByText('Test Snowflake Connection')).toBeInTheDocument();
      expect(screen.getByText('Production Snowflake')).toBeInTheDocument();
    });

    it('should auto-select default connection in @datamodel mode', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        const connectionPicker = screen.getByTestId('connection-picker');
        expect(connectionPicker).toHaveValue('conn-1'); // Should auto-select default
      });
    });

    it('should allow changing Snowflake connection', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode and wait for connections to load
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      });
      
      // Change connection
      const connectionPicker = screen.getByTestId('connection-picker');
      fireEvent.change(connectionPicker, { target: { value: 'conn-2' } });
      
      await waitFor(() => {
        expect(connectionPicker).toHaveValue('conn-2');
      });
    });

    it('should show connection status indicator', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toBeInTheDocument();
        expect(screen.getByText(/Ready to connect to/i)).toBeInTheDocument();
        expect(screen.getByText('Test Snowflake Connection')).toBeInTheDocument();
      });
    });
  });

  describe('@datamodel Agent Chat Integration', () => {
    it('should start @datamodel agent session on first message', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      });
      
      // Send first message
      const input = screen.getByPlaceholderText(/Ask me anything/i);
      fireEvent.change(input, { target: { value: 'Hello, help me create a data model' } });
      
      const sendButton = screen.getByTestId('send-button');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/agents/datamodel/start', {
          connection_id: 'conn-1'
        });
      });
    });

    it('should handle @datamodel agent chat responses', async () => {
      render(<AIAssistant />);
      
      // Setup: Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      });
      
      // Send message to start session
      const input = screen.getByPlaceholderText(/Ask me anything/i);
      fireEvent.change(input, { target: { value: 'Start session' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(screen.getByText(/I can help you generate YAML data dictionaries/i)).toBeInTheDocument();
      });
      
      // Send follow-up message  
      fireEvent.change(input, { target: { value: 'show me databases' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/agents/datamodel/chat', {
          session_id: 'datamodel_session_123',
          message: 'show me databases',
          context: expect.any(Object)
        });
        
        expect(screen.getByText(/Found 2 databases.*TEST_DB.*DEMO_DB/)).toBeInTheDocument();
      });
    });

    it('should maintain agent context across chat messages', async () => {
      render(<AIAssistant />);
      
      // Setup @datamodel mode and start session
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Ask me anything/i);
      
      // Start session
      fireEvent.change(input, { target: { value: 'show databases' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(screen.getByText(/TEST_DB.*DEMO_DB/)).toBeInTheDocument();
      });
      
      // Respond with selection - should maintain context
      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/agents/datamodel/chat', 
          expect.objectContaining({
            message: '1',
            context: expect.objectContaining({
              databases_available: ['TEST_DB', 'DEMO_DB']
            })
          })
        );
        
        expect(screen.getByText(/Selected database: TEST_DB/)).toBeInTheDocument();
      });
    });
  });

  describe('@datamodel Mode Quick Actions', () => {
    it('should show @datamodel-specific quick actions', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        // Should show data modeling quick actions, not loan-related ones
        expect(screen.getByText('Browse Databases')).toBeInTheDocument();
        expect(screen.getByText('Browse Schemas')).toBeInTheDocument();
        expect(screen.getByText('Browse Tables')).toBeInTheDocument();
        expect(screen.getByText('Generate Dictionary')).toBeInTheDocument();
        
        // Should NOT show general assistant actions
        expect(screen.queryByText('Recent Loans')).not.toBeInTheDocument();
        expect(screen.queryByText('Commitments')).not.toBeInTheDocument();
      });
    });

    it('should handle quick action clicks in @datamodel mode', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode and wait for setup
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByText('Browse Databases')).toBeInTheDocument();
      });
      
      // Click quick action
      fireEvent.click(screen.getByText('Browse Databases'));
      
      await waitFor(() => {
        // Should start session and send appropriate message
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/agents/datamodel/start', {
          connection_id: 'conn-1'
        });
      });
    });
  });

  describe('Mode Switching and Session Management', () => {
    it('should clear messages when switching from @general to @datamodel', async () => {
      render(<AIAssistant />);
      
      // Start in general mode and send a message
      const input = screen.getByPlaceholderText(/Ask me anything/i);
      fireEvent.change(input, { target: { value: 'Show recent loans' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(screen.getByText('Show recent loans')).toBeInTheDocument();
      });
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      // Messages should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Show recent loans')).not.toBeInTheDocument();
        expect(screen.getByText(/generate YAML data dictionaries/i)).toBeInTheDocument();
      });
    });

    it('should clear messages when switching from @datamodel to @general', async () => {
      render(<AIAssistant />);
      
      // Start in @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByText(/generate YAML data dictionaries/i)).toBeInTheDocument();
      });
      
      // Send message
      const input = screen.getByPlaceholderText(/Ask me anything/i);
      fireEvent.change(input, { target: { value: 'show databases' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(screen.getByText('show databases')).toBeInTheDocument();
      });
      
      // Switch back to general mode
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@general'));
      
      // @datamodel messages should be cleared
      await waitFor(() => {
        expect(screen.queryByText('show databases')).not.toBeInTheDocument();
        expect(screen.queryByText(/generate YAML data dictionaries/i)).not.toBeInTheDocument();
        expect(screen.getByText(/loan boarding.*analytics/i)).toBeInTheDocument();
      });
    });

    it('should handle connection selection changes in @datamodel mode', async () => {
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      });
      
      // Start session with first connection
      const input = screen.getByPlaceholderText(/Ask me anything/i);
      fireEvent.change(input, { target: { value: 'hello' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/agents/datamodel/start', {
          connection_id: 'conn-1'
        });
      });
      
      // Change connection - should reset session
      const connectionPicker = screen.getByTestId('connection-picker');
      fireEvent.change(connectionPicker, { target: { value: 'conn-2' } });
      
      // Send another message - should start new session with new connection
      fireEvent.change(input, { target: { value: 'show databases' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/agents/datamodel/start', {
          connection_id: 'conn-2'
        });
      });
    });
  });

  describe('Error Handling in @datamodel Mode', () => {
    it('should handle connection errors gracefully', async () => {
      const mockToast = vi.fn();
      vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({ toast: mockToast });
      
      // Mock API error
      mockApiRequest.mockImplementation((method: string, url: string) => {
        if (url === '/api/settings/snowflake/connections') {
          return Promise.resolve([]);  // No connections
        }
        return Promise.resolve({});
      });
      
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByText(/No Snowflake connections available/i)).toBeInTheDocument();
        expect(screen.getByText(/Please configure a connection first/i)).toBeInTheDocument();
      });
    });

    it('should handle agent start session errors', async () => {
      const mockToast = vi.fn();
      vi.mocked(require('@/hooks/use-toast').useToast).mockReturnValue({ toast: mockToast });
      
      // Mock API error for session start
      mockApiRequest.mockImplementation((method: string, url: string) => {
        if (url === '/api/settings/snowflake/connections') {
          return Promise.resolve([{
            id: 'conn-1',
            name: 'Test Connection',
            is_default: true,
            is_active: true
          }]);
        }
        
        if (url === '/api/agents/datamodel/start') {
          return Promise.reject(new Error('Failed to connect to Snowflake'));
        }
        
        return Promise.resolve({});
      });
      
      render(<AIAssistant />);
      
      // Switch to @datamodel mode and try to send message
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      });
      
      const input = screen.getByPlaceholderText(/Ask me anything/i);
      fireEvent.change(input, { target: { value: 'start session' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Connection Failed',
          description: 'Failed to connect to Snowflake',
          variant: 'destructive'
        });
      });
    });
  });

  describe('Context and State Management', () => {
    it('should maintain separate contexts for different modes', async () => {
      render(<AIAssistant />);
      
      // Start in general mode
      let input = screen.getByPlaceholderText(/Ask me anything/i);
      fireEvent.change(input, { target: { value: 'general question' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      // Send @datamodel message
      await waitFor(() => {
        input = screen.getByPlaceholderText(/Ask me anything/i);
      });
      fireEvent.change(input, { target: { value: 'show databases' } });
      fireEvent.click(screen.getByTestId('send-button'));
      
      // Each mode should have its own session/context
      // This will be validated based on different API endpoints being called
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith('POST', '/api/agents/datamodel/start', 
          expect.any(Object));
        // General mode would call /api/agents/chat (different endpoint)
      });
    });
  });
});

describe('AI Assistant - @datamodel UI Components (TDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockApiRequest.mockImplementation((method: string, url: string) => {
      if (url === '/api/settings/snowflake/connections') {
        return Promise.resolve([{
          id: 'conn-1',
          name: 'Test Connection',
          account: 'test-account',
          is_default: true,
          is_active: true
        }]);
      }
      return Promise.resolve({});
    });
  });

  describe('Agent Mode Selector Component', () => {
    it('should render agent mode selector with @general and @datamodel options', async () => {
      render(<AIAssistant />);
      
      const modeSelector = screen.getByTestId('agent-mode-selector');
      expect(modeSelector).toBeInTheDocument();
      
      // Open dropdown
      fireEvent.click(modeSelector);
      
      await waitFor(() => {
        expect(screen.getByText('@general')).toBeInTheDocument();
        expect(screen.getByText('@datamodel')).toBeInTheDocument();
      });
    });

    it('should show current mode in selector', async () => {
      render(<AIAssistant />);
      
      const modeSelector = screen.getByTestId('agent-mode-selector');
      
      // Should default to @general
      expect(modeSelector).toHaveTextContent('@general');
      
      // Switch to @datamodel
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      await waitFor(() => {
        expect(modeSelector).toHaveTextContent('@datamodel');
      });
    });
  });

  describe('Connection Picker Component', () => {
    it('should only show connection picker in @datamodel mode', async () => {
      render(<AIAssistant />);
      
      // Should not show in @general mode
      expect(screen.queryByTestId('connection-picker')).not.toBeInTheDocument();
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      // Should show connection picker
      await waitFor(() => {
        expect(screen.getByTestId('connection-picker')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching connections', async () => {
      // Mock delayed connection loading
      mockApiRequest.mockImplementation((method: string, url: string) => {
        if (url === '/api/settings/snowflake/connections') {
          return new Promise(resolve => {
            setTimeout(() => resolve([]), 1000);
          });
        }
        return Promise.resolve({});
      });
      
      render(<AIAssistant />);
      
      // Switch to @datamodel mode
      const modeSelector = screen.getByTestId('agent-mode-selector');
      fireEvent.click(modeSelector);
      fireEvent.click(screen.getByText('@datamodel'));
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/Loading connections/i)).toBeInTheDocument();
      });
    });
  });
});