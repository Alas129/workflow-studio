import { type DragEvent, useState } from 'react';
import { useStepTemplates } from '@/api/queries/useStepTemplates';
import type { StepDefinition, StepCategory } from '@/types/step';
import { CurlImportDialog } from './CurlImportDialog';
import {
  Globe, Bot, Grid3X3, FileInput, Replace,
  BarChart3, Cloud, GripVertical, CheckCircle,
  Search, Target, ShieldCheck, Camera, Bell,
  Terminal,
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  globe: Globe,
  bot: Bot,
  'grid-3x3': Grid3X3,
  'file-input': FileInput,
  replace: Replace,
  'bar-chart-3': BarChart3,
  cloud: Cloud,
  'check-circle': CheckCircle,
  search: Search,
  target: Target,
  'shield-check': ShieldCheck,
  camera: Camera,
  bell: Bell,
};

const categoryOrder: StepCategory[] = ['Requests', 'Data', 'Transform', 'Output', 'Assertions', 'Integrations', 'GCP'];

export function StepLibrary() {
  const { data: templates, isLoading } = useStepTemplates();
  const [showCurlDialog, setShowCurlDialog] = useState(false);

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading steps...</div>;
  }

  const grouped = new Map<StepCategory, StepDefinition[]>();
  for (const cat of categoryOrder) {
    grouped.set(cat, []);
  }
  for (const t of templates || []) {
    const list = grouped.get(t.category as StepCategory) || [];
    list.push(t);
    grouped.set(t.category as StepCategory, list);
  }

  return (
    <div className="p-2 space-y-3">
      {/* cURL import button */}
      <button
        onClick={() => setShowCurlDialog(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-gray-300
          text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-sm"
      >
        <Terminal size={14} />
        Import from cURL
      </button>

      {showCurlDialog && <CurlImportDialog onClose={() => setShowCurlDialog(false)} />}

      {categoryOrder.map((cat) => {
        const items = grouped.get(cat) || [];
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {cat}
            </h3>
            <div className="space-y-1">
              {items.map((step) => (
                <StepCard key={step.type} step={step} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepCard({ step }: { step: StepDefinition }) {
  const Icon = iconMap[step.icon] || Globe;

  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData('application/workflow-step', JSON.stringify(step));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100
        cursor-grab active:cursor-grabbing border border-transparent hover:border-gray-200
        transition-colors group"
    >
      <GripVertical size={14} className="text-gray-300 group-hover:text-gray-400" />
      <div
        className="w-7 h-7 rounded flex items-center justify-center shrink-0"
        style={{ backgroundColor: step.color + '20', color: step.color }}
      >
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-700 truncate">{step.label}</div>
        <div className="text-xs text-gray-400 truncate">{step.description}</div>
      </div>
    </div>
  );
}
