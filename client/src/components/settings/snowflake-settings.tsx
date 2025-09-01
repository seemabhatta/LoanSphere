import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, TestTube, Database } from 'lucide-react'
import { apiRequest } from '@/lib/api'

interface SnowflakeConnection {
  id: string
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

export default function SnowflakeSettings() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({
    name: '', account: '', username: '', password: '',
    database: '', schema: '', warehouse: '', role: '',
    authenticator: 'SNOWFLAKE', isDefault: false, isActive: true,
  })
  const [testingId, setTestingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: connections = [], isLoading, error } = useQuery<SnowflakeConnection[]>({
    queryKey: ['snowflake-connections-v2'],
    queryFn: async () => {
      console.log('Fetching snowflake connections...');
      const result = await apiRequest('GET', '/api/snowflake/connections');
      console.log('Fetched connections:', result);
      return result;
    },
  })

  const createMut = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/snowflake/connections', {
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
      isActive: form.isActive,
    }),
    onSuccess: (data) => { 
      console.log('Connection created successfully:', data);
      qc.invalidateQueries({ queryKey: ['snowflake-connections-v2'] }); 
      setShowForm(false); 
      setForm({ ...form, name: '', account: '', username: '', password: '' });
    },
    onError: (error) => {
      console.error('Error creating connection:', error);
    }
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/snowflake/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snowflake-connections-v2'] })
  })

  const defaultMut = useMutation({
    mutationFn: async (id: string) => apiRequest('PUT', `/api/snowflake/connections/${id}/default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snowflake-connections-v2'] })
  })

  const testMut = useMutation({
    mutationFn: async (id: string) => apiRequest('POST', `/api/snowflake/connections/${id}/test`),
    onMutate: (id) => setTestingId(id),
    onSettled: () => setTestingId(null)
  })

  if (isLoading) {
    return <div className="flex items-center gap-2 p-4"><Loader2 className="w-4 h-4 animate-spin" /> <span className="body-text">Loading connections…</span></div>
  }

  console.log('Render - connections:', connections, 'error:', error, 'isLoading:', isLoading);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="section-header">Snowflake Connections</h2>
          <p className="body-text">Manage database connections used by agents.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Add</Button>
      </div>

      {connections.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-600" />
                <div>
                  <CardTitle className="section-header">{c.name}</CardTitle>
                  <CardDescription className="body-text">{c.account} • {c.username}{c.database ? ` • ${c.database}` : ''}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.is_default && <Badge className="body-text" variant="secondary">Default</Badge>}
                <Badge className="body-text" variant="outline">{c.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="body-text">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="caption-text">Warehouse:</span> {c.warehouse || '—'}</div>
              <div><span className="caption-text">Schema:</span> {c.schema || '—'}</div>
              <div><span className="caption-text">Role:</span> {c.role || '—'}</div>
              <div><span className="caption-text">Last Connected:</span> {c.last_connected ? new Date(c.last_connected).toLocaleString() : 'Never'}</div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => testMut.mutate(c.id)} disabled={testingId === c.id}>
                {testingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                Test
              </Button>
              {!c.is_default && (
                <Button variant="outline" size="sm" onClick={() => defaultMut.mutate(c.id)}>Set Default</Button>
              )}
            </div>
            <Button variant="outline" size="sm" className="text-red-600" onClick={() => deleteMut.mutate(c.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
      ))}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="section-header">Add Connection</CardTitle>
            <CardDescription className="body-text">Enter connection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Account</Label>
                <Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} />
              </div>
              <div>
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <Label>Password / PAT</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <Label>Database</Label>
                <Input value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} />
              </div>
              <div>
                <Label>Schema</Label>
                <Input value={form.schema} onChange={(e) => setForm({ ...form, schema: e.target.value })} />
              </div>
              <div>
                <Label>Warehouse</Label>
                <Input value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
              </div>
              <div>
                <Label>Role</Label>
                <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label>Authenticator</Label>
                <Select value={form.authenticator} onValueChange={(v) => setForm({ ...form, authenticator: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SNOWFLAKE">Username/Password</SelectItem>
                    <SelectItem value="USERNAME_PASSWORD_MFA">MFA</SelectItem>
                    <SelectItem value="PAT">Personal Access Token (PAT)</SelectItem>
                    <SelectItem value="EXTERNALBROWSER">SSO/Browser</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={!!form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
                <Label>Set as default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                <Label>Active</Label>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}Create
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

