import { useState } from 'react';
import { parseCurl } from '@/lib/curlParser';
import { curlToStep, type StepFromCurl } from '@/lib/curlToStep';
import { createNodeWithConfig } from '@/lib/nodeFactory';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useUIStore } from '@/stores/uiStore';
import { X, Terminal, ArrowRight, Globe, Bot } from 'lucide-react';

const stepMeta: Record<string, { color: string; icon: string; label: string }> = {
  http_request: { color: '#4A90D9', icon: 'globe', label: 'HTTP Request' },
  llm_request: { color: '#7C3AED', icon: 'bot', label: 'LLM API Call' },
};

export function CurlImportDialog({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<StepFromCurl | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addNode = useWorkflowStore((s) => s.addNode);
  const selectNode = useUIStore((s) => s.selectNode);

  const handleParse = () => {
    setError(null);
    setResult(null);
    try {
      const parsed = parseCurl(input);
      const step = curlToStep(parsed);
      setResult(step);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse cURL');
    }
  };

  const handleAdd = () => {
    if (!result) return;
    const meta = stepMeta[result.stepType] ?? stepMeta.http_request;
    const node = createNodeWithConfig(
      result.stepType,
      result.label,
      result.config,
      { x: 250 + Math.random() * 100, y: 150 + Math.random() * 100 },
      meta.color,
      meta.icon,
    );
    addNode(node);
    selectNode(node.id);
    onClose();
  };

  const TypeIcon = result?.stepType === 'llm_request' ? Bot : Globe;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-gray-600" />
            <h2 className="text-sm font-semibold">Import from cURL</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Paste your cURL command
            </label>
            <textarea
              className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-md
                focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[120px] resize-y"
              placeholder={`curl -X POST https://api.anthropic.com/v1/messages \\
  -H "x-api-key: $API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":256,"messages":[{"role":"user","content":"Hello"}]}'`}
              value={input}
              onChange={(e) => { setInput(e.target.value); setResult(null); setError(null); }}
            />
          </div>

          <button
            onClick={handleParse}
            disabled={!input.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium
              bg-gray-900 text-white rounded-md hover:bg-gray-800
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Terminal size={14} /> Parse cURL
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded flex items-center justify-center"
                  style={{
                    backgroundColor: (stepMeta[result.stepType]?.color ?? '#4A90D9') + '20',
                    color: stepMeta[result.stepType]?.color ?? '#4A90D9',
                  }}
                >
                  <TypeIcon size={14} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {stepMeta[result.stepType]?.label ?? result.stepType}
                  </div>
                  <div className="text-xs text-gray-500">{result.label}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                {Object.entries(result.config).map(([key, val]) => {
                  const display = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
                  if (!display) return null;
                  return (
                    <div key={key} className="flex items-start gap-2 text-xs">
                      <span className="font-medium text-gray-600 w-32 shrink-0 text-right">{key}:</span>
                      <span className="text-gray-800 font-mono truncate" title={display}>
                        {display.length > 80 ? display.slice(0, 80) + '...' : display}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {result && (
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium
                bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add to Canvas <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
