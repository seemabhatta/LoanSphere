import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, TestTube, Database, Save, Snowflake, Settings2 } from 'lucide-react'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

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
  const [form, setForm] = useState({
    name: '',
    account: '',
    username: '',
    password: '',
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

  // Populate form with environment defaults when envConfig loads
  useEffect(() => {
    if (envConfig) {
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
  }, [envConfig])

  // Save connection mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('User not authenticated')
      
      return apiRequest('POST', '/api/snowflake/connections', {
        userId: user.id,
        name: form.name,
        account: form.account,
        username: form.username,
        password: form.password,
        database: form.database,
        schema: form.schema,
        warehouse: form.warehouse,
        role: form.role,
        authenticator: form.authenticator,
        isDefault: form.isDefault,
        isActive: form.isActive
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snowflake-connections'] })
      // Reset password field after save
      setForm(prev => ({ ...prev, password: '' }))
    }
  })

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      // Test connection using environment variables
      try {
        const response = await apiRequest('POST', '/api/snowflake/test-env-connection')
        return response
      } catch (error: any) {
        // Fallback message for development
        return { 
          success: false, 
          message: 'Test endpoint not available - run: python3 test_snowflake_connection.py for manual test' 
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

  const handleSave = () => saveMutation.mutate()
  const handleTest = () => testMutation.mutate()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-gray-600">Configure external system connections for agents</p>
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
              <CardTitle className="flex items-center gap-2">
                <Snowflake className="w-5 h-5" />
                Snowflake Data Warehouse
              </CardTitle>
              <CardDescription>
                Connect to Snowflake for data analytics and agent queries
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Connection Form */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Connection Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Production Snowflake"
              />
            </div>
            
            <div>
              <Label htmlFor="account">Account Identifier</Label>
              <Input
                id="account"
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                placeholder="KIXUIIJ-MTC00254"
              />
            </div>
            
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="nl2sql_service_user"
              />
            </div>
            
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            
            <div>
              <Label htmlFor="warehouse">Warehouse</Label>
              <Input
                id="warehouse"
                value={form.warehouse}
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                placeholder="CORTEX_ANALYST_WH"
              />
            </div>
            
            <div>
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                value={form.database}
                onChange={(e) => setForm({ ...form, database: e.target.value })}
                placeholder="CORTES_DEMO_2"
              />
            </div>
            
            <div>
              <Label htmlFor="schema">Schema</Label>
              <Input
                id="schema"
                value={form.schema}
                onChange={(e) => setForm({ ...form, schema: e.target.value })}
                placeholder="CORTEX_DEMO"
              />
            </div>
            
            <div>
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="nl2sql_service_role"
              />
            </div>
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
                <p className="mt-1 text-xs opacity-90">{testResult.message}</p>
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
              disabled={!form.name || !form.account || !form.username || !form.password || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Connection
            </Button>
            
            {saveMutation.isSuccess && (
              <Badge variant="secondary" className="text-green-700 bg-green-100">
                ✅ Saved
              </Badge>
            )}
          </div>

          {/* Environment Notice */}
          <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>💡 Auto-populated:</strong> Connection details are pre-filled from environment variables. 
              Only enter the password to complete the setup.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}