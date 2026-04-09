import type { Node, Edge } from '@xyflow/react';

export interface StepNodeData {
  stepType: string;
  label: string;
  config: Record<string, unknown>;
  executionStatus?: TaskExecutionStatus;
  color?: string;
  icon?: string;
  [key: string]: unknown;
}

export type TaskExecutionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'error-4xx'
  | 'error-5xx'
  | 'timeout'
  | 'skipped';

export type WorkflowNode = Node<StepNodeData>;
export type WorkflowEdge = Edge;

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  tags: string[];
  variables: Record<string, string>;
  steps: StepInstanceData[];
  connections: ConnectionData[];
  created_at?: string;
  updated_at?: string;
}

export interface StepInstanceData {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
  notes?: string;
}

export interface ConnectionData {
  source_step_id: string;
  source_output: string;
  target_step_id: string;
  target_input: string;
  condition?: string;
}
