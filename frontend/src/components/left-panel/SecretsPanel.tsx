import { useState } from 'react';
import { useSecrets, useCreateSecret, useDeleteSecret } from '@/api/queries/useSecrets';
import { Plus, Trash2, Copy, Server, HardDrive } from 'lucide-react';

export function SecretsPanel() {
  const { data, isLoading } = useSecrets();
  const createSecret = useCreateSecret();
  const deleteSecret = useDeleteSecret();

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const keys = data?.keys ?? [];

  const handleAdd = () => {
    const key = newKey.trim();
    if (!key || !newValue) return;
    createSecret.mutate({ key, value: newValue }, {
      onSuccess: () => { setNewKey(''); setNewValue(''); },
    });
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(`\${{ secrets.${key} }}`);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="p-3 space-y-4">
      {/* Add form */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
          Add Secret
        </h3>
        <input
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="KEY_NAME"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
        />
        <input
          type="password"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Secret value..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
        />
        <button
          onClick={handleAdd}
          disabled={!newKey.trim() || !newValue || createSecret.isPending}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium
            bg-blue-600 text-white rounded hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={14} />
          {createSecret.isPending ? 'Adding...' : 'Add Secret'}
        </button>
      </div>

      {/* List */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-2">
          Available Secrets ({keys.length})
        </h3>

        {isLoading ? (
          <div className="text-sm text-gray-500 px-1">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="text-xs text-gray-400 px-1 py-4 text-center">
            No secrets configured yet.
            <br />
            Add one above or set <code className="bg-gray-100 px-1 rounded">WS_SECRET_*</code> env vars.
          </div>
        ) : (
          <div className="space-y-1">
            {keys.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 group border border-transparent hover:border-gray-200"
              >
                {entry.source === 'env' ? (
                  <span title="Environment variable"><Server size={12} className="text-gray-400 shrink-0" /></span>
                ) : (
                  <span title="File-based secret"><HardDrive size={12} className="text-blue-400 shrink-0" /></span>
                )}
                <span className="text-sm font-mono text-gray-700 truncate flex-1">
                  {entry.key}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  entry.source === 'env'
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  {entry.source}
                </span>
                <button
                  onClick={() => handleCopy(entry.key)}
                  className="p-0.5 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy ${{ secrets.KEY }} reference"
                >
                  {copied === entry.key ? (
                    <span className="text-[10px] text-green-500">Copied!</span>
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
                {entry.source === 'file' && (
                  <button
                    onClick={() => deleteSecret.mutate(entry.key)}
                    className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete secret"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
