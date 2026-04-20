import { useEffect, useRef, useCallback } from 'react';
import { LiveGame } from './types';

type Handler = (game: LiveGame) => void;

export function useGameSocket(onUpdate: Handler) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate;

  const connect = useCallback(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!);

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data) as { type: string; payload: LiveGame };
      if (data.type === 'GAME_UPDATE') {
        handlerRef.current(data.payload);
      }
    };

    ws.onclose = () => {
      // 3초 후 재연결
      setTimeout(connect, 3000);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);
}
