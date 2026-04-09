import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { RunRecord } from '@/types/execution';

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
    queryKey: ['runs', runId],
    queryFn: () => api.get<RunRecord>(`/runs/${runId}`),
    enabled: !!runId,
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
