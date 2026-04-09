import { useUIStore } from '@/stores/uiStore';
import { ExecutionDashboard } from './ExecutionDashboard';
import { MatrixResultTable } from './MatrixResultTable';
import { Activity, Grid3X3, AlertTriangle, Clock } from 'lucide-react';

type Tab = 'dashboard' | 'results' | 'errors' | 'timeline';

const tabs: { key: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Activity },
  { key: 'results', label: 'Results', icon: Grid3X3 },
  { key: 'errors', label: 'Errors', icon: AlertTriangle },
  { key: 'timeline', label: 'Timeline', icon: Clock },
];

export function RightPanel() {
  const tab = useUIStore((s) => s.rightPanelTab);
  const setTab = useUIStore((s) => s.setRightPanelTab);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors
              ${tab === key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'dashboard' && <ExecutionDashboard />}
        {tab === 'results' && <MatrixResultTable />}
        {tab === 'errors' && (
          <div className="p-4 text-center text-sm text-gray-500">
            Error clustering will appear here after a run
          </div>
        )}
        {tab === 'timeline' && (
          <div className="p-4 text-center text-sm text-gray-500">
            Timeline trends will appear here after multiple runs
          </div>
        )}
      </div>
    </div>
  );
}
