import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, TestTube, Database, Save, Snowflake, Settings2, CheckCircle, List, Edit, Trash2, Zap } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import DatabricksSettings from '@/components/settings/databricks-settings'

interface SnowflakeConnection {
  id: string
  user_id: string
  name: string
  account: string
  username: string
  database?: string
  schema?: string
  warehouse?: string
  role?: string
  authenticator?: string
  is_default: boolean
  is_active: boolean
  last_connected?: string
  has_password?: boolean
}

interface EnvironmentConfig {
  SNOWFLAKE_USER?: string
  SNOWFLAKE_ACCOUNT?: string
  SNOWFLAKE_WAREHOUSE?: string
  SNOWFLAKE_DATABASE?: string
  SNOWFLAKE_SCHEMA?: string
  SNOWFLAKE_ROLE?: string
}

export default function IntegrationsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SnowflakeConnection | null>(null)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [form, setForm] = useState({
    name: '',
    account: '',
    username: '',
    password: '',
    privateKey: '',
    database: '',
    schema: '',
    warehouse: '',
    role: '',
    authenticator: 'SNOWFLAKE',
    isDefault: true,
    isActive: true,
  })
  
  const [testingConnection, setTestingConnection] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const qc = useQueryClient()

  // Fetch environment configuration to populate defaults
  const { data: envConfig } = useQuery<EnvironmentConfig>({
    queryKey: ['env-config'],
    queryFn: async () => {
      // This would call an API to get safe env config (without password)
      // For now, we'll populate with expected values
      return {
        SNOWFLAKE_USER: 'nl2sql_service_user',
        SNOWFLAKE_ACCOUNT: 'KIXUIIJ-MTC00254',
        SNOWFLAKE_WAREHOUSE: 'CORTEX_ANALYST_WH',
        SNOWFLAKE_DATABASE: 'CORTES_DEMO_2', 
        SNOWFLAKE_SCHEMA: 'CORTEX_DEMO',
        SNOWFLAKE_ROLE: 'nl2sql_service_role'
      }
    }
  })

  // Fetch existing connections
  const { data: connections = [], isLoading: connectionsLoading } = useQuery<SnowflakeConnection[]>({
    queryKey: ['snowflake-connections-v2'],
    queryFn: async () => {
      return apiRequest('GET', '/api/snowflake/connections')
    },
  })

  // Populate form with environment defaults when envConfig loads
  useEffect(() => {
    if (envConfig && showForm) {
      setForm(prev => ({
        ...prev,
        name: prev.name || 'Production Snowflake',
        account: prev.account || envConfig.SNOWFLAKE_ACCOUNT || '',
        username: prev.username || envConfig.SNOWFLAKE_USER || '',
        database: prev.database || envConfig.SNOWFLAKE_DATABASE || '',
        schema: prev.schema || envConfig.SNOWFLAKE_SCHEMA || '',
        warehouse: prev.warehouse || envConfig.SNOWFLAKE_WAREHOUSE || '',
        role: prev.role || envConfig.SNOWFLAKE_ROLE || '',
      }))
    }
  }, [envConfig, showForm])

  // Save connection mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/snowflake/connections', {
        name: form.name,
        account: form.account,
        username: form.username,
        password: form.password,
        privateKey: form.privateKey,
        database: form.database,
        schema: form.schema,
        warehouse: form.warehouse,
        role: form.role,
        authenticator: form.authenticator,
        isDefault: form.isDefault,
        isActive: form.isActive
      })
    },
    onSuccess: (data) => {
      // 1. Save to database (already handled by the API)
      
      // 2. Close the modal/form window automatically
      setShowForm(false)
      
      // 3. Return to integrations list view, refreshed to show the newly saved connection
      qc.invalidateQueries({ queryKey: ['snowflake-connections-v2'] })
      
      // 4. Success notification (toast) to confirm the save
      toast({
        title: "Connection Saved Successfully!",
        description: `"${form.name}" has been saved and is ready to use.`,
        variant: "default"
      })
      
      // Reset form for next use
      setForm({
        name: '',
        account: '',
        username: '',
        password: '',
        privateKey: '',
        database: '',
        schema: '',
        warehouse: '',
        role: '',
        authenticator: 'SNOWFLAKE',
        isDefault: true,
        isActive: true,
      })
      
      // Clear any test results
      setTestResult(null)
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Connection",
        description: error?.message || "An error occurred while saving the connection.",
        variant: "destructive"
      })
    }
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingConnection) throw new Error('No connection to edit')
      
      const connectionData = {
        name: form.name,
        account: form.account,
        username: form.username,
        // Only include password if it was changed (not the masked placeholder)
        password: passwordChanged && form.password !== '********' ? form.password : undefined,
        privateKey: form.privateKey || null,
        database: form.database || null,
        schema: form.schema || null,
        warehouse: form.warehouse || null,
        role: form.role || null,
        authenticator: form.authenticator,
        is_default: form.isDefault,
        is_active: form.isActive
      }
      
      return apiRequest('PUT', `/api/snowflake/connections/${editingConnection.id}`, connectionData)
    },
    onSuccess: () => {
      toast({
        title: "Connection Updated Successfully!",
        description: `${form.name} has been updated.`,
      })
      
      resetForm()
      
      // Refresh connections list
      qc.invalidateQueries({ queryKey: ['snowflake-connections-v2'] })
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Connection",
        description: error.message || "Failed to update connection. Please try again.",
        variant: "destructive",
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      return apiRequest('DELETE', `/api/snowflake/connections/${connectionId}`)
    },
    onSuccess: () => {
      toast({
        title: "Connection Deleted Successfully!",
        description: "The Snowflake connection has been removed.",
      })
      
      // Refresh connections list
      qc.invalidateQueries({ queryKey: ['snowflake-connections-v2'] })
    },
    onError: (error: any) => {
      toast({
        title: "Error Deleting Connection",
        description: error.message || "Failed to delete connection. Please try again.",
        variant: "destructive",
      })
    },
  })

  const resetForm = () => {
    setForm({
      name: '',
      account: '',
      username: '',
      password: '',
      privateKey: '',
      database: '',
      schema: '',
      warehouse: '',
      role: '',
      authenticator: 'SNOWFLAKE',
      isDefault: true,
      isActive: true,
    })
    setShowForm(false)
    setEditMode(false)
    setEditingConnection(null)
    setPasswordChanged(false)
    setTestResult(null)
  }

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      try {
        // If we're editing and password hasn't been changed (still showing ********), test the stored connection
        if (editMode && editingConnection && !passwordChanged && form.password === '********') {
          const response = await apiRequest('POST', `/api/snowflake/connections/${editingConnection.id}/test`)
          return response
        }
        
        // If we're editing and password is empty (user cleared it), test stored connection
        if (editMode && editingConnection && !form.password.trim()) {
          const response = await apiRequest('POST', `/api/snowflake/connections/${editingConnection.id}/test`)
          return response
        }
        
        // Otherwise test with current form parameters
        if (!form.password.trim()) {
          return {
            success: false,
            message: 'Password is required for connection testing'
          }
        }
        
        const response = await apiRequest('POST', '/api/snowflake/test-connection', {
          name: form.name,
          account: form.account,
          username: form.username,
          password: form.password,
          database: form.database,
          schema: form.schema,
          warehouse: form.warehouse,
          role: form.role,
          authenticator: form.authenticator,
        })
        return response
      } catch (error: any) {
        return { 
          success: false, 
          message: error.message || 'Connection test failed'
        }
      }
    },
    onMutate: () => {
      setTestingConnection(true)
      setTestResult(null)
    },
    onSettled: () => setTestingConnection(false),
    onSuccess: (data) => setTestResult(data),
    onError: (error: any) => setTestResult({ 
      success: false, 
      message: error.message || 'Connection test failed' 
    })
  })

  // Handler for editing existing connection
  const handleEditConnection = (connection: SnowflakeConnection) => {
    setEditMode(true)
    setEditingConnection(connection)
    setPasswordChanged(false)
    setForm({
      name: connection.name,
      account: connection.account,
      username: connection.username,
      password: connection.has_password ? '********' : '', // Show masked placeholder if password exists
      database: connection.database || '',
      schema: connection.schema || '',
      warehouse: connection.warehouse || '',
      role: connection.role || '',
      authenticator: connection.authenticator || 'SNOWFLAKE',
      isDefault: connection.is_default,
      isActive: connection.is_active,
    })
    setShowForm(true)
    setTestResult(null)
  }

  const handleSave = () => {
    if (editMode && editingConnection) {
      updateMutation.mutate()
    } else {
      saveMutation.mutate()
    }
  }
  
  const handleTest = () => testMutation.mutate()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="section-header">Integrations</h1>
          <p className="body-text">Configure external system connections for agents</p>
        </div>
      </div>

      {/* Snowflake Integration Card */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 body-text">
                <Snowflake className="w-5 h-5" />
                Snowflake Data Warehouse
              </CardTitle>
              <CardDescription className="body-text">
                Connect to Snowflake for data analytics and agent queries
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Existing Connections List */}
          {!showForm && (
            <div className="space-y-4">
              {connectionsLoading ? (
                <div className="flex items-center gap-2 p-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="body-text">Loading connections...</span>
                </div>
              ) : connections.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="body-text">Saved Connections</h3>
                    <Button size="sm" onClick={() => {
                      resetForm()
                      setShowForm(true)
                    }}>
                      <Save className="w-4 h-4 mr-2" />
                      Add Connection
                    </Button>
                  </div>
                  
                  {connections.map((connection) => (
                    <Card key={connection.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Database className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="body-text">{connection.name}</h4>
                              <p className="body-text">
                                {connection.account} • {connection.username}
                                {connection.database && ` • ${connection.database}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {connection.is_default && (
                              <Badge variant="secondary" className="body-text">Default</Badge>
                            )}
                            <Badge variant="outline" className="body-text">
                              {connection.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleEditConnection(connection)}
                              data-testid={`button-edit-${connection.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => deleteMutation.mutate(connection.id)}
                              disabled={deleteMutation.isPending}
                              data-testid={`button-delete-${connection.id}`}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {connection.last_connected && (
                          <p className="body-text text-gray-500 mt-2">
                            Last connected: {new Date(connection.last_connected).toLocaleString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="body-text mb-2">No Connections Yet</h3>
                  <p className="body-text mb-4">
                    Add your first Snowflake connection to get started with data analytics.
                  </p>
                  <Button onClick={() => {
                    resetForm()
                    setShowForm(true)
                  }}>
                    <Save className="w-4 h-4 mr-2" />
                    Add Your First Connection
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Connection Form */}
          {showForm && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="body-text">
                  {editMode ? `Edit Connection: ${editingConnection?.name}` : 'Add New Connection'}
                </h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => resetForm()}
                >
                  <List className="w-4 h-4 mr-2" />
                  Back to List
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="body-text">Connection Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Production Snowflake"
              />
            </div>
            
            <div>
              <Label htmlFor="account" className="body-text">Account Identifier</Label>
              <Input
                id="account"
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                placeholder="KIXUIIJ-MTC00254"
              />
            </div>
            
            <div>
              <Label htmlFor="username" className="body-text">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="nl2sql_service_user"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="body-text">
                Password 
                {editMode && editingConnection?.has_password && !passwordChanged && (
                  <span className="text-sm text-green-600">(saved password shown)</span>
                )}
                {editMode && passwordChanged && (
                  <span className="text-sm text-blue-600">(will update)</span>
                )}
                {editMode && !editingConnection?.has_password && (
                  <span className="text-sm text-orange-600">(no password saved - enter new)</span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value })
                  setPasswordChanged(true)
                }}
                onFocus={() => {
                  if (editMode && form.password === '********') {
                    setForm({ ...form, password: '' })
                    setPasswordChanged(true)
                  }
                }}
                placeholder={
                  editMode && editingConnection?.has_password 
                    ? "Enter new password to update, or leave as ******** to keep current" 
                    : editMode 
                    ? "Enter password (none currently saved)"
                    : "Enter password"
                }
              />
            </div>
            
            <div>
              <Label htmlFor="warehouse" className="body-text">Warehouse</Label>
              <Input
                id="warehouse"
                value={form.warehouse}
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                placeholder="CORTEX_ANALYST_WH"
              />
            </div>
            
            <div>
              <Label htmlFor="database" className="body-text">Database</Label>
              <Input
                id="database"
                value={form.database}
                onChange={(e) => setForm({ ...form, database: e.target.value })}
                placeholder="CORTES_DEMO_2"
              />
            </div>
            
            <div>
              <Label htmlFor="schema" className="body-text">Schema</Label>
              <Input
                id="schema"
                value={form.schema}
                onChange={(e) => setForm({ ...form, schema: e.target.value })}
                placeholder="CORTEX_DEMO"
              />
            </div>
            
            <div>
              <Label htmlFor="role" className="body-text">Role</Label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="nl2sql_service_role"
              />
            </div>
            
            <div>
              <Label htmlFor="authenticator" className="body-text">Authenticator</Label>
              <Select value={form.authenticator} onValueChange={(value) => setForm({ ...form, authenticator: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select authentication method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SNOWFLAKE">Username/Password</SelectItem>
                  <SelectItem value="USERNAME_PASSWORD_MFA">MFA</SelectItem>
                  <SelectItem value="RSA">RSA Key-Pair (Recommended)</SelectItem>
                  <SelectItem value="PAT">Personal Access Token (PAT)</SelectItem>
                  <SelectItem value="EXTERNALBROWSER">SSO/Browser</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Show private key field for RSA authentication */}
            {form.authenticator === 'RSA' && (
              <div className="col-span-2">
                <Label htmlFor="privateKey" className="body-text">RSA Private Key</Label>
                <textarea
                  id="privateKey"
                  value={form.privateKey || ''}
                  onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                  placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                  className="w-full h-32 p-2 border rounded text-sm font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Paste your RSA private key here. This will be stored securely.
                </p>
              </div>
            )}
          </div>

          {/* Connection Options */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch 
                checked={form.isDefault}
                onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
              />
              <Label>Set as default connection</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch 
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className={`p-3 rounded-md text-sm ${
              testResult.success 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? '✅' : '❌'} 
                <span className="font-medium">
                  {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                </span>
              </div>
              {testResult.message && (
                <p className="mt-1 caption-text opacity-90">{testResult.message}</p>
              )}
            </div>
          )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4">
            <Button 
              onClick={handleTest}
              variant="outline"
              disabled={testingConnection}
            >
              {testingConnection ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <TestTube className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </Button>
            
            <Button 
              onClick={handleSave}
              disabled={!form.name || !form.account || !form.username || !form.password || saveMutation.isPending || updateMutation.isPending}
            >
              {(saveMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {editMode ? 'Update Connection' : 'Save Connection'}
            </Button>
            
            {saveMutation.isSuccess && (
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                ✅ Saved
              </Badge>
            )}
          </div>

              {/* Environment Notice */}
              <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                <p className="body-text text-blue-800">
                  <strong>💡 Auto-populated:</strong> Connection details are pre-filled from environment variables. 
                  Only enter the password to complete the setup.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Databricks Integration Card */}
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Zap className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2 body-text">
                <Zap className="w-5 h-5" />
                Databricks Data Intelligence Platform
              </CardTitle>
              <CardDescription className="body-text">
                Connect to Databricks for unified data analytics and AI workloads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <DatabricksSettings />
        </CardContent>
      </Card>
    </div>
  )
}