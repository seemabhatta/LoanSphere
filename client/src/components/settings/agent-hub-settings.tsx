import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api'
import { Loader2, Save } from 'lucide-react'

export default function AgentHubSettings({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['agent-config', userId],
    queryFn: async () => apiRequest('GET', `/api/agent-config/${userId}`)
  })
  const [jsonText, setJsonText] = useState<string>('')

  useEffect(() => {
    if (data) setJsonText(JSON.stringify(data, null, 2))
  }, [data])

  const saveMut = useMutation({
    mutationFn: async (payload: any) => apiRequest('PUT', `/api/agent-config/${userId}`, payload)
  })

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonText || '{}')
      saveMut.mutate(parsed)
    } catch (e) {
      alert('Invalid JSON')
    }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 p-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading agent config…</div>
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <Textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={16} className="font-mono text-xs" />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}Save
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
