import { create } from 'zustand';

interface Metrics {
  fpy: number;
  ttb: number;
  auto_clear_rate: number;
  open_exceptions: number;
  total_loans: number;
}

interface Agent {
  name: string;
  type: string;
  status: string;
  current_task?: string;
  last_activity?: string;
}

interface ActivityItem {
  id: string;
  xp_loan_number?: string;
  activity_type: string;
  status: string;
  message: string;
  agent_name?: string;
  timestamp: string;
}

interface Exception {
  id: string;
  xp_loan_number: string;
  rule_name: string;
  severity: string;
  status: string;
  confidence?: number;
  description: string;
  evidence?: any;
  auto_fix_suggestion?: any;
  detected_at: string;
  resolved_by?: string;
}

interface ComplianceStatus {
  respa_welcome?: {
    percentage: number;
    status: string;
    total?: number;
    on_time?: number;
  };
  escrow_setup?: {
    percentage: number;
    status: string;
    total?: number;
    on_time?: number;
  };
  tila_disclosure?: {
    percentage: number;
    status: string;
    total?: number;
    on_time?: number;
  };
  overall_status?: string;
}

interface DocumentProcessing {
  ocr_processing?: {
    queue: number;
    completed: number;
    progress: number;
  };
  classification?: {
    queue: number;
    completed: number;
    progress: number;
  };
  extraction?: {
    queue: number;
    completed: number;
    progress: number;
  };
  validation?: {
    queue: number;
    completed: number;
    progress: number;
  };
}

interface DashboardState {
  // State
  metrics: Metrics;
  agents: Agent[];
  recentActivity: ActivityItem[];
  exceptions: Exception[];
  complianceStatus: ComplianceStatus;
  documentProcessing: DocumentProcessing;
  selectedExceptionId: string | null;
  systemStatus: 'operational' | 'down';
  
  // Actions
  updateMetrics: (metrics: Metrics) => void;
  updateAgents: (agents: Agent[]) => void;
  updateRecentActivity: (activity: ActivityItem[]) => void;
  updateExceptions: (exceptions: Exception[]) => void;
  updateComplianceStatus: (status: ComplianceStatus) => void;
  updateDocumentProcessing: (processing: DocumentProcessing) => void;
  setSelectedExceptionId: (id: string | null) => void;
  setSystemStatus: (status: 'operational' | 'down') => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  // Initial state
  metrics: {
    fpy: 0,
    ttb: 0,
    auto_clear_rate: 0,
    open_exceptions: 0,
    total_loans: 0
  },
  agents: [],
  recentActivity: [],
  exceptions: [],
  complianceStatus: {},
  documentProcessing: {},
  selectedExceptionId: null,
  systemStatus: 'operational',
  
  // Actions
  updateMetrics: (metrics) => set({ metrics }),
  updateAgents: (agents) => set({ agents }),
  updateRecentActivity: (recentActivity) => set({ recentActivity }),
  updateExceptions: (exceptions) => set({ exceptions }),
  updateComplianceStatus: (complianceStatus) => set({ complianceStatus }),
  updateDocumentProcessing: (documentProcessing) => set({ documentProcessing }),
  setSelectedExceptionId: (selectedExceptionId) => set({ selectedExceptionId }),
  setSystemStatus: (systemStatus) => set({ systemStatus }),
}));
