import type { TaskExecutionStatus } from '@/types/workflow';

export const statusColors: Record<TaskExecutionStatus, { bg: string; text: string; border: string }> = {
  success:    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-400' },
  'error-5xx': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-400' },
  'error-4xx': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-400' },
  timeout:    { bg: 'bg-gray-200', text: 'text-gray-600', border: 'border-gray-400' },
  running:    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-400' },
  queued:     { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-300' },
  skipped:    { bg: 'bg-gray-50', text: 'text-gray-400', border: 'border-gray-200' },
};

export function httpStatusToExecution(code: number): TaskExecutionStatus {
  if (code >= 200 && code < 300) return 'success';
  if (code >= 400 && code < 500) return 'error-4xx';
  if (code >= 500) return 'error-5xx';
  return 'timeout';
}
