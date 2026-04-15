import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRuns, useRunDiff } from '@/api/queries/useRuns';
import {
  ArrowLeft, Clock, CheckCircle, XCircle, Loader,
  Download, GitCompareArrows, ShieldCheck, ShieldX,
} from 'lucide-react';
const statusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={14} className="text-green-500" />,
  failed: <XCircle size={14} className="text-red-500" />,
  running: <Loader size={14} className="text-blue-500 animate-spin" />,
  cancelled: <XCircle size={14} className="text-gray-400" />,
  pending: <Clock size={14} className="text-gray-400" />,
};

function assertionBadge(summary: Record<string, unknown>) {
  const total = (summary.assertions_total as number) || 0;
  if (total === 0) return null;
  const passed = (summary.assertions_passed as number) || 0;
  const failed = (summary.assertions_failed as number) || 0;
  const allPass = failed === 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
      allPass ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
    }`}>
      {allPass ? <ShieldCheck size={12} /> : <ShieldX size={12} />}
      {passed}/{total}
    </span>
  );
}

export function RunHistoryPage() {
  const { data: runs, isLoading } = useRuns();
  const [diffA, setDiffA] = useState<string | null>(null);
  const [diffB, setDiffB] = useState<string | null>(null);
  const { data: diffResult } = useRunDiff(diffA, diffB);

  const selectForDiff = (runId: string) => {
    if (!diffA) setDiffA(runId);
    else if (!diffB && runId !== diffA) setDiffB(runId);
    else { setDiffA(runId); setDiffB(null); }
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3">
        <Link to="/" className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-sm font-semibold">Run History</h1>
        {diffA && (
          <span className="ml-auto text-xs text-gray-500">
            Diff: {diffA.slice(0, 8)}
            {diffB ? ` vs ${diffB.slice(0, 8)}` : ' — select second run'}
            {diffA && (
              <button onClick={() => { setDiffA(null); setDiffB(null); }}
                className="ml-2 text-red-500 hover:underline">clear</button>
            )}
          </span>
        )}
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
                <th className="pb-2 px-2">Steps</th>
                <th className="pb-2 px-2">Tests</th>
                <th className="pb-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const isSelected = run.id === diffA || run.id === diffB;
                return (
                  <tr key={run.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
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
                    <td className="py-2 px-2">
                      {assertionBadge(run.summary)}
                    </td>
                    <td className="py-2 px-2 flex items-center gap-1">
                      <a href={`/api/runs/${run.id}/junit.xml`}
                        download
                        title="Download JUnit XML"
                        className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700">
                        <Download size={14} />
                      </a>
                      <button
                        onClick={() => selectForDiff(run.id)}
                        title="Compare runs"
                        className={`p-1 rounded ${isSelected ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}`}>
                        <GitCompareArrows size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Diff panel */}
        {diffResult && (
          <div className="mt-4 border rounded-lg p-4 bg-gray-50">
            <h2 className="text-sm font-semibold mb-2">
              Run Diff: {diffResult.run_a.id.slice(0, 8)} vs {diffResult.run_b.id.slice(0, 8)}
            </h2>
            <div className="text-xs text-gray-600 mb-3 flex gap-4">
              <span>Steps A: {diffResult.summary.total_steps_a}</span>
              <span>Steps B: {diffResult.summary.total_steps_b}</span>
              <span>Status changed: {diffResult.summary.status_changed}</span>
              <span>Output diffs: {diffResult.summary.steps_with_diffs}</span>
            </div>
            {diffResult.step_diffs.length === 0 ? (
              <p className="text-xs text-gray-500">No differences found</p>
            ) : (
              <div className="space-y-2">
                {diffResult.step_diffs.map((sd) => (
                  <div key={sd.step_key} className="bg-white rounded border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{sd.label}</span>
                      {sd.status_a !== sd.status_b && (
                        <span className="text-xs text-red-600">
                          {sd.status_a} → {sd.status_b}
                        </span>
                      )}
                      {sd.duration_a != null && sd.duration_b != null && (
                        <span className="text-xs text-gray-500">
                          {sd.duration_a}ms → {sd.duration_b}ms
                        </span>
                      )}
                    </div>
                    {sd.output_diffs?.map((od, i) => (
                      <div key={i} className="text-xs font-mono pl-2 border-l-2 border-gray-200 mt-1">
                        <span className="text-gray-500">{od.path}:</span>{' '}
                        {od.type === 'changed' && (
                          <>
                            <span className="text-red-600 line-through">{String(od.old)}</span>
                            {' → '}
                            <span className="text-green-600">{String(od.new)}</span>
                          </>
                        )}
                        {od.type === 'added' && <span className="text-green-600">+ {String(od.new)}</span>}
                        {od.type === 'removed' && <span className="text-red-600">- {String(od.old)}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
