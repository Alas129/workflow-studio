import type { ExecutionEvent } from '@/types/execution';

type MessageHandler = (event: ExecutionEvent) => void;

class ExecutionSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<MessageHandler>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private runId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect(runId: string): void {
    this.disconnect();
    this.runId = runId;
    this.reconnectAttempts = 0;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/runs/${runId}`;

    this.ws = new WebSocket(url);

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ExecutionEvent;
        this.handlers.forEach((h) => h(parsed));
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.runId = null;
    this.reconnectAttempts = 0;
  }

  subscribe(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (!this.runId || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      if (this.runId) this.connect(this.runId);
    }, delay);
  }
}

export const executionSocket = new ExecutionSocket();
