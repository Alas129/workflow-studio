export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TestStatus = 'n/a' | 'pass' | 'fail';

export interface StepRunResult {
  step_id: string;
  step_type: string;
  label: string;
  matrix_index?: number;
  matrix_key?: string;
  status: string;
  test_status: TestStatus;
  attempts: number;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  error?: string;
  logs: string[];
}

export interface RunRecord {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: RunStatus;
  preset_id?: string;
  variables: Record<string, string>;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  step_results: StepRunResult[];
  summary: Record<string, unknown>;
  error?: string;
}

export type ExecutionEvent =
  | { type: 'run_started'; run_id: string; timestamp: string; data: Record<string, unknown> }
  | { type: 'step_started'; run_id: string; step_id: string; matrix_index?: number; timestamp: string; data: Record<string, unknown> }
  | { type: 'step_progress'; run_id: string; step_id: string; matrix_index?: number; timestamp: string; data: Record<string, unknown> }
  | { type: 'step_completed'; run_id: string; step_id: string; matrix_index?: number; timestamp: string; data: Record<string, unknown> }
  | { type: 'step_failed'; run_id: string; step_id: string; matrix_index?: number; timestamp: string; data: Record<string, unknown> }
  | { type: 'run_completed'; run_id: string; timestamp: string; data: Record<string, unknown> }
  | { type: 'run_failed'; run_id: string; timestamp: string; data: Record<string, unknown> };

// Schedule / Suite
export interface Schedule {
  id: string;
  workflow_id: string;
  name: string;
  interval_seconds: number;
  variables: Record<string, string>;
  preset_id?: string;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  workflow_ids: string[];
}

// Diff
export interface RunDiff {
  run_a: { id: string; started_at: string; status: string };
  run_b: { id: string; started_at: string; status: string };
  summary: {
    total_steps_a: number;
    total_steps_b: number;
    only_in_a: string[];
    only_in_b: string[];
    status_changed: number;
    steps_with_diffs: number;
  };
  step_diffs: Array<{
    step_key: string;
    step_id: string;
    label: string;
    status_a: string;
    status_b: string;
    duration_a?: number;
    duration_b?: number;
    output_diffs?: Array<{ path: string; type: string; old?: unknown; new?: unknown }>;
  }>;
}

// Metrics
export interface WorkflowMetrics {
  workflow_id: string;
  points: Array<{
    run_id: string;
    started_at: string;
    status: string;
    duration_ms: number;
    assertions_total: number;
    assertions_passed: number;
    assertions_failed: number;
  }>;
}
