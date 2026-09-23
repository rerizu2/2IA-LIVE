import { useState } from 'react';
import { ViewerPlayer } from './ViewerPlayer';
import { ChatPanel } from './ChatPanel';
import { useLiveSocket } from './useLiveSocket';
import { useWebRTC } from './useWebRTC';
import type { LiveRoom } from './types';
import { ArrowLeft, Radio, Eye, RadioTower } from 'lucide-react';

interface WatchPageProps {
  roomId: string;
  initialRoom: LiveRoom | null;
  onBackToList: () => void;
  onGoToBroadcast: () => void;
  allRooms?: LiveRoom[];
  onSelectRoom?: (roomId: string) => void;
}

export function WatchPage({
  roomId,
  initialRoom,
  onBackToList,
  onGoToBroadcast,
  allRooms = [],
  onSelectRoom,
}: WatchPageProps) {
  const [viewerName, setViewerName] = useState(() => {
    const saved = localStorage.getItem('ls_viewer_name');
    if (saved) return saved;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `リスナー-${randomSuffix}`;
  });

  const handleUpdateName = (name: string) => {
    setViewerName(name);
    try {
      localStorage.setItem('ls_viewer_name', name);
    } catch {}
  };

  const {
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
  } = useLiveSocket({
    roomId,
    role: 'viewer',
    userName: viewerName,
    onSignal: (signal, fromId) => {
      rtc.handleSignal(signal, fromId);
    },
  });

  const rtc = useWebRTC({
    role: 'viewer',
    peerId,
    localStream: null,
    onSendSignal: sendSignal,
  });

  const activeRoom = room || initialRoom;
  const otherLiveRooms = allRooms.filter((r) => r.isLive && r.id !== roomId);

  return (
    <div id="watch-page" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Navigation Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800 mb-6">
        <div className="flex items-center space-x-3">
          <button
            id="back-to-list-btn"
            onClick={onBackToList}
            className="flex items-center space-x-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>配信一覧に戻る</span>
          </button>

          {isLive ? (
            <div className="flex items-center space-x-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300 border border-rose-500/40 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>LIVE 配信中</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-400">
              <span>準備中 / オフライン</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="watch-goto-studio-btn"
            onClick={onGoToBroadcast}
            className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-rose-950/40 hover:from-rose-500 hover:to-pink-500 transition-all active:scale-95"
          >
            <Radio className="h-3.5 w-3.5" />
            <span>配信スタジオへ行く / 戻る</span>
          </button>
        </div>
      </div>

      {/* Other Ongoing Live Streams Ribbon (If multiple streams are live) */}
      {otherLiveRooms.length > 0 && onSelectRoom && (
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-rose-500/30 p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center space-x-2">
              <RadioTower className="h-4 w-4 text-rose-400 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">
                他に配信中のライブ ({otherLiveRooms.length}件)
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              クリックでチャンネル切り替え
            </span>
          </div>

          <div className="flex items-center space-x-3 overflow-x-auto pb-1 scrollbar-none">
            {otherLiveRooms.map((oRoom) => (
              <button
                key={oRoom.id}
                onClick={() => onSelectRoom(oRoom.id)}
                className="flex items-center space-x-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 p-2 text-left transition-all shrink-0 max-w-xs group"
              >
                <div className="relative h-10 w-14 shrink-0 rounded-lg bg-slate-900 overflow-hidden">
                  {oRoom.thumbnailUrl ? (
                    <img
                      src={oRoom.thumbnailUrl}
                      alt={oRoom.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-rose-950/50">
                      <Radio className="h-4 w-4 text-rose-400 animate-pulse" />
                    </div>
                  )}
                  <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] font-bold text-rose-400 px-1 rounded">
                    LIVE
                  </span>
                </div>

                <div className="overflow-hidden min-w-[120px]">
                  <p className="text-xs font-bold text-slate-200 truncate group-hover:text-rose-400 transition-colors">
                    {oRoom.title}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                    <span className="truncate">{oRoom.broadcasterName}</span>
                    <span className="flex items-center space-x-0.5 text-rose-400 ml-1">
                      <Eye className="h-2.5 w-2.5" />
                      <span>{oRoom.viewerCount}</span>
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Player on Left, Chat on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player Section */}
        <div className="lg:col-span-2">
          <ViewerPlayer
            room={activeRoom}
            remoteStream={rtc.remoteStream}
            fallbackFrame={latestFrame}
            isLive={isLive}
            comments={comments}
            reactions={reactions}
            likes={likes}
            viewerCount={viewerCount}
            isConnected={isConnected}
            onSendLike={sendLike}
            onSendReaction={sendReaction}
          />
        </div>

        {/* Chat Section */}
        <div className="h-[550px] lg:h-[620px] flex flex-col">
          <ChatPanel
            comments={comments}
            onSendMessage={sendChatMessage}
            onSendReaction={sendReaction}
            currentUserName={viewerName}
            onChangeUserName={handleUpdateName}
            isBroadcaster={false}
          />
        </div>
      </div>
    </div>
  );
}
