import { useState } from 'react';
import { Header } from './Header';
import { StreamList } from './StreamList';
import { WatchPage } from './WatchPage';
import { BroadcastPage } from './BroadcastPage';
import { DualView } from './DualView';
import { ArchiveList } from './ArchiveList';
import { ArchiveWatchPage } from './ArchiveWatchPage';
import { FloatingLiveBar } from './FloatingLiveBar';
import { useGlobalRooms } from './useGlobalRooms';
import { useArchives } from './useArchives';
import { Radio, Heart, ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'browse' | 'broadcast' | 'dual' | 'watch' | 'archives' | 'archive-watch'>('browse');
  const [activeRoomId, setActiveRoomId] = useState<string>('main-stream');
  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);

  // Real-time synchronization of all rooms across the entire application via WebSocket
  const { rooms, isLoading } = useGlobalRooms();

  // Archive synchronization
  const { archives, refreshArchives, removeArchiveFromState } = useArchives();

  const liveRooms = rooms.filter((r) => r.isLive);
  const activeRoom = rooms.find((r) => r.id === activeRoomId) || rooms[0] || null;
  const activeArchive = archives.find((a) => a.id === activeArchiveId) || archives[0] || null;

  const handleSelectRoom = (roomId: string) => {
    setActiveRoomId(roomId);
    setCurrentTab('watch');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectArchive = (archiveId: string) => {
    setActiveArchiveId(archiveId);
    setCurrentTab('archive-watch');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTab = (tab: 'browse' | 'broadcast' | 'dual' | 'archives') => {
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Top Navigation Bar with Real-Time Live Status */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        activeRoomCount={liveRooms.length}
        archiveCount={archives.length}
        liveRooms={liveRooms}
        onSelectRoom={handleSelectRoom}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-16">
        {isLoading && rooms.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-3">
            <Radio className="h-10 w-10 text-rose-500 animate-pulse" />
            <p className="text-sm font-semibold text-slate-400">
              配信ネットワークを準備中...
            </p>
          </div>
        ) : currentTab === 'browse' ? (
          <StreamList
            rooms={rooms}
            onSelectRoom={handleSelectRoom}
            onGoToBroadcast={() => handleSelectTab('broadcast')}
            onGoToArchives={() => handleSelectTab('archives')}
          />
        ) : currentTab === 'archives' ? (
          <ArchiveList
            archives={archives}
            onSelectArchive={handleSelectArchive}
            onGoToBroadcast={() => handleSelectTab('broadcast')}
            onGoToLiveBrowse={() => handleSelectTab('browse')}
          />
        ) : currentTab === 'archive-watch' && activeArchive ? (
          <ArchiveWatchPage
            archive={activeArchive}
            onBack={() => setCurrentTab('archives')}
            onGoToLive={() => handleSelectTab('browse')}
            onArchiveDeleted={(deletedId) => {
              removeArchiveFromState(deletedId);
              setCurrentTab('archives');
            }}
          />
        ) : currentTab === 'watch' ? (
          <WatchPage
            roomId={activeRoomId}
            initialRoom={activeRoom}
            onBackToList={() => setCurrentTab('browse')}
            onGoToBroadcast={() => handleSelectTab('broadcast')}
            allRooms={rooms}
            onSelectRoom={handleSelectRoom}
          />
        ) : currentTab === 'broadcast' ? (
          <BroadcastPage
            roomId={activeRoomId}
            initialRoom={activeRoom}
            onGoToWatch={(id) => handleSelectRoom(id)}
            onGoToArchive={(arcId) => handleSelectArchive(arcId)}
          />
        ) : currentTab === 'dual' ? (
          <DualView roomId={activeRoomId} initialRoom={activeRoom} />
        ) : null}
      </main>

      {/* Floating Live Bar to alert users anywhere on the site when a stream is live */}
      <FloatingLiveBar
        liveRooms={liveRooms}
        currentTab={currentTab as any}
        activeRoomId={activeRoomId}
        onSelectRoom={handleSelectRoom}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Radio className="h-4 w-4 text-rose-500" />
            <span className="font-semibold text-slate-300">LiveStream Platform</span>
            <span>—</span>
            <span>HTML / CSS / JS / TypeScript リアルタイムライブ配信 ＆ アーカイブ再生</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>低遅延WebRTC ＆ 全体リアルタイムWebSocket同期</span>
            </span>
            <span className="flex items-center space-x-1">
              <Heart className="h-3.5 w-3.5 text-rose-400" />
              <span>録画アーカイブ・チャットリプレイ完全同期</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
