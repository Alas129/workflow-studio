import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { StepDefinition } from '@/types/step';

export function useStepTemplates() {
  return useQuery({
    queryKey: ['step-templates'],
    queryFn: () => api.get<StepDefinition[]>('/step-templates'),
    staleTime: Infinity,
  });
}
