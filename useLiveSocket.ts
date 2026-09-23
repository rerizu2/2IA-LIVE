import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  LiveRoom,
  ChatMessage,
  LiveReaction,
  WSClientMessage,
  WSServerMessage,
  WebRTCSignal,
} from '../types';

interface UseLiveSocketOptions {
  roomId: string;
  role: 'broadcaster' | 'viewer';
  userName: string;
  onSignal?: (signal: WebRTCSignal, fromId: string) => void;
  onPeerJoined?: (peerId: string, role: string, userName: string) => void;
  onPeerLeft?: (peerId: string) => void;
}

export function useLiveSocket({
  roomId,
  role,
  userName,
  onSignal,
  onPeerJoined,
  onPeerLeft,
}: UseLiveSocketOptions) {
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [comments, setComments] = useState<ChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [likes, setLikes] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [peerId, setPeerId] = useState<string>('');
  const [latestFrame, setLatestFrame] = useState<string | null>(null);
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [isLive, setIsLive] = useState<boolean>(true);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef<boolean>(true);

  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;

  const onPeerJoinedRef = useRef(onPeerJoined);
  onPeerJoinedRef.current = onPeerJoined;

  const onPeerLeftRef = useRef(onPeerLeft);
  onPeerLeftRef.current = onPeerLeft;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        const joinMsg: WSClientMessage = {
          type: 'join_room',
          roomId,
          role,
          userName,
        };
        ws.send(JSON.stringify(joinMsg));
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg: WSServerMessage = JSON.parse(event.data);
          switch (msg.type) {
            case 'room_state':
              setRoom(msg.room);
              setComments(msg.comments);
              setViewerCount(msg.viewersCount);
              setLikes(msg.room.likes);
              setPeerId(msg.peerId);
              setIsLive(msg.room.isLive);
              if (msg.room.thumbnailUrl) {
                setLatestFrame(msg.room.thumbnailUrl);
              }
              break;
            case 'chat_message':
              setComments((prev) => {
                // Deduplicate by id
                if (prev.some((c) => c.id === msg.message.id)) return prev;
                const next = [...prev, msg.message];
                return next.slice(-200);
              });
              break;
            case 'reaction':
              setReactions((prev) => [...prev.slice(-30), msg.reaction]);
              break;
            case 'likes_updated':
              setLikes(msg.likes);
              break;
            case 'viewers_updated':
              setViewerCount(msg.viewerCount);
              break;
            case 'signal':
              onSignalRef.current?.(msg.signal, msg.fromId);
              break;
            case 'peer_joined':
              onPeerJoinedRef.current?.(msg.peerId, msg.role, msg.userName);
              break;
            case 'peer_left':
              onPeerLeftRef.current?.(msg.peerId);
              break;
            case 'stream_frame':
              setLatestFrame(msg.frameData);
              break;
            case 'stream_status':
              setIsLive(msg.isLive);
              break;
            case 'archive_created':
              window.dispatchEvent(new CustomEvent('applet:archive_created', { detail: msg.archive }));
              break;
            case 'rooms_updated': {
              const current = msg.rooms.find((r) => r.id === roomId);
              if (current) {
                setRoom(current);
                setIsLive(current.isLive);
                if (current.thumbnailUrl) {
                  setLatestFrame(current.thumbnailUrl);
                }
              }
              break;
            }
            case 'error':
              console.warn('Live socket error message:', msg.message);
              break;
          }
        } catch (err) {
          console.error('Error handling socket message:', err);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        // Attempt fast reconnect within 800ms
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 800);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    } catch (e) {
      console.error('Failed to instantiate WebSocket:', e);
    }
  }, [roomId, role, userName]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    // Reconnect immediately when browser tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((msg: WSClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendChatMessage = useCallback(
    (text: string, isSuperChat = false, amount = 0, color?: string) => {
      send({
        type: 'chat_message',
        roomId,
        text,
        isSuperChat,
        amount,
        color,
      });
    },
    [send, roomId],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      send({
        type: 'send_reaction',
        roomId,
        emoji,
      });
    },
    [send, roomId],
  );

  const sendLike = useCallback(() => {
    send({
      type: 'send_like',
      roomId,
    });
  }, [send, roomId]);

  const sendSignal = useCallback(
    (signal: WebRTCSignal) => {
      send({
        type: 'signal',
        roomId,
        signal,
      });
    },
    [send, roomId],
  );

  const sendStreamFrame = useCallback(
    (frameData: string) => {
      send({
        type: 'stream_frame',
        roomId,
        frameData,
      });
    },
    [send, roomId],
  );

  const updateStreamInfo = useCallback(
    (title?: string, category?: string, streamLive?: boolean) => {
      send({
        type: 'update_stream_info',
        roomId,
        title,
        category,
        isLive: streamLive,
      });
    },
    [send, roomId],
  );

  return {
    room,
    comments,
    viewerCount,
    likes,
    isConnected,
    peerId,
    latestFrame,
    reactions,
    isLive,
    sendChatMessage,
    sendReaction,
    sendLike,
    sendSignal,
    sendStreamFrame,
    updateStreamInfo,
  };
}
