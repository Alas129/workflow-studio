import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { StepNodeData, TaskExecutionStatus } from '@/types/workflow';
import { useWorkflowStore } from '@/stores/workflowStore';
import {
  Globe, Bot, Grid3X3, FileInput, Replace,
  BarChart3, Cloud, Circle, CheckCircle, Search,
  Target, ShieldCheck, Camera, Bell,
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

const statusStyles: Record<TaskExecutionStatus, string> = {
  queued: 'border-gray-300',
  running: 'border-blue-400 shadow-blue-200 shadow-md',
  success: 'border-green-400',
  'error-4xx': 'border-orange-400',
  'error-5xx': 'border-red-400',
  timeout: 'border-gray-400',
  skipped: 'border-gray-200',
};

const statusDotColor: Record<TaskExecutionStatus, string> = {
  queued: 'text-gray-400',
  running: 'text-blue-500 animate-pulse',
  success: 'text-green-500',
  'error-4xx': 'text-orange-500',
  'error-5xx': 'text-red-500',
  timeout: 'text-gray-500',
  skipped: 'text-gray-300',
};

type StepNodeType = Node<StepNodeData, 'stepNode'>;

function StepNodeComponent({ id, data, selected }: NodeProps<StepNodeType>) {
  const label = (data.label as string) || 'Step';
  const stepType = (data.stepType as string) || '';
  const icon = (data.icon as string) || '';
  const color = (data.color as string) || '#4A90D9';
  const status = data.executionStatus as TaskExecutionStatus | undefined;
  const Icon = iconMap[icon] || Globe;
  const borderClass = status ? statusStyles[status] : 'border-gray-200';
  const dotClass = status ? statusDotColor[status] : '';

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Sync editValue when label changes externally
  useEffect(() => {
    if (!isEditing) setEditValue(label);
  }, [label, isEditing]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      useWorkflowStore.getState().updateNodeLabel(id, trimmed);
    } else {
      setEditValue(label);
    }
    setIsEditing(false);
  }, [editValue, label, id]);

  const cancelEdit = useCallback(() => {
    setEditValue(label);
    setIsEditing(false);
  }, [label]);

  return (
    <div
      className={`bg-white rounded-lg border-2 ${borderClass} min-w-[200px] transition-all
        ${selected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
      `}
      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-3 !h-3" />

      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-gray-600 shrink-0" />
          {isEditing ? (
            <input
              ref={inputRef}
              className="text-sm font-medium text-gray-800 bg-blue-50 border border-blue-300 rounded px-1 py-0 outline-none w-full"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
          ) : (
            <span
              className="text-sm font-medium text-gray-800 truncate flex-1 cursor-text hover:text-blue-600"
              onDoubleClick={() => setIsEditing(true)}
              title="Double-click to rename"
            >
              {label}
            </span>
          )}
          {status && (
            <Circle size={10} className={`${dotClass} fill-current shrink-0`} />
          )}
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate">
          {stepType}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-gray-400 !w-3 !h-3" />
    </div>
  );
}

export const StepNode = memo(StepNodeComponent);
