import { useExecutionStore } from '@/stores/executionStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useStartRun, useCancelRun } from '@/api/queries/useRuns';
import { useExecutionSocket } from '@/api/ws/useExecutionSocket';
import { Play, Square, RotateCcw } from 'lucide-react';

export function ExecutionDashboard() {
  const activeRunId = useExecutionStore((s) => s.activeRunId);
  const runStatus = useExecutionStore((s) => s.runStatus);
  const progress = useExecutionStore((s) => s.progress);
  const eventLog = useExecutionStore((s) => s.eventLog);
  const startRunStore = useExecutionStore((s) => s.startRun);
  const resetStore = useExecutionStore((s) => s.reset);

  const workflowId = useWorkflowStore((s) => s.workflowId);
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const variables = useWorkflowStore((s) => s.variables);
  const setNodeStatus = useWorkflowStore((s) => s.setNodeExecutionStatus);
  const clearStatuses = useWorkflowStore((s) => s.clearExecutionStatuses);

  const startRunMutation = useStartRun();
  const cancelRunMutation = useCancelRun();

  useExecutionSocket(activeRunId);

  // Update node statuses from events
  const stepEvents = eventLog.filter(
    (e) => e.type === 'step_started' || e.type === 'step_completed' || e.type === 'step_failed'
  );

  const handleStart = async () => {
    if (!workflowId || nodes.length === 0) return;

    clearStatuses();

    try {
      const result = await startRunMutation.mutateAsync({
        workflow_id: workflowId,
        variables,
      });
      startRunStore(result.run_id, nodes.length);
    } catch (err) {
      console.error('Failed to start run:', err);
    }
  };

  const handleCancel = () => {
    if (activeRunId) {
      cancelRunMutation.mutate(activeRunId);
    }
  };

  const handleReset = () => {
    clearStatuses();
    resetStore();
  };

  const isRunning = runStatus === 'running' || runStatus === 'pending';
  const progressPct = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={!workflowId || nodes.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Play size={14} /> Run Workflow
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
          >
            <Square size={14} /> Cancel
          </button>
        )}
        {runStatus && !isRunning && (
          <button
            onClick={handleReset}
            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Progress */}
      {runStatus && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span className="capitalize">{runStatus}</span>
            <span>{progress.completed} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                runStatus === 'failed' ? 'bg-red-500' :
                runStatus === 'completed' ? 'bg-green-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Event Log */}
      {eventLog.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase">Event Log</h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {eventLog.map((event, i) => (
              <div key={i} className="text-xs px-2 py-1 rounded bg-gray-50 flex items-start gap-2">
                <span className={`shrink-0 font-mono ${
                  event.type.includes('failed') ? 'text-red-600' :
                  event.type.includes('completed') ? 'text-green-600' :
                  event.type.includes('started') ? 'text-blue-600' :
                  'text-gray-500'
                }`}>
                  {event.type.replace('run_', '').replace('step_', '')}
                </span>
                {'step_id' in event && event.step_id && (
                  <span className="text-gray-400 truncate">{event.step_id}</span>
                )}
                {'matrix_index' in event && event.matrix_index != null && (
                  <span className="text-gray-300">[{event.matrix_index}]</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!runStatus && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500">
            {workflowId
              ? 'Click "Run Workflow" to execute'
              : 'Save your workflow first, then run it'}
          </p>
        </div>
      )}
    </div>
  );
}
