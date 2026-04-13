import { create } from 'zustand';
import type { RunStatus, ExecutionEvent } from '@/types/execution';

interface ExecutionState {
  activeRunId: string | null;
  runStatus: RunStatus | null;
  progress: { completed: number; total: number };
  stepResults: Map<string, Record<string, unknown>>;
  eventLog: ExecutionEvent[];

  handleEvent: (event: ExecutionEvent) => void;
  startRun: (runId: string, totalSteps: number) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  activeRunId: null,
  runStatus: null,
  progress: { completed: 0, total: 0 },
  stepResults: new Map(),
  eventLog: [],

  handleEvent: (event) => {
    const state = get();
    const newLog = [...state.eventLog, event];

    switch (event.type) {
      case 'run_started':
        set({
          runStatus: 'running',
          eventLog: newLog,
          progress: { completed: 0, total: (event.data as { total_steps?: number }).total_steps ?? 0 },
        });
        break;

      case 'step_started':
        set({ eventLog: newLog });
        break;

      case 'step_completed': {
        const key = event.matrix_index != null
          ? `${event.step_id}:${event.matrix_index}`
          : event.step_id!;
        const newResults = new Map(state.stepResults);
        newResults.set(key, event.data);
        set({
          stepResults: newResults,
          progress: { ...state.progress, completed: state.progress.completed + 1 },
          eventLog: newLog,
        });
        break;
      }

      case 'step_failed': {
        const key = event.matrix_index != null
          ? `${event.step_id}:${event.matrix_index}`
          : event.step_id!;
        const newResults = new Map(state.stepResults);
        newResults.set(key, { ...event.data, _failed: true });
        set({
          stepResults: newResults,
          progress: { ...state.progress, completed: state.progress.completed + 1 },
          eventLog: newLog,
        });
        break;
      }

      case 'run_completed':
        set({ runStatus: 'completed', eventLog: newLog });
        break;

      case 'run_failed':
        set({ runStatus: 'failed', eventLog: newLog });
        break;

      default:
        set({ eventLog: newLog });
    }
  },

  startRun: (runId, totalSteps) => {
    set({
      activeRunId: runId,
      runStatus: 'pending',
      progress: { completed: 0, total: totalSteps },
      stepResults: new Map(),
      eventLog: [],
    });
  },

  reset: () => {
    set({
      activeRunId: null,
      runStatus: null,
      progress: { completed: 0, total: 0 },
      stepResults: new Map(),
      eventLog: [],
    });
  },
}));
