import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, Trash2, TestTube, Zap } from 'lucide-react'
import { apiRequest } from '@/lib/api'

interface DatabricksConnection {
  id: string
  name: string
  server_hostname: string
  http_path: string
  catalog?: string
  schema?: string
  cluster_id?: string
  is_default: boolean
  is_active: boolean
  last_connected?: string
}

export default function DatabricksSettings() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>({
    name: '', server_hostname: '', http_path: '', access_token: '',
    catalog: '', schema: '', cluster_id: '',
    isDefault: false, isActive: true,
  })
  const [testingId, setTestingId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: connections = [], isLoading, error } = useQuery<DatabricksConnection[]>({
    queryKey: ['databricks-connections'],
    queryFn: async () => {
      console.log('Fetching databricks connections...');
      const result = await apiRequest('GET', '/api/databricks/connections');
      console.log('Fetched connections:', result);
      return result;
    },
  })

  const createMut = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/databricks/connections', {
      name: form.name,
      server_hostname: form.server_hostname,
      http_path: form.http_path,
      access_token: form.access_token,
      catalog: form.catalog,
      schema: form.schema,
      cluster_id: form.cluster_id,
      isDefault: form.isDefault,
      isActive: form.isActive,
    }),
    onSuccess: (data) => { 
      console.log('Connection created successfully:', data);
      qc.invalidateQueries({ queryKey: ['databricks-connections'] }); 
      setShowForm(false); 
      setForm({ ...form, name: '', server_hostname: '', http_path: '', access_token: '' });
    },
    onError: (error) => {
      console.error('Error creating connection:', error);
    }
  })

  const deleteMut = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/databricks/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databricks-connections'] })
  })

  const defaultMut = useMutation({
    mutationFn: async (id: string) => apiRequest('PUT', `/api/databricks/connections/${id}/default`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databricks-connections'] })
  })

  const testMut = useMutation({
    mutationFn: async (id: string) => apiRequest('POST', `/api/databricks/connections/${id}/test`),
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
          <h2 className="section-header">Databricks Connections</h2>
          <p className="body-text">Manage Databricks workspace connections used by agents.</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" />Add</Button>
      </div>

      {connections.map((c) => (
        <Card key={c.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-600" />
                <div>
                  <CardTitle className="section-header">{c.name}</CardTitle>
                  <CardDescription className="body-text">{c.server_hostname}{c.catalog ? ` • ${c.catalog}` : ''}</CardDescription>
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
              <div><span className="caption-text">HTTP Path:</span> {c.http_path || '—'}</div>
              <div><span className="caption-text">Catalog:</span> {c.catalog || '—'}</div>
              <div><span className="caption-text">Schema:</span> {c.schema || '—'}</div>
              <div><span className="caption-text">Cluster ID:</span> {c.cluster_id || '—'}</div>
              <div className="col-span-2"><span className="caption-text">Last Connected:</span> {c.last_connected ? new Date(c.last_connected).toLocaleString() : 'Never'}</div>
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
            <CardTitle className="section-header">Add Databricks Connection</CardTitle>
            <CardDescription className="body-text">Enter Databricks workspace connection details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Databricks Workspace" />
              </div>
              <div>
                <Label>Server Hostname</Label>
                <Input value={form.server_hostname} onChange={(e) => setForm({ ...form, server_hostname: e.target.value })} placeholder="dbc-a1b2c3d4-e5f6.cloud.databricks.com" />
              </div>
              <div>
                <Label>HTTP Path</Label>
                <Input value={form.http_path} onChange={(e) => setForm({ ...form, http_path: e.target.value })} placeholder="/sql/1.0/warehouses/abc123def456" />
              </div>
              <div>
                <Label>Access Token</Label>
                <Input type="password" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder="dapi123..." />
              </div>
              <div>
                <Label>Catalog</Label>
                <Input value={form.catalog} onChange={(e) => setForm({ ...form, catalog: e.target.value })} placeholder="main" />
              </div>
              <div>
                <Label>Schema</Label>
                <Input value={form.schema} onChange={(e) => setForm({ ...form, schema: e.target.value })} placeholder="default" />
              </div>
              <div>
                <Label>Cluster ID (optional)</Label>
                <Input value={form.cluster_id} onChange={(e) => setForm({ ...form, cluster_id: e.target.value })} placeholder="0123-456789-abc123" />
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