import { Link } from 'react-router-dom';
import { useRuns } from '@/api/queries/useRuns';
import { ArrowLeft, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={14} className="text-green-500" />,
  failed: <XCircle size={14} className="text-red-500" />,
  running: <Loader size={14} className="text-blue-500 animate-spin" />,
  cancelled: <XCircle size={14} className="text-gray-400" />,
  pending: <Clock size={14} className="text-gray-400" />,
};

export function RunHistoryPage() {
  const { data: runs, isLoading } = useRuns();

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3">
        <Link to="/" className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-sm font-semibold">Run History</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : !runs?.length ? (
          <div className="text-center text-gray-500 py-12">No runs yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b">
                <th className="pb-2 px-2">Status</th>
                <th className="pb-2 px-2">Workflow</th>
                <th className="pb-2 px-2">Started</th>
                <th className="pb-2 px-2">Duration</th>
                <th className="pb-2 px-2">Tasks</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      {statusIcons[run.status] || statusIcons.pending}
                      <span className="capitalize text-xs">{run.status}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 font-medium">{run.workflow_name}</td>
                  <td className="py-2 px-2 text-gray-500">
                    {new Date(run.started_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-gray-500">
                    {run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}
                  </td>
                  <td className="py-2 px-2 text-gray-500">
                    {run.step_results.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
