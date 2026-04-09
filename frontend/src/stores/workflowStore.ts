import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from '@xyflow/react';
import type { WorkflowNode, WorkflowEdge, TaskExecutionStatus } from '@/types/workflow';

interface WorkflowState {
  workflowId: string | null;
  workflowName: string;
  workflowDescription: string;
  variables: Record<string, string>;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  addNode: (node: WorkflowNode) => void;
  removeNode: (nodeId: string) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;
  updateNodeLabel: (nodeId: string, label: string) => void;
  setNodeExecutionStatus: (nodeId: string, status: TaskExecutionStatus | undefined) => void;
  clearExecutionStatuses: () => void;
  loadWorkflow: (
    id: string,
    name: string,
    description: string,
    variables: Record<string, string>,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
  ) => void;
  clearWorkflow: () => void;
  setVariables: (variables: Record<string, string>) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowId: null,
  workflowName: 'Untitled Workflow',
  workflowDescription: '',
  variables: {},
  nodes: [],
  edges: [],

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as WorkflowNode[] });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({ edges: addEdge(connection, get().edges) });
  },

  addNode: (node) => {
    set({ nodes: [...get().nodes, node] });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
  },

  updateNodeConfig: (nodeId, config) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, config } } : n,
      ),
    });
  },

  updateNodeLabel: (nodeId, label) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label } } : n,
      ),
    });
  },

  setNodeExecutionStatus: (nodeId, status) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, executionStatus: status } } : n,
      ),
    });
  },

  clearExecutionStatuses: () => {
    set({
      nodes: get().nodes.map((n) => ({
        ...n,
        data: { ...n.data, executionStatus: undefined },
      })),
    });
  },

  loadWorkflow: (id, name, description, variables, nodes, edges) => {
    set({
      workflowId: id,
      workflowName: name,
      workflowDescription: description,
      variables,
      nodes,
      edges,
    });
  },

  clearWorkflow: () => {
    set({
      workflowId: null,
      workflowName: 'Untitled Workflow',
      workflowDescription: '',
      variables: {},
      nodes: [],
      edges: [],
    });
  },

  setVariables: (variables) => {
    set({ variables });
  },
}));
