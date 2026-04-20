import { useEffect, useRef, useCallback } from 'react';
import { LiveGame } from './types';

type Handler = (game: LiveGame) => void;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8001/ws';

export function useGameSocket(onUpdate: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onUpdate);
  const mountedRef = useRef(true);
  handlerRef.current = onUpdate;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_URL);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { type: string; payload: LiveGame };
        if (data.type === 'GAME_UPDATE') {
          handlerRef.current(data.payload);
        }
      } catch { /* ignore malformed messages */ }
    };

    ws.onerror = () => ws.close();

    ws.onclose = () => {
      if (mountedRef.current) setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);
}
