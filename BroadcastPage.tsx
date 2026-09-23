import { useState } from 'react';
import { BroadcasterStudio } from './BroadcasterStudio';
import { useLiveSocket } from './useLiveSocket';
import { useWebRTC } from './useWebRTC';
import type { LiveRoom } from './types';

interface BroadcastPageProps {
  roomId: string;
  initialRoom: LiveRoom | null;
  onGoToWatch: (roomId: string) => void;
  onGoToArchive?: (archiveId: string) => void;
}

export function BroadcastPage({
  roomId,
  initialRoom,
  onGoToWatch,
  onGoToArchive,
}: BroadcastPageProps) {
  const [broadcasterName, setBroadcasterName] = useState(() => {
    const saved = localStorage.getItem('ls_broadcaster_name');
    if (saved) return saved;
    return '公式配信者';
  });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const handleUpdateName = (name: string) => {
    setBroadcasterName(name);
    try {
      localStorage.setItem('ls_broadcaster_name', name);
    } catch {}
  };

  const {
    room,
    comments,
    viewerCount,
    likes,
    isConnected,
    peerId,
    reactions,
    sendChatMessage,
    sendReaction,
    sendLike,
    sendStreamFrame,
    updateStreamInfo,
    sendSignal,
  } = useLiveSocket({
    roomId,
    role: 'broadcaster',
    userName: broadcasterName,
    onSignal: (signal, fromId) => {
      rtc.handleSignal(signal, fromId);
    },
    onPeerJoined: (viewerPeerId, role) => {
      if (role === 'viewer') {
        rtc.initiateOfferForViewer(viewerPeerId);
      }
    },
    onPeerLeft: (viewerPeerId) => {
      rtc.handlePeerLeft(viewerPeerId);
    },
  });

  const rtc = useWebRTC({
    role: 'broadcaster',
    peerId,
    localStream,
    onSendSignal: sendSignal,
  });

  return (
    <div>
      <BroadcasterStudio
        roomId={roomId}
        room={room || initialRoom}
        comments={comments}
        reactions={reactions}
        viewerCount={viewerCount}
        likes={likes}
        isSocketConnected={isConnected}
        onSendMessage={sendChatMessage}
        onSendReaction={sendReaction}
        onSendLike={sendLike}
        onSendStreamFrame={sendStreamFrame}
        onUpdateStreamInfo={updateStreamInfo}
        onStreamReady={setLocalStream}
        currentUserName={broadcasterName}
        onChangeUserName={handleUpdateName}
        onGoToWatch={onGoToWatch}
        onGoToArchive={onGoToArchive}
      />
    </div>
  );
}
