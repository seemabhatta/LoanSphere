import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  History, 
  User, 
  Calendar, 
  Filter, 
  Search,
  FileText,
  Eye,
  Edit,
  Trash2,
  Shield,
  Download,
  RefreshCw
} from "lucide-react";
import PageWithAssistant from "@/components/page-with-assistant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  severity: string;
}

// Mock audit log data
const mockAuditEntries: AuditEntry[] = [
  {
    id: "1",
    timestamp: "2024-01-15 14:32:15",
    user: "john.doe@lender.com",
    action: "DOCUMENT_UPLOAD",
    resource: "Loan Document - LN240115001",
    details: "Uploaded appraisal document for loan LN240115001",
    ipAddress: "192.168.1.100",
    severity: "INFO"
  },
  {
    id: "2",
    timestamp: "2024-01-15 14:28:42",
    user: "system",
    action: "COMPLIANCE_CHECK",
    resource: "Compliance Rules Engine",
    details: "Automated TILA compliance verification completed",
    ipAddress: "10.0.0.1",
    severity: "INFO"
  },
  {
    id: "3",
    timestamp: "2024-01-15 14:25:33",
    user: "admin@system.com",
    action: "USER_PERMISSION_CHANGE",
    resource: "User: sarah.wilson@lender.com",
    details: "Updated user permissions - added loan_review role",
    ipAddress: "192.168.1.50",
    severity: "WARNING"
  },
  {
    id: "4",
    timestamp: "2024-01-15 14:20:18",
    user: "jane.smith@lender.com",
    action: "DATA_EXPORT",
    resource: "Loan Portfolio Report",
    details: "Exported Q4 2023 loan portfolio performance report",
    ipAddress: "192.168.1.75",
    severity: "INFO"
  },
  {
    id: "5",
    timestamp: "2024-01-15 14:15:05",
    user: "system",
    action: "FAILED_LOGIN_ATTEMPT",
    resource: "Authentication System",
    details: "Failed login attempt for user: unknown@external.com",
    ipAddress: "45.123.456.789",
    severity: "ERROR"
  }
];

export default function AuditLog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");

  const { data: auditEntries = mockAuditEntries } = useQuery<AuditEntry[]>({
    queryKey: ['/api/audit-log'],
    enabled: false // Using mock data
  });

  const filteredEntries = auditEntries.filter(entry => {
    const matchesSearch = searchTerm === "" || 
      entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.user.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || entry.action === actionFilter;
    const matchesSeverity = severityFilter === "all" || entry.severity === severityFilter;
    const matchesUser = userFilter === "all" || entry.user === userFilter;

    return matchesSearch && matchesAction && matchesSeverity && matchesUser;
  });

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "ERROR": return "destructive";
      case "WARNING": return "secondary";
      case "INFO": return "outline";
      default: return "outline";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "DOCUMENT_UPLOAD": return <FileText className="w-4 h-4" />;
      case "DATA_EXPORT": return <Download className="w-4 h-4" />;
      case "USER_PERMISSION_CHANGE": return <Shield className="w-4 h-4" />;
      case "COMPLIANCE_CHECK": return <Shield className="w-4 h-4" />;
      case "FAILED_LOGIN_ATTEMPT": return <User className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  return (
    <PageWithAssistant pageName="Audit Log">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-header">Audit Log</h1>
              <p className="detail-text text-gray-600 mt-1">
                Complete system activity and security audit trail
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                <History className="w-3 h-3 mr-1" />
                Live Monitoring
              </Badge>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="detail-text text-gray-500">Today's Events</p>
                      <p className="metric-medium text-blue-600">247</p>
                    </div>
                    <History className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="detail-text text-gray-500">Critical Events</p>
                      <p className="metric-medium text-red-600">3</p>
                    </div>
                    <Shield className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="detail-text text-gray-500">Active Users</p>
                      <p className="metric-medium text-green-600">42</p>
                    </div>
                    <User className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="detail-text text-gray-500">Data Exports</p>
                      <p className="metric-medium text-purple-600">12</p>
                    </div>
                    <Download className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filter Audit Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="detail-text text-gray-600">Search</label>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        placeholder="Search details, resource, user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                        data-testid="input-search"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="detail-text text-gray-600">Action</label>
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="DOCUMENT_UPLOAD">Document Upload</SelectItem>
                        <SelectItem value="DATA_EXPORT">Data Export</SelectItem>
                        <SelectItem value="USER_PERMISSION_CHANGE">Permission Change</SelectItem>
                        <SelectItem value="COMPLIANCE_CHECK">Compliance Check</SelectItem>
                        <SelectItem value="FAILED_LOGIN_ATTEMPT">Failed Login</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="detail-text text-gray-600">Severity</label>
                    <Select value={severityFilter} onValueChange={setSeverityFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="ERROR">Error</SelectItem>
                        <SelectItem value="WARNING">Warning</SelectItem>
                        <SelectItem value="INFO">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="detail-text text-gray-600">User</label>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="john.doe@lender.com">john.doe@lender.com</SelectItem>
                        <SelectItem value="admin@system.com">admin@system.com</SelectItem>
                        <SelectItem value="jane.smith@lender.com">jane.smith@lender.com</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="detail-text text-gray-600">Actions</label>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSearchTerm("");
                        setActionFilter("all");
                        setSeverityFilter("all");
                        setUserFilter("all");
                      }}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Log Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Audit Entries ({filteredEntries.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Severity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="detail-text">{entry.timestamp}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="detail-text">{entry.user}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(entry.action)}
                              <span className="detail-text">{entry.action.replace(/_/g, ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="detail-text">{entry.resource}</span>
                          </TableCell>
                          <TableCell>
                            <span className="detail-text">{entry.details}</span>
                          </TableCell>
                          <TableCell>
                            <span className="detail-text font-mono text-xs">{entry.ipAddress}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getSeverityBadgeVariant(entry.severity)}>
                              {entry.severity}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {filteredEntries.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No audit entries match your current filters</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageWithAssistant>
  );
}