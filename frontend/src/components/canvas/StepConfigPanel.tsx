import { useWorkflowStore } from '@/stores/workflowStore';
import { useUIStore } from '@/stores/uiStore';
import { useStepTemplates } from '@/api/queries/useStepTemplates';
import { X } from 'lucide-react';

export function StepConfigPanel() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const configPanelOpen = useUIStore((s) => s.configPanelOpen);
  const setConfigPanelOpen = useUIStore((s) => s.setConfigPanelOpen);

  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const { data: templates } = useStepTemplates();

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node || !configPanelOpen) return null;

  const stepType = node.data.stepType as string;
  const template = templates?.find((t) => t.type === stepType);
  const config = (node.data.config as Record<string, unknown>) || {};

  const handleChange = (paramName: string, value: unknown) => {
    updateNodeConfig(node.id, { ...config, [paramName]: value });
  };

  return (
    <div className="absolute top-0 right-0 h-full w-[380px] bg-white shadow-xl border-l border-gray-200 z-10 overflow-y-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <input
            className="font-semibold text-sm bg-transparent border-none outline-none w-full"
            value={node.data.label as string}
            onChange={(e) => updateNodeLabel(node.id, e.target.value)}
          />
          <div className="text-xs text-gray-500">{stepType}</div>
        </div>
        <button
          onClick={() => setConfigPanelOpen(false)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {template?.parameters.map((param) => (
          <div key={param.name}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {param.label}
              {param.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {param.description && (
              <p className="text-xs text-gray-400 mb-1">{param.description}</p>
            )}
            {renderInput(param, config[param.name], (val) => handleChange(param.name, val))}
          </div>
        ))}

        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              removeNode(node.id);
              setConfigPanelOpen(false);
            }}
            className="w-full px-3 py-2 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
          >
            Delete Step
          </button>
        </div>
      </div>
    </div>
  );
}

function renderInput(
  param: { type: string; enum_values?: string[]; placeholder?: string },
  value: unknown,
  onChange: (val: unknown) => void,
) {
  const inputClass = 'w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

  switch (param.type) {
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-600">Enabled</span>
        </label>
      );

    case 'integer':
    case 'float':
      return (
        <input
          type="number"
          value={value as number ?? ''}
          onChange={(e) => onChange(param.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value))}
          placeholder={param.placeholder}
          className={inputClass}
          step={param.type === 'float' ? 0.1 : 1}
        />
      );

    case 'select':
      return (
        <select
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">-- Select --</option>
          {param.enum_values?.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      );

    case 'json':
    case 'key_value':
      return (
        <textarea
          value={typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? ''}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
          placeholder={param.placeholder}
          className={`${inputClass} font-mono text-xs min-h-[80px]`}
          rows={4}
        />
      );

    case 'multiline':
      return (
        <textarea
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          className={`${inputClass} min-h-[60px]`}
          rows={3}
        />
      );

    case 'secret':
      return (
        <input
          type="password"
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder || '{{API_KEY}}'}
          className={inputClass}
        />
      );

    default:
      return (
        <input
          type="text"
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          className={inputClass}
        />
      );
  }
}
