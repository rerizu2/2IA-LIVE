export interface LiveRoom {
  id: string;
  title: string;
  broadcasterName: string;
  category: string;
  tags: string[];
  viewerCount: number;
  likes: number;
  isLive: boolean;
  createdAt: number;
  liveStartedAt?: number;
  thumbnailUrl?: string;
  hasAudio: boolean;
  hasVideo: boolean;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: number;
  isBroadcaster?: boolean;
  isSuperChat?: boolean;
  amount?: number;
  color?: string;
  avatarSeed?: string;
}

export interface LiveReaction {
  id: string;
  emoji: string;
  senderName: string;
  timestamp: number;
  xPercent: number; // 0 to 100
}

export type WebRTCSignal =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; targetId?: string; senderId: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; targetId: string; senderId: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; targetId: string; senderId: string };

export interface StreamArchive {
  id: string;
  roomId: string;
  title: string;
  broadcasterName: string;
  category: string;
  tags: string[];
  startedAt: number;
  endedAt: number;
  duration: number; // in seconds
  views: number;
  likes: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  hasRecordedVideo?: boolean;
  comments: ChatMessage[];
  superChats?: { amount: number; senderName: string; text: string; color: string }[];
  reactionsCount?: number;
  createdAt: number;
}

export type WSClientMessage =
  | { type: 'join_room'; roomId: string; role: 'broadcaster' | 'viewer'; userName: string }
  | { type: 'leave_room'; roomId: string }
  | { type: 'chat_message'; roomId: string; text: string; isSuperChat?: boolean; amount?: number; color?: string }
  | { type: 'send_reaction'; roomId: string; emoji: string }
  | { type: 'send_like'; roomId: string }
  | { type: 'signal'; roomId: string; signal: WebRTCSignal }
  | { type: 'stream_frame'; roomId: string; frameData: string } // Fallback / preview JPEG
  | { type: 'update_stream_info'; roomId: string; title?: string; category?: string; isLive?: boolean }
  | { type: 'get_rooms' };

export type WSServerMessage =
  | { type: 'room_state'; room: LiveRoom; comments: ChatMessage[]; viewersCount: number; peerId: string }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'reaction'; reaction: LiveReaction }
  | { type: 'likes_updated'; likes: number }
  | { type: 'viewers_updated'; viewerCount: number }
  | { type: 'signal'; signal: WebRTCSignal; fromId: string }
  | { type: 'peer_joined'; peerId: string; role: 'broadcaster' | 'viewer'; userName: string }
  | { type: 'peer_left'; peerId: string }
  | { type: 'stream_frame'; frameData: string }
  | { type: 'stream_status'; isLive: boolean }
  | { type: 'rooms_updated'; rooms: LiveRoom[] }
  | { type: 'room_live_event'; event: 'start' | 'stop'; room: LiveRoom }
  | { type: 'archive_created'; archive: StreamArchive }
  | { type: 'error'; message: string };
