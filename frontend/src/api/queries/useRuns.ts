import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { RunRecord, RunDiff, WorkflowMetrics, Schedule, TestSuite } from '@/types/execution';

export function useRuns(workflowId?: string) {
  return useQuery({
    queryKey: ['runs', workflowId],
    queryFn: () =>
      api.get<RunRecord[]>(`/runs${workflowId ? `?workflow_id=${workflowId}` : ''}`),
    refetchInterval: 5000,
  });
}

export function useRun(runId: string | null) {
  return useQuery({
    queryKey: ['runs', 'detail', runId],
    queryFn: () => api.get<RunRecord>(`/runs/${runId}`),
    enabled: !!runId,
    refetchInterval: (query) => {
      const data = query.state.data as RunRecord | undefined;
      // Poll every second until run is done
      if (!data || data.status === 'running' || data.status === 'pending') return 1000;
      return false;
    },
  });
}

export function useStartRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { workflow_id: string; variables?: Record<string, string> }) =>
      api.post<{ run_id: string }>('/runs', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  });
}

export function useCancelRun() {
  return useMutation({
    mutationFn: (runId: string) => api.post(`/runs/${runId}/cancel`),
  });
}

// Diff two runs
export function useRunDiff(runIdA: string | null, runIdB: string | null) {
  return useQuery({
    queryKey: ['runs', 'diff', runIdA, runIdB],
    queryFn: () => api.get<RunDiff>(`/runs/${runIdA}/diff?other=${runIdB}`),
    enabled: !!runIdA && !!runIdB,
  });
}

// Workflow performance metrics
export function useWorkflowMetrics(workflowId: string | null) {
  return useQuery({
    queryKey: ['workflows', 'metrics', workflowId],
    queryFn: () => api.get<WorkflowMetrics>(`/workflows/${workflowId}/metrics`),
    enabled: !!workflowId,
  });
}

// Schedules
export function useSchedules() {
  return useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get<Schedule[]>('/schedules'),
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { workflow_id: string; name: string; interval_seconds: number; variables?: Record<string, string> }) =>
      api.post<Schedule>('/schedules', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete('/schedules/' + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  });
}

// Test Suites
export function useSuites() {
  return useQuery({
    queryKey: ['suites'],
    queryFn: () => api.get<TestSuite[]>('/suites'),
  });
}

export function useCreateSuite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; workflow_ids: string[] }) =>
      api.post<TestSuite>('/suites', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suites'] }),
  });
}

export function useRunSuite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suiteId, variables }: { suiteId: string; variables?: Record<string, string> }) =>
      api.post<{ suite_id: string; run_ids: string[] }>(`/suites/${suiteId}/run`, { variables }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runs'] }),
  });
}

// Webhook trigger
export function useTriggerWebhook() {
  return useMutation({
    mutationFn: ({ workflowId, variables }: { workflowId: string; variables?: Record<string, string> }) =>
      api.post<{ run_id: string }>(`/webhooks/workflows/${workflowId}`, { variables }),
  });
}
