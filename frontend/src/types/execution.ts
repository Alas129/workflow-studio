import type { TaskExecutionStatus } from './workflow';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface StepRunResult {
  step_id: string;
  step_type: string;
  label: string;
  matrix_index?: number;
  matrix_key?: string;
  status: string;
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
