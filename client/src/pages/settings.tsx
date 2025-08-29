import SnowflakeSettings from '@/components/settings/snowflake-settings'
import { useAuth } from '@/hooks/useAuth'

export default function SettingsPage() {
  const { user } = useAuth()
  const userId = user?.id || 'default-user'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-gray-200">
        <h1 className="page-title">Integrations</h1>
        <p className="text-gray-500 text-sm">Connect data sources and platform services</p>
      </header>
      <div className="flex-1 overflow-y-auto p-6">
        <SnowflakeSettings userId={userId} />
      </div>
    </div>
  )
}
