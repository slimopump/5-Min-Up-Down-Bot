const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export interface ReconnectingWsOptions {
  url: string;
  label?: string;
  onopen?: (ws: WebSocket) => void;
  onmessage: (event: MessageEvent) => void;
  onerror?: (err: Event) => void;
}

export interface ReconnectingWs {
  destroy: () => void;
}

export function createReconnectingWs(
  opts: ReconnectingWsOptions,
): ReconnectingWs {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let destroyed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (destroyed) return;

    ws = new WebSocket(opts.url);

    ws.onopen = () => {
      attempt = 0;
      opts.onopen?.(ws!);
    };

    ws.onmessage = opts.onmessage;

    ws.onerror = (err) => {
      opts.onerror?.(err);
    };

    ws.onclose = () => {
      if (destroyed) return;
      const delay = Math.min(
        BASE_DELAY_MS * Math.pow(2, attempt),
        MAX_DELAY_MS,
      );
      attempt++;
      const label = opts.label ? `[${opts.label}]` : "[WS]";
      console.warn(
        `${label} Disconnected. Reconnecting in ${delay}ms (attempt ${attempt})...`,
      );
      retryTimer = setTimeout(connect, delay);
    };
  }

  connect();

  return {
    destroy() {
      destroyed = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },
  };
}
