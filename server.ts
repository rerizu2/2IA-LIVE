import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import type { LiveRoom, ChatMessage, LiveReaction, WSClientMessage, WSServerMessage, WebRTCSignal, StreamArchive } from './src/types';

interface ClientConnection {
  ws: WebSocket;
  id: string;
  userName: string;
  roomId: string | null;
  role: 'broadcaster' | 'viewer' | null;
}

interface InternalRoom {
  id: string;
  title: string;
  broadcasterName: string;
  category: string;
  tags: string[];
  broadcasterClient: ClientConnection | null;
  clients: Set<ClientConnection>;
  likes: number;
  isLive: boolean;
  createdAt: number;
  liveStartedAt?: number;
  comments: ChatMessage[];
  lastThumbnail?: string;
  lastThumbnailBroadcast?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  disconnectTimer?: NodeJS.Timeout;
}

const rooms = new Map<string, InternalRoom>();
const archives = new Map<string, StreamArchive>();
const allClients = new Map<WebSocket, ClientConnection>();

function archiveRoomStream(room: InternalRoom): StreamArchive | null {
  // Only archive if the stream was live or had activity
  if (!room.liveStartedAt && !room.lastThumbnail && room.comments.length === 0) {
    return null;
  }

  const duration = Math.max(
    5,
    Math.round((Date.now() - (room.liveStartedAt || room.createdAt)) / 1000)
  );

  const archiveId = `archive-${Date.now().toString(36)}-${room.id.slice(-6)}`;
  const superChats = room.comments
    .filter((c) => c.isSuperChat && c.amount)
    .map((c) => ({
      amount: c.amount || 0,
      senderName: c.senderName,
      text: c.text,
      color: c.color || '#e11d48',
    }));

  const newArchive: StreamArchive = {
    id: archiveId,
    roomId: room.id,
    title: room.title,
    broadcasterName: room.broadcasterName,
    category: room.category,
    tags: room.tags,
    startedAt: room.liveStartedAt || room.createdAt,
    endedAt: Date.now(),
    duration,
    views: Math.max(room.clients.size * 2, 1),
    likes: room.likes,
    thumbnailUrl: room.lastThumbnail,
    hasRecordedVideo: false,
    comments: [...room.comments],
    superChats,
    reactionsCount: room.likes,
    createdAt: Date.now(),
  };

  archives.set(archiveId, newArchive);

  broadcastAllClients({
    type: 'archive_created',
    archive: newArchive,
  });

  return newArchive;
}

function toPublicRoom(room: InternalRoom): LiveRoom {
  return {
    id: room.id,
    title: room.title,
    broadcasterName: room.broadcasterName,
    category: room.category,
    tags: room.tags,
    viewerCount: room.clients.size,
    likes: room.likes,
    isLive: room.isLive,
    createdAt: room.createdAt,
    liveStartedAt: room.liveStartedAt,
    thumbnailUrl: room.lastThumbnail,
    hasAudio: room.hasAudio,
    hasVideo: room.hasVideo,
  };
}

function broadcastAllClients(message: WSServerMessage) {
  const payload = JSON.stringify(message);
  for (const client of allClients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payload);
      } catch {}
    }
  }
}

function getLiveRooms(): LiveRoom[] {
  // Clean up any empty rooms or rooms without active broadcaster
  for (const [id, room] of rooms.entries()) {
    if (!room.isLive || !room.broadcasterClient) {
      if (room.clients.size === 0) {
        rooms.delete(id);
      }
    }
  }

  // Only return rooms where someone is actively broadcasting!
  return Array.from(rooms.values())
    .filter((room) => room.isLive && !!room.broadcasterClient)
    .map(toPublicRoom);
}

function notifyAllRoomsUpdated() {
  const roomList = getLiveRooms();
  broadcastAllClients({
    type: 'rooms_updated',
    rooms: roomList,
  });
}

function broadcastToRoom(room: InternalRoom, message: WSServerMessage, excludeClient?: ClientConnection) {
  const payload = JSON.stringify(message);
  for (const client of room.clients) {
    if (excludeClient && client.id === excludeClient.id) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Get active live rooms
  app.get('/api/rooms', (req, res) => {
    res.json({ rooms: getLiveRooms() });
  });

  // Get single room details
  app.get('/api/rooms/:id', (req, res) => {
    const room = rooms.get(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({
      room: toPublicRoom(room),
      comments: room.comments.slice(-100),
    });
  });

  // Create room
  app.post('/api/rooms', (req, res) => {
    const { title, broadcasterName, category, tags } = req.body;
    const id = `stream-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newRoom: InternalRoom = {
      id,
      title: title || '新規ライブ配信',
      broadcasterName: broadcasterName || '配信者',
      category: category || '一般',
      tags: tags || ['ライブ'],
      broadcasterClient: null,
      clients: new Set(),
      likes: 0,
      isLive: false,
      createdAt: Date.now(),
      comments: [
        {
          id: `sys-${Date.now()}`,
          roomId: id,
          senderName: 'システム',
          senderId: 'system',
          text: '配信ルームが作成されました。配信を開始してください！',
          timestamp: Date.now(),
          color: '#8b5cf6',
        },
      ],
      hasAudio: true,
      hasVideo: true,
    };
    rooms.set(id, newRoom);
    notifyAllRoomsUpdated();
    res.json({ room: toPublicRoom(newRoom) });
  });

  // Archive REST API routes
  app.get('/api/archives', (req, res) => {
    const list = Array.from(archives.values()).sort((a, b) => b.createdAt - a.createdAt);
    res.json({ archives: list });
  });

  app.get('/api/archives/:id', (req, res) => {
    const archive = archives.get(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    archive.views += 1;
    res.json({ archive });
  });

  app.post('/api/archives', (req, res) => {
    const data: StreamArchive = req.body;
    if (!data || !data.title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const id = data.id || `archive-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const saved: StreamArchive = {
      ...data,
      id,
      createdAt: data.createdAt || Date.now(),
      views: data.views || 1,
      likes: data.likes || 0,
      comments: data.comments || [],
    };
    archives.set(id, saved);
    broadcastAllClients({
      type: 'archive_created',
      archive: saved,
    });
    res.json({ archive: saved });
  });

  app.delete('/api/archives/:id', (req, res) => {
    const exists = archives.has(req.params.id);
    if (exists) {
      archives.delete(req.params.id);
      return res.json({ success: true, id: req.params.id });
    }
    res.status(404).json({ error: 'Archive not found' });
  });

  app.post('/api/archives/:id/like', (req, res) => {
    const archive = archives.get(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    archive.likes += 1;
    res.json({ likes: archive.likes });
  });

  app.post('/api/archives/:id/view', (req, res) => {
    const archive = archives.get(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    archive.views += 1;
    res.json({ views: archive.views });
  });

  app.post('/api/archives/:id/comments', (req, res) => {
    const archive = archives.get(req.params.id);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }
    const { text, senderName, senderId, color, isSuperChat, amount } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Comment text required' });
    }
    const newComment: ChatMessage = {
      id: `arc-comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomId: archive.roomId,
      senderName: senderName || '視聴者',
      senderId: senderId || `user-${Date.now().toString(36)}`,
      text: text.trim(),
      timestamp: Date.now(),
      color: color || '#38bdf8',
      isSuperChat,
      amount,
    };
    archive.comments.push(newComment);
    if (isSuperChat && amount) {
      if (!archive.superChats) archive.superChats = [];
      archive.superChats.push({
        amount,
        senderName: newComment.senderName,
        text: newComment.text,
        color: newComment.color || '#e11d48',
      });
    }
    res.json({ comment: newComment });
  });

  // Serve standalone single-file HTML directly
  app.get('/standalone.html', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'standalone.html'));
  });

  app.get('/api/download-single-html', (req, res) => {
    const filePath = path.join(process.cwd(), 'public', 'standalone.html');
    res.download(filePath, 'livestream-app.html');
  });

  // WebSocket Server Setup
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        // If not /ws, let Vite handle if needed or close
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const client: ClientConnection = {
      ws,
      id: clientId,
      userName: `リスナー-${clientId.slice(-4)}`,
      roomId: null,
      role: null,
    };
    allClients.set(ws, client);

    ws.on('message', (data: string | Buffer) => {
      try {
        const raw = data.toString();
        const msg: WSClientMessage = JSON.parse(raw);

        if (msg.type === 'get_rooms') {
          ws.send(
            JSON.stringify({
              type: 'rooms_updated',
              rooms: Array.from(rooms.values()).map(toPublicRoom),
            }),
          );
        } else if (msg.type === 'join_room') {
          const { roomId, role, userName } = msg;
          client.userName = userName || client.userName;
          client.role = role;
          client.roomId = roomId;

          let room = rooms.get(roomId);
          const isBroadcaster = role === 'broadcaster';
          if (!room) {
            // Auto-create if doesn't exist
            room = {
              id: roomId,
              title: isBroadcaster ? `${client.userName} のライブ配信` : '配信ルーム',
              broadcasterName: isBroadcaster ? client.userName : '未接続',
              category: '雑談・トーク',
              tags: ['ライブ'],
              broadcasterClient: isBroadcaster ? client : null,
              clients: new Set(),
              likes: 0,
              isLive: isBroadcaster,
              createdAt: Date.now(),
              liveStartedAt: isBroadcaster ? Date.now() : undefined,
              comments: [],
              hasAudio: isBroadcaster,
              hasVideo: isBroadcaster,
            };
            rooms.set(roomId, room);
          }

          room.clients.add(client);
          if (role === 'broadcaster') {
            if (room.disconnectTimer) {
              clearTimeout(room.disconnectTimer);
              room.disconnectTimer = undefined;
            }
            room.broadcasterClient = client;
            room.isLive = true;
            room.broadcasterName = client.userName;
            if (!room.liveStartedAt) {
              room.liveStartedAt = Date.now();
            }
          }

          // Send current room state to joining client
          const stateMsg: WSServerMessage = {
            type: 'room_state',
            room: toPublicRoom(room),
            comments: room.comments.slice(-100),
            viewersCount: room.clients.size,
            peerId: client.id,
          };
          ws.send(JSON.stringify(stateMsg));

          // If room already has a frame, send it immediately so viewer doesn't see black screen
          if (room.lastThumbnail) {
            ws.send(
              JSON.stringify({
                type: 'stream_frame',
                frameData: room.lastThumbnail,
              }),
            );
          }

          // Notify existing room members that peer joined
          broadcastToRoom(
            room,
            {
              type: 'peer_joined',
              peerId: client.id,
              role: client.role,
              userName: client.userName,
            },
            client,
          );

          // Broadcast updated viewer count
          broadcastToRoom(room, {
            type: 'viewers_updated',
            viewerCount: room.clients.size,
          });

          // Broadcast platform-wide room update
          notifyAllRoomsUpdated();
        } else if (msg.type === 'chat_message') {
          const { roomId, text, isSuperChat, amount, color } = msg;
          const room = rooms.get(roomId);
          if (room && text && text.trim().length > 0) {
            const newComment: ChatMessage = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              roomId,
              senderName: client.userName,
              senderId: client.id,
              text: text.trim().slice(0, 300),
              timestamp: Date.now(),
              isBroadcaster: client.role === 'broadcaster',
              isSuperChat: !!isSuperChat,
              amount: amount || undefined,
              color: color || (client.role === 'broadcaster' ? '#f59e0b' : '#3b82f6'),
            };
            room.comments.push(newComment);
            if (room.comments.length > 200) {
              room.comments.shift();
            }

            broadcastToRoom(room, {
              type: 'chat_message',
              message: newComment,
            });
          }
        } else if (msg.type === 'send_reaction') {
          const { roomId, emoji } = msg;
          const room = rooms.get(roomId);
          if (room) {
            const reaction: LiveReaction = {
              id: `re-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              emoji: emoji || '👏',
              senderName: client.userName,
              timestamp: Date.now(),
              xPercent: Math.floor(Math.random() * 80) + 10,
            };
            broadcastToRoom(room, {
              type: 'reaction',
              reaction,
            });
          }
        } else if (msg.type === 'send_like') {
          const { roomId } = msg;
          const room = rooms.get(roomId);
          if (room) {
            room.likes += 1;
            broadcastToRoom(room, {
              type: 'likes_updated',
              likes: room.likes,
            });
            notifyAllRoomsUpdated();
          }
        } else if (msg.type === 'stream_frame') {
          // Broadcaster sending video frame (JPEG base64) for fallback or thumbnail
          const { roomId, frameData } = msg;
          const room = rooms.get(roomId);
          if (room && client.role === 'broadcaster') {
            room.lastThumbnail = frameData;
            broadcastToRoom(
              room,
              {
                type: 'stream_frame',
                frameData,
              },
              client,
            );

            // Periodically refresh platform-wide thumbnails for real-time live preview
            const now = Date.now();
            if (!room.lastThumbnailBroadcast || now - room.lastThumbnailBroadcast > 2500) {
              room.lastThumbnailBroadcast = now;
              notifyAllRoomsUpdated();
            }
          }
        } else if (msg.type === 'signal') {
          // WebRTC Signaling routing
          const { roomId, signal } = msg;
          const room = rooms.get(roomId);
          if (room) {
            // Find target recipient
            if (signal.targetId) {
              for (const targetClient of room.clients) {
                if (targetClient.id === signal.targetId && targetClient.ws.readyState === WebSocket.OPEN) {
                  targetClient.ws.send(
                    JSON.stringify({
                      type: 'signal',
                      signal,
                      fromId: client.id,
                    }),
                  );
                  break;
                }
              }
            } else if (client.role === 'viewer' && room.broadcasterClient) {
              // Target is broadcaster
              if (room.broadcasterClient.ws.readyState === WebSocket.OPEN) {
                room.broadcasterClient.ws.send(
                  JSON.stringify({
                    type: 'signal',
                    signal,
                    fromId: client.id,
                  }),
                );
              }
            }
          }
        } else if (msg.type === 'update_stream_info') {
          const { roomId, title, category, isLive } = msg;
          const room = rooms.get(roomId);
          if (room && client.role === 'broadcaster') {
            if (title) room.title = title;
            if (category) room.category = category;
            if (typeof isLive === 'boolean') {
              room.isLive = isLive;
              if (isLive && !room.liveStartedAt) {
                room.liveStartedAt = Date.now();
              }
              if (!isLive) {
                if (room.disconnectTimer) {
                  clearTimeout(room.disconnectTimer);
                  room.disconnectTimer = undefined;
                }
                archiveRoomStream(room);
              }
              broadcastToRoom(room, {
                type: 'stream_status',
                isLive,
              });
            }
            notifyAllRoomsUpdated();
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });

    const handleDisconnect = () => {
      allClients.delete(ws);
      if (client.roomId) {
        const room = rooms.get(client.roomId);
        if (room) {
          room.clients.delete(client);
          if (room.broadcasterClient === client) {
            room.broadcasterClient = null;
            room.isLive = false;
            if (room.disconnectTimer) clearTimeout(room.disconnectTimer);
            archiveRoomStream(room);
            broadcastToRoom(room, {
              type: 'stream_status',
              isLive: false,
            });
            notifyAllRoomsUpdated();
          }
          broadcastToRoom(room, {
            type: 'peer_left',
            peerId: client.id,
          });
          broadcastToRoom(room, {
            type: 'viewers_updated',
            viewerCount: room.clients.size,
          });
          notifyAllRoomsUpdated();
        }
      }
    };

    ws.on('close', handleDisconnect);
    ws.on('error', handleDisconnect);
  });

  // Vite middleware in dev, Static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Live Stream Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
