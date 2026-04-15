import { useState } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useUIStore } from '@/stores/uiStore';
import { useStepTemplates } from '@/api/queries/useStepTemplates';
import { useSecrets } from '@/api/queries/useSecrets';
import { DimensionEditor } from './DimensionEditor';
import { X, PenLine, ChevronDown, KeyRound } from 'lucide-react';

export function StepConfigPanel() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const configPanelOpen = useUIStore((s) => s.configPanelOpen);
  const setConfigPanelOpen = useUIStore((s) => s.setConfigPanelOpen);

  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const { data: templates } = useStepTemplates();

  const { data: secretsData } = useSecrets();
  const secretKeys = secretsData?.keys ?? [];

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
        <div className="flex-1 min-w-0 mr-2">
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
            Step Name
          </label>
          <div className="flex items-center gap-1.5">
            <PenLine size={12} className="text-gray-400 shrink-0" />
            <input
              className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:bg-blue-50/50 outline-none w-full rounded-sm px-0.5 py-0.5 transition-colors"
              value={node.data.label as string}
              onChange={(e) => updateNodeLabel(node.id, e.target.value)}
            />
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{stepType}</div>
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
            {/* Custom editor for matrix dimensions */}
            {stepType === 'expand_matrix' && param.name === 'dimensions' ? (
              <DimensionEditor
                value={config[param.name]}
                onChange={(val) => handleChange(param.name, val)}
              />
            ) : (
              renderInput(param, config[param.name], (val) => handleChange(param.name, val), secretKeys)
            )}
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
  secretKeys: Array<{ key: string; source: string }>,
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
      return <SecretInput value={value} onChange={onChange} placeholder={param.placeholder} inputClass={inputClass} secretKeys={secretKeys} />;

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


function SecretInput({
  value, onChange, placeholder, inputClass, secretKeys,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
  placeholder?: string;
  inputClass: string;
  secretKeys: Array<{ key: string; source: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex gap-1">
        <input
          type="password"
          value={value as string ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '${{ secrets.API_KEY }}'}
          className={`${inputClass} flex-1`}
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-0.5 px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 shrink-0"
          title="Insert secret reference"
        >
          <KeyRound size={12} />
          <ChevronDown size={10} />
        </button>
      </div>
      {open && secretKeys.length > 0 && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
          {secretKeys.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                onChange(`\${{ secrets.${s.key} }}`);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-gray-50 last:border-0 flex items-center gap-2"
            >
              <span className="font-mono text-gray-700 truncate flex-1">{s.key}</span>
              <span className={`text-[10px] px-1 rounded ${
                s.source === 'env' ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-blue-600'
              }`}>{s.source}</span>
            </button>
          ))}
        </div>
      )}
      {open && secretKeys.length === 0 && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-3">
          <p className="text-xs text-gray-500">No secrets configured. Add secrets in the Secrets tab.</p>
        </div>
      )}
    </div>
  );
}
