import AgentHubSettings from '@/components/settings/agent-hub-settings'
import { useAuth } from '@/hooks/useAuth'

export default function AgentStudioPage() {
  const { user } = useAuth()
  const userId = user?.id || 'default-user'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-gray-200">
        <h1 className="page-title">Agent Studio</h1>
        <p className="text-gray-500 text-sm">Configure tools, prompts, and agent behavior</p>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <AgentHubSettings userId={userId} />
      </div>
    </div>
  )
}

