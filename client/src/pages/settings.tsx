import SnowflakeSettings from '@/components/settings/snowflake-settings'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const userId = user?.id

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-gray-200">
        <h1 className="page-title">Integrations</h1>
        <p className="text-gray-500 text-sm">Connect data sources and platform services</p>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        )}
        {!isLoading && <SnowflakeSettings />}
      </div>
    </div>
  )
}
