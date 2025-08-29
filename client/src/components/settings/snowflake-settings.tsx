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

export default function SnowflakeSettings({ userId }: { userId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({
    userId,
    name: '', account: '', username: '', password: '',
    database: '', schema: '', warehouse: '', role: '',
    authenticator: 'SNOWFLAKE', isDefault: false, isActive: true,
  })
  const [testingId, setTestingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: connections = [], isLoading } = useQuery<SnowflakeConnection[]>({
    queryKey: ['snowflake-conns', userId],
    queryFn: async () => apiRequest('GET', `/api/snowflake/connections/${userId}`)
  })

  const createMut = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/snowflake/connections', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['snowflake-conns', userId] }); setShowForm(false); setForm({ ...form, name: '', account: '', username: '', password: '' }) }
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/snowflake/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snowflake-conns', userId] })
  })

  const defaultMut = useMutation({
    mutationFn: async (id: string) => apiRequest('PUT', `/api/snowflake/connections/${id}/default`, { userId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['snowflake-conns', userId] })
  })

  const testMut = useMutation({
    mutationFn: async (id: string) => apiRequest('POST', `/api/snowflake/connections/${id}/test`),
    onMutate: (id) => setTestingId(id),
    onSettled: () => setTestingId(null)
  })

  if (isLoading) {
    return <div className="flex items-center gap-2 p-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading connections…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Snowflake Connections</h2>
          <p className="text-xs text-gray-500">Manage database connections used by agents.</p>
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
                  <CardTitle className="text-sm">{c.name}</CardTitle>
                  <CardDescription>{c.account} • {c.username}{c.database ? ` • ${c.database}` : ''}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.is_default && <Badge className="text-xs" variant="secondary">Default</Badge>}
                <Badge className="text-xs" variant="outline">{c.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-gray-600">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Warehouse:</span> {c.warehouse || '—'}</div>
              <div><span className="text-gray-500">Schema:</span> {c.schema || '—'}</div>
              <div><span className="text-gray-500">Role:</span> {c.role || '—'}</div>
              <div><span className="text-gray-500">Last Connected:</span> {c.last_connected ? new Date(c.last_connected).toLocaleString() : 'Never'}</div>
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
            <CardTitle className="text-sm">Add Connection</CardTitle>
            <CardDescription>Enter connection details</CardDescription>
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
              <div>
                <Label>Authenticator</Label>
                <Select value={form.authenticator} onValueChange={(v) => setForm({ ...form, authenticator: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SNOWFLAKE">Username/Password</SelectItem>
                    <SelectItem value="USERNAME_PASSWORD_MFA">MFA</SelectItem>
                    <SelectItem value="PAT">PAT</SelectItem>
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

