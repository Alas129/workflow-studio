import { useExecutionStore } from '@/stores/executionStore';
import { httpStatusToExecution, statusColors } from '@/constants/statusColors';

export function MatrixResultTable() {
  const stepResults = useExecutionStore((s) => s.stepResults);

  // Collect matrix results from step_completed events
  const results = Array.from(stepResults.entries())
    .map(([key, data]) => ({
      key,
      endpoint: (data.outputs as Record<string, unknown>)?.endpoint as string || (data as Record<string, unknown>).matrix_key as string || key,
      model: (data.outputs as Record<string, unknown>)?.model_used as string || '',
      statusCode: (data.outputs as Record<string, unknown>)?.status_code as number,
      durationMs: (data.outputs as Record<string, unknown>)?.duration_ms as number,
      failed: !!(data as Record<string, unknown>)._failed,
      error: (data as Record<string, unknown>).error as string | undefined,
    }))
    .filter((r) => r.statusCode != null || r.failed);

  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No matrix results yet. Run a workflow with matrix expansion to see results here.
      </div>
    );
  }

  // Group by endpoint and model
  const endpoints = [...new Set(results.map((r) => r.endpoint))];
  const models = [...new Set(results.map((r) => r.model).filter(Boolean))];

  if (models.length === 0) {
    // Simple list view
    return (
      <div className="p-2">
        <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase px-2">Results</h3>
        <div className="space-y-1">
          {results.map((r) => {
            const status = r.failed ? 'error-5xx' : httpStatusToExecution(r.statusCode);
            const colors = statusColors[status];
            return (
              <div key={r.key} className={`px-3 py-2 rounded ${colors.bg} ${colors.text} text-xs`}>
                <div className="font-medium">{r.endpoint}</div>
                <div className="flex gap-3 mt-1">
                  <span>Status: {r.statusCode || 'Error'}</span>
                  {r.durationMs != null && <span>{r.durationMs}ms</span>}
                </div>
                {r.error && <div className="mt-1 text-red-600">{r.error}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Matrix grid view
  return (
    <div className="p-2 overflow-auto">
      <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase px-2">Matrix Results</h3>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left p-1.5 text-gray-500 font-medium">Endpoint</th>
            {models.map((m) => (
              <th key={m} className="text-center p-1.5 text-gray-500 font-medium truncate max-w-[120px]">
                {m.split('-').slice(-2).join('-')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {endpoints.map((ep) => (
            <tr key={ep}>
              <td className="p-1.5 text-gray-600 truncate max-w-[200px]" title={ep}>
                {new URL(ep).pathname}
              </td>
              {models.map((m) => {
                const r = results.find((x) => x.endpoint === ep && x.model === m);
                if (!r) return <td key={m} className="p-1.5 text-center text-gray-300">-</td>;
                const status = r.failed ? 'error-5xx' : httpStatusToExecution(r.statusCode);
                const colors = statusColors[status];
                return (
                  <td key={m} className="p-1">
                    <div className={`${colors.bg} ${colors.text} rounded px-2 py-1 text-center font-mono`}>
                      {r.statusCode || 'ERR'}
                      {r.durationMs != null && (
                        <span className="block text-[10px] opacity-70">{r.durationMs}ms</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
