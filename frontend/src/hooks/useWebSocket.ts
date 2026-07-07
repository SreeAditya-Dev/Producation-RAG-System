import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage, WSEventType } from '../types';
import { getClientId } from '../services/clientId';

type EventHandler = (msg: WSMessage) => void;

function buildWsUrl(): string {
  const apiKey = import.meta.env.VITE_API_KEY || '';
  const clientId = getClientId();
  const params = new URLSearchParams({ client_id: clientId, key: apiKey });
  const wsBase = import.meta.env.VITE_WS_BASE_URL || `ws://${window.location.hostname}:8000`;
  return `${wsBase}/ws?${params.toString()}`;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<WSEventType | '*', Set<EventHandler>>>(new Map());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);
        // Notify specific handlers
        const specific = handlersRef.current.get(msg.event);
        specific?.forEach((h) => h(msg));
        // Notify wildcard handlers
        const wildcard = handlersRef.current.get('*');
        wildcard?.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((event: WSEventType | '*', handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);

    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { connected, on, send };
}
