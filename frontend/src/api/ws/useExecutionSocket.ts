import { useEffect } from 'react';
import { executionSocket } from './socket';
import { useExecutionStore } from '@/stores/executionStore';

export function useExecutionSocket(runId: string | null) {
  const handleEvent = useExecutionStore((s) => s.handleEvent);

  useEffect(() => {
    if (!runId) return;
    executionSocket.connect(runId);
    const unsub = executionSocket.subscribe(handleEvent);
    return () => {
      unsub();
      executionSocket.disconnect();
    };
  }, [runId, handleEvent]);
}
