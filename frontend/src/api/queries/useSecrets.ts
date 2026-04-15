import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

interface SecretEntry {
  key: string;
  source: 'file' | 'env';
}

export function useSecrets() {
  return useQuery({
    queryKey: ['secrets'],
    queryFn: () => api.get<{ keys: SecretEntry[] }>('/secrets'),
  });
}

export function useCreateSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { key: string; value: string }) =>
      api.post('/secrets', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets'] }),
  });
}

export function useDeleteSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.delete(`/secrets/${key}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets'] }),
  });
}
