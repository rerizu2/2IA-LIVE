import { useState } from 'react';
import { BroadcasterStudio } from './BroadcasterStudio';
import { ViewerPlayer } from './ViewerPlayer';
import { ChatPanel } from './ChatPanel';
import { useLiveSocket } from './useLiveSocket';
import { useWebRTC } from './useWebRTC';
import type { LiveRoom } from './types';
import { Radio, Tv } from 'lucide-react';

interface DualViewProps {
  roomId: string;
  initialRoom: LiveRoom | null;
}

export function DualView({ roomId, initialRoom }: DualViewProps) {
  const [broadcasterName, setBroadcasterName] = useState('配信者ホスト');
  const [viewerName, setViewerName] = useState('リスナー太郎');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Broadcaster socket
  const broadcasterSocket = useLiveSocket({
    roomId,
    role: 'broadcaster',
    userName: broadcasterName,
    onSignal: (signal, fromId) => {
      broadcasterRtc.handleSignal(signal, fromId);
    },
    onPeerJoined: (peerId, role) => {
      if (role === 'viewer') {
        broadcasterRtc.initiateOfferForViewer(peerId);
      }
    },
    onPeerLeft: (peerId) => {
      broadcasterRtc.handlePeerLeft(peerId);
    },
  });

  // Broadcaster WebRTC
  const broadcasterRtc = useWebRTC({
    role: 'broadcaster',
    peerId: broadcasterSocket.peerId,
    localStream,
    onSendSignal: broadcasterSocket.sendSignal,
  });

  // Viewer socket
  const viewerSocket = useLiveSocket({
    roomId,
    role: 'viewer',
    userName: viewerName,
    onSignal: (signal, fromId) => {
      viewerRtc.handleSignal(signal, fromId);
    },
  });

  // Viewer WebRTC
  const viewerRtc = useWebRTC({
    role: 'viewer',
    peerId: viewerSocket.peerId,
    localStream: null,
    onSendSignal: viewerSocket.sendSignal,
  });

  return (
    <div id="dual-view-container" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Top Banner Notice */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/70 p-4 border border-emerald-500/30">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
            <h2 className="text-sm font-bold text-emerald-200">
              ⚡ 2画面分割プレビューモード（配信側 ＆ 視聴側同時テスト）
            </h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            左側で配信を行い、右側で視聴＆コメント投稿ができます。右側でコメントを送信すると、即座に左側のスタジオと動画上の弾幕に反映されます！
          </p>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300">
          <span>ルームID:</span>
          <span className="font-bold text-indigo-400">{roomId}</span>
        </div>
      </div>

      {/* 2-Column Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Broadcaster Side */}
        <div className="space-y-4 rounded-2xl bg-slate-950 p-4 border border-rose-500/30 shadow-xl">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
            <div className="p-1 rounded bg-rose-500/20 text-rose-400">
              <Radio className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">【配信側】配信スタジオ</h3>
          </div>

          <BroadcasterStudio
            room={broadcasterSocket.room || initialRoom}
            comments={broadcasterSocket.comments}
            viewerCount={broadcasterSocket.viewerCount}
            likes={broadcasterSocket.likes}
            isSocketConnected={broadcasterSocket.isConnected}
            onSendMessage={broadcasterSocket.sendChatMessage}
            onSendReaction={broadcasterSocket.sendReaction}
            onSendStreamFrame={broadcasterSocket.sendStreamFrame}
            onUpdateStreamInfo={broadcasterSocket.updateStreamInfo}
            onStreamReady={setLocalStream}
            currentUserName={broadcasterName}
            onChangeUserName={setBroadcasterName}
          />
        </div>

        {/* Right: Viewer Side */}
        <div className="space-y-4 rounded-2xl bg-slate-950 p-4 border border-indigo-500/30 shadow-xl flex flex-col">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
            <div className="p-1 rounded bg-indigo-500/20 text-indigo-400">
              <Tv className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-200">【視聴側】プレイヤー ＆ コメント欄</h3>
          </div>

          <ViewerPlayer
            room={viewerSocket.room || initialRoom}
            remoteStream={viewerRtc.remoteStream || localStream}
            fallbackFrame={viewerSocket.latestFrame}
            isLive={viewerSocket.isLive}
            comments={viewerSocket.comments}
            reactions={viewerSocket.reactions}
            likes={viewerSocket.likes}
            viewerCount={viewerSocket.viewerCount}
            isConnected={viewerSocket.isConnected}
            onSendLike={viewerSocket.sendLike}
            onSendReaction={viewerSocket.sendReaction}
          />

          <div className="flex-1 min-h-[380px]">
            <ChatPanel
              comments={viewerSocket.comments}
              onSendMessage={viewerSocket.sendChatMessage}
              onSendReaction={viewerSocket.sendReaction}
              currentUserName={viewerName}
              onChangeUserName={setViewerName}
              isBroadcaster={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
