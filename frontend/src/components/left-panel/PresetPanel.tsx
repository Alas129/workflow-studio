import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { Preset } from '@/types/preset';
import { Bookmark } from 'lucide-react';

export function PresetPanel() {
  const { data: presets, isLoading } = useQuery({
    queryKey: ['presets'],
    queryFn: () => api.get<Preset[]>('/presets'),
  });

  if (isLoading) {
    return <div className="p-4 text-sm text-gray-500">Loading presets...</div>;
  }

  if (!presets?.length) {
    return (
      <div className="p-4 text-center">
        <Bookmark size={32} className="mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">No presets yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Save a workflow configuration as a preset to reuse it
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {presets.map((preset) => (
        <div
          key={preset.id}
          className="p-3 rounded-md hover:bg-gray-100 cursor-pointer border border-transparent hover:border-gray-200"
        >
          <div className="text-sm font-medium text-gray-700">{preset.name}</div>
          {preset.description && (
            <div className="text-xs text-gray-400 mt-1">{preset.description}</div>
          )}
          {preset.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {preset.tags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
