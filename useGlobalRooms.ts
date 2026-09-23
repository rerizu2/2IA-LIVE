import { useEffect, useRef, useState, useCallback } from 'react';
import type { LiveRoom, WSServerMessage } from '../types';

export function useGlobalRooms() {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Initial HTTP fetch
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.warn('Failed to fetch rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();

    let isMounted = true;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          ws.send(JSON.stringify({ type: 'get_rooms' }));
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg: WSServerMessage = JSON.parse(event.data);
            if (msg.type === 'rooms_updated') {
              setRooms(msg.rooms);
              setIsLoading(false);
            }
          } catch (e) {
            console.error('Error handling rooms socket msg:', e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.error('Failed to create rooms websocket:', err);
      }
    };

    connect();

    // Fallback polling interval in case websocket is disconnected
    const pollInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchRooms();
      }
    }, 4000);

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchRooms]);

  return { rooms, isLoading, isConnected, refreshRooms: fetchRooms };
}
