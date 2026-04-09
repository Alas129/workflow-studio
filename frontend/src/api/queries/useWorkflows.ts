import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { WorkflowDefinition } from '@/types/workflow';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<WorkflowDefinition[]>('/workflows'),
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => api.get<WorkflowDefinition>(`/workflows/${id}`),
    enabled: !!id,
  });
}

export function useSaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (wf: WorkflowDefinition) =>
      wf.created_at
        ? api.put<WorkflowDefinition>(`/workflows/${wf.id}`, wf)
        : api.post<WorkflowDefinition>('/workflows', wf),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
}
