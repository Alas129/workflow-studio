import { useEffect, useRef } from 'react';
import { useExecutionStore } from '@/stores/executionStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useStartRun, useCancelRun, useRun } from '@/api/queries/useRuns';
import { useExecutionSocket } from '@/api/ws/useExecutionSocket';
import type { RunRecord, ExecutionEvent } from '@/types/execution';
import type { TaskExecutionStatus } from '@/types/workflow';
import {
  Play, Square, RotateCcw, CheckCircle, XCircle,
  Clock, Loader,
} from 'lucide-react';

export function ExecutionDashboard() {
  const activeRunId = useExecutionStore((s) => s.activeRunId);
  const runStatus = useExecutionStore((s) => s.runStatus);
  const progress = useExecutionStore((s) => s.progress);
  const eventLog = useExecutionStore((s) => s.eventLog);
  const startRunStore = useExecutionStore((s) => s.startRun);
  const resetStore = useExecutionStore((s) => s.reset);
  const handleEvent = useExecutionStore((s) => s.handleEvent);

  const workflowId = useWorkflowStore((s) => s.workflowId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const variables = useWorkflowStore((s) => s.variables);
  const setNodeStatus = useWorkflowStore((s) => s.setNodeExecutionStatus);
  const clearStatuses = useWorkflowStore((s) => s.clearExecutionStatuses);

  const startRunMutation = useStartRun();
  const cancelRunMutation = useCancelRun();

  // Connect WebSocket for live updates
  useExecutionSocket(activeRunId);

  // Poll for run result as fallback (handles fast-completing runs)
  const { data: runResult } = useRun(activeRunId);
  const hasAppliedResult = useRef<string | null>(null);

  useEffect(() => {
    if (
      runResult &&
      activeRunId &&
      hasAppliedResult.current !== activeRunId &&
      (runResult.status === 'completed' || runResult.status === 'failed' || runResult.status === 'cancelled') &&
      (runStatus === 'pending' || runStatus === 'running')
    ) {
      // Run finished before WebSocket could deliver events - apply from REST
      hasAppliedResult.current = activeRunId;
      applyRunResult(runResult, handleEvent, setNodeStatus);
    }
  }, [runResult, activeRunId, runStatus, handleEvent, setNodeStatus]);

  // Update node statuses from WebSocket events
  useEffect(() => {
    for (const event of eventLog) {
      if (event.type === 'step_started' && 'step_id' in event && event.step_id) {
        setNodeStatus(event.step_id, 'running');
      } else if (event.type === 'step_completed' && 'step_id' in event && event.step_id) {
        setNodeStatus(event.step_id, 'success');
      } else if (event.type === 'step_failed' && 'step_id' in event && event.step_id) {
        setNodeStatus(event.step_id, 'error-5xx');
      }
    }
  }, [eventLog, setNodeStatus]);

  const handleStart = async () => {
    if (!workflowId || nodes.length === 0) return;

    clearStatuses();
    hasAppliedResult.current = null;

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
    hasAppliedResult.current = null;
    resetStore();
  };

  const isRunning = runStatus === 'running' || runStatus === 'pending';
  const progressPct = progress.total > 0 ? Math.min(100, (progress.completed / progress.total) * 100) : 0;

  // Build step results display from run result
  const stepResults = runResult?.step_results || [];

  return (
    <div className="p-4 space-y-4">
      {/* Controls */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={!workflowId || nodes.length === 0 || startRunMutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {startRunMutation.isPending ? (
              <><Loader size={14} className="animate-spin" /> Starting...</>
            ) : (
              <><Play size={14} /> Run Workflow</>
            )}
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
            title="Reset"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Status Banner */}
      {runStatus && !isRunning && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
          runStatus === 'completed' ? 'bg-green-50 text-green-800' :
          runStatus === 'failed' ? 'bg-red-50 text-red-800' :
          'bg-gray-50 text-gray-800'
        }`}>
          {runStatus === 'completed' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          <span className="font-medium capitalize">{runStatus}</span>
          {runResult?.duration_ms != null && (
            <span className="text-xs opacity-70 ml-auto">
              {(runResult.duration_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      )}

      {/* Progress Bar (while running) */}
      {isRunning && (
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span className="flex items-center gap-1">
              <Loader size={12} className="animate-spin" /> Running...
            </span>
            <span>{progress.completed} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Step Results */}
      {stepResults.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase">
            Step Results ({stepResults.length})
          </h3>
          <div className="space-y-1.5">
            {stepResults.map((sr, i) => {
              const isSuccess = sr.status === 'completed';
              const isFailed = sr.status === 'failed';
              const statusCode = (sr.outputs as Record<string, unknown>)?.status_code as number | undefined;
              const durationMs = (sr.outputs as Record<string, unknown>)?.duration_ms as number | undefined
                || sr.duration_ms;

              return (
                <div
                  key={`${sr.step_id}-${sr.matrix_index ?? i}`}
                  className={`px-3 py-2 rounded border text-xs ${
                    isSuccess ? 'border-green-200 bg-green-50' :
                    isFailed ? 'border-red-200 bg-red-50' :
                    'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSuccess ? (
                      <CheckCircle size={12} className="text-green-500 shrink-0" />
                    ) : isFailed ? (
                      <XCircle size={12} className="text-red-500 shrink-0" />
                    ) : (
                      <Clock size={12} className="text-gray-400 shrink-0" />
                    )}
                    <span className="font-medium text-gray-700">{sr.label}</span>
                    {sr.matrix_key && (
                      <span className="text-gray-400 truncate text-[10px]">{sr.matrix_key}</span>
                    )}
                    <span className="ml-auto text-gray-400 shrink-0">
                      {statusCode && (
                        <span className={`font-mono mr-2 ${
                          statusCode >= 200 && statusCode < 300 ? 'text-green-600' :
                          statusCode >= 400 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {statusCode}
                        </span>
                      )}
                      {durationMs != null && `${durationMs}ms`}
                    </span>
                  </div>
                  {isFailed && sr.error && (
                    <div className="mt-1 text-red-600 truncate" title={sr.error}>
                      {sr.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {runResult?.summary && Object.keys(runResult.summary).length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(runResult.summary as Record<string, unknown>).map(([key, val]) => (
            <div key={key} className="bg-gray-50 rounded px-3 py-2 text-center">
              <div className="text-lg font-semibold text-gray-800">{String(val)}</div>
              <div className="text-[10px] text-gray-500 uppercase">{key.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!runStatus && (
        <div className="text-center py-8">
          <Play size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {workflowId
              ? 'Click "Run Workflow" to execute'
              : 'Save your workflow first, then run it'}
          </p>
          {!workflowId && nodes.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Drag steps to the canvas and save your workflow
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Apply a completed run result from REST to update the execution store */
function applyRunResult(
  run: RunRecord,
  handleEvent: (event: ExecutionEvent) => void,
  setNodeStatus: (nodeId: string, status: TaskExecutionStatus | undefined) => void,
) {
  // Synthesize events from the completed run
  handleEvent({
    type: 'run_started',
    run_id: run.id,
    timestamp: run.started_at,
    data: { total_steps: run.step_results.length },
  } as never);

  for (const sr of run.step_results) {
    const eventType = sr.status === 'completed' ? 'step_completed' : 'step_failed';
    handleEvent({
      type: eventType,
      run_id: run.id,
      step_id: sr.step_id,
      matrix_index: sr.matrix_index,
      timestamp: sr.finished_at || run.finished_at || '',
      data: {
        outputs: sr.outputs,
        error: sr.error,
        matrix_key: sr.matrix_key,
      },
    } as never);

    // Update node visual status
    if (sr.status === 'completed') {
      setNodeStatus(sr.step_id, 'success');
    } else if (sr.status === 'failed') {
      setNodeStatus(sr.step_id, 'error-5xx');
    }
  }

  handleEvent({
    type: run.status === 'completed' ? 'run_completed' : 'run_failed',
    run_id: run.id,
    timestamp: run.finished_at || '',
    data: { status: run.status, summary: run.summary },
  } as never);
}
