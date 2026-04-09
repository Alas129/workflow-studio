import { useUIStore } from '@/stores/uiStore';
import { StepLibrary } from './StepLibrary';
import { PresetPanel } from './PresetPanel';
import { Blocks, Bookmark } from 'lucide-react';

export function LeftPanel() {
  const tab = useUIStore((s) => s.leftPanelTab);
  const setTab = useUIStore((s) => s.setLeftPanelTab);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('steps')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors
            ${tab === 'steps' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Blocks size={14} /> Steps
        </button>
        <button
          onClick={() => setTab('presets')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors
            ${tab === 'presets' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Bookmark size={14} /> Presets
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'steps' ? <StepLibrary /> : <PresetPanel />}
      </div>
    </div>
  );
}
