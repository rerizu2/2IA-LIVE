import { useState } from 'react';
import { Radio, Eye, Heart, ArrowRight, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { LiveRoom } from './types';

interface FloatingLiveBarProps {
  liveRooms: LiveRoom[];
  currentTab: string;
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
}

export function FloatingLiveBar({
  liveRooms,
  currentTab,
  activeRoomId,
  onSelectRoom,
}: FloatingLiveBarProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Filter out if currently watching this exact room
  const nonWatchedLiveRooms = liveRooms.filter(
    (room) => !(currentTab === 'watch' && room.id === activeRoomId),
  );

  if (nonWatchedLiveRooms.length === 0 || isDismissed) {
    return null;
  }

  const primaryLive = nonWatchedLiveRooms[0];

  return (
    <div
      id="floating-live-bar"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-full transition-all duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl border-2 border-rose-500/80 bg-slate-950/95 p-3.5 shadow-2xl shadow-rose-950/60 backdrop-blur-xl">
        {/* Glow ambient background */}
        <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-rose-600/20 blur-2xl pointer-events-none" />

        {/* Top Mini Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            <span className="text-xs font-black tracking-wider text-rose-400 uppercase">
              LIVE NOW
            </span>
            {nonWatchedLiveRooms.length > 1 && (
              <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-bold text-rose-300 border border-rose-500/30">
                他 {nonWatchedLiveRooms.length - 1}件
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1 text-slate-400">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title={isMinimized ? '展開する' : '最小化する'}
            >
              {isMinimized ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="閉じる"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Main Body */}
        {!isMinimized && (
          <div className="mt-2.5 space-y-3">
            <div className="flex items-center space-x-3">
              {/* Thumbnail / Live Avatar */}
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-900 border border-slate-800">
                {primaryLive.thumbnailUrl ? (
                  <img
                    src={primaryLive.thumbnailUrl}
                    alt={primaryLive.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-rose-950/40 to-slate-900">
                    <Radio className="h-5 w-5 text-rose-500 animate-pulse" />
                  </div>
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-rose-400">
                  LIVE
                </span>
              </div>

              {/* Title & Broadcaster */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-100 truncate hover:text-rose-400 transition-colors">
                  {primaryLive.title}
                </p>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {primaryLive.broadcasterName}
                </p>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1">
                  <span className="flex items-center space-x-0.5 text-slate-300">
                    <Eye className="h-3 w-3 text-slate-400" />
                    <span>{primaryLive.viewerCount}人</span>
                  </span>
                  <span className="flex items-center space-x-0.5 text-rose-400">
                    <Heart className="h-3 w-3 fill-rose-400" />
                    <span>{primaryLive.likes}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Watch Button */}
            <button
              onClick={() => onSelectRoom(primaryLive.id)}
              className="w-full flex items-center justify-center space-x-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 py-2 px-3 text-xs font-bold text-white shadow-md shadow-rose-950/40 hover:from-rose-500 hover:to-pink-500 transition-all active:scale-95"
            >
              <span>今すぐライブを視聴する</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Minimized Bar */}
        {isMinimized && (
          <div
            onClick={() => onSelectRoom(primaryLive.id)}
            className="mt-1 flex cursor-pointer items-center justify-between text-xs text-slate-200 hover:text-white"
          >
            <span className="truncate font-semibold">{primaryLive.title}</span>
            <span className="ml-2 font-bold text-rose-400 text-[11px] shrink-0">
              視聴 →
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
