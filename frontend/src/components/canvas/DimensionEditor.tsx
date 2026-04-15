/**
 * Structured editor for Matrix Expansion dimensions.
 * Replaces raw JSON editing with a visual key → values form.
 *
 * Data shape: { "endpoint": ["url1", "url2"], "model": ["m1", "m2"] }
 */
import { useState } from 'react';
import { Plus, Trash2, Grid3X3 } from 'lucide-react';

interface DimensionEditorProps {
  value: unknown;
  onChange: (val: Record<string, string[]>) => void;
}

function toDimensions(value: unknown): Record<string, string[]> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = Array.isArray(v) ? v.map(String) : [String(v)];
    }
    return result;
  }
  return {};
}

const inputClass = 'w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

export function DimensionEditor({ value, onChange }: DimensionEditorProps) {
  const dims = toDimensions(value);
  const keys = Object.keys(dims);

  const [newKey, setNewKey] = useState('');

  const addDimension = () => {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || key in dims) return;
    onChange({ ...dims, [key]: [''] });
    setNewKey('');
  };

  const removeDimension = (key: string) => {
    const next = { ...dims };
    delete next[key];
    onChange(next);
  };

  const addValue = (key: string) => {
    onChange({ ...dims, [key]: [...dims[key], ''] });
  };

  const updateValue = (key: string, index: number, val: string) => {
    const newVals = [...dims[key]];
    newVals[index] = val;
    onChange({ ...dims, [key]: newVals });
  };

  const removeValue = (key: string, index: number) => {
    const newVals = dims[key].filter((_, i) => i !== index);
    onChange({ ...dims, [key]: newVals.length > 0 ? newVals : [''] });
  };

  // Calculate matrix size
  const matrixSize = keys.length > 0
    ? keys.reduce((acc, k) => acc * Math.max(dims[k].filter(v => v).length, 1), 1)
    : 0;

  return (
    <div className="space-y-3">
      {/* Existing dimensions */}
      {keys.map((key) => (
        <div key={key} className="border border-gray-200 rounded-md p-2.5 bg-gray-50/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-700 font-mono">{key}</span>
            <button
              onClick={() => removeDimension(key)}
              className="p-0.5 text-gray-400 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="space-y-1">
            {dims[key].map((val, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <input
                  className={`${inputClass} text-xs font-mono`}
                  value={val}
                  onChange={(e) => updateValue(key, idx, e.target.value)}
                  placeholder={`Value ${idx + 1}...`}
                />
                {dims[key].length > 1 && (
                  <button
                    onClick={() => removeValue(key, idx)}
                    className="p-0.5 text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => addValue(key)}
            className="flex items-center gap-1 mt-1.5 text-[11px] text-blue-600 hover:text-blue-700"
          >
            <Plus size={11} /> Add value
          </button>
        </div>
      ))}

      {/* Add new dimension */}
      <div className="flex gap-1">
        <input
          className={`${inputClass} text-xs flex-1`}
          placeholder="New dimension name (e.g. endpoint, model)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addDimension(); }}
        />
        <button
          onClick={addDimension}
          disabled={!newKey.trim()}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 shrink-0"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Matrix preview */}
      {keys.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1.5">
          <Grid3X3 size={12} />
          <span>
            {keys.map((k) => `${dims[k].filter(v => v).length} ${k}`).join(' × ')}
            {' = '}
            <span className="font-semibold text-gray-700">{matrixSize} combinations</span>
          </span>
        </div>
      )}
    </div>
  );
}
