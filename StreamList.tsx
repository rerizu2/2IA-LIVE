import { useState } from 'react';
import { Radio, Eye, Heart, Sparkles, Search, PlusCircle, Play, Flame, Film } from 'lucide-react';
import type { LiveRoom } from './types';

interface StreamListProps {
  rooms: LiveRoom[];
  onSelectRoom: (roomId: string) => void;
  onGoToBroadcast: () => void;
  onGoToArchives?: () => void;
}

const CATEGORIES = [
  'すべて',
  '雑談・トーク',
  'ゲーム配信',
  '音楽・歌ってみた',
  'プログラミング・作業',
  '料理・日常',
];

export function StreamList({
  rooms,
  onSelectRoom,
  onGoToBroadcast,
  onGoToArchives,
}: StreamListProps) {
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [searchQuery, setSearchQuery] = useState('');

  // Only display rooms where someone is actively broadcasting!
  const liveRooms = rooms.filter((r) => r.isLive);
  const primaryLive = liveRooms[0] || null;

  const filteredRooms = liveRooms.filter((room) => {
    const matchesCategory =
      selectedCategory === 'すべて' || room.category === selectedCategory;
    const matchesSearch =
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.broadcasterName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div id="stream-list-container" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Hero Banner with Live Dynamic Status */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-rose-950 p-6 sm:p-8 border border-slate-800 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          {liveRooms.length > 0 ? (
            <div className="inline-flex items-center space-x-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-300 border border-rose-500/40 shadow-sm animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>現在 {liveRooms.length}件のライブがリアルタイム配信中！</span>
            </div>
          ) : (
            <div className="inline-flex items-center space-x-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700">
              <Radio className="h-3.5 w-3.5 text-slate-400" />
              <span>現在配信中のライブはありません</span>
            </div>
          )}

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {primaryLive
              ? `🔴 【${primaryLive.broadcasterName}】がライブ配信中！`
              : '現在配信中のライブはありません'}
          </h1>

          <p className="text-sm text-slate-300">
            {primaryLive
              ? `『${primaryLive.title}』に今すぐ参加して、リアルタイム映像・チャット・弾幕・スパチャで盛り上がりましょう！`
              : '現在ライブ配信を行っているユーザーはいません。配信スタジオからWebカメラや画面共有を使って、今すぐ誰でも配信を始められます。'}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            {primaryLive ? (
              <button
                id="hero-watch-live-btn"
                onClick={() => onSelectRoom(primaryLive.id)}
                className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-950/60 hover:from-rose-500 hover:to-pink-500 transition-all active:scale-95"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>配信中のライブに参加する</span>
                <span className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
                  {primaryLive.viewerCount}人視聴中
                </span>
              </button>
            ) : null}

            <button
              id="hero-go-live-btn"
              onClick={onGoToBroadcast}
              className="flex items-center space-x-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-950/50 transition-all active:scale-95"
            >
              <Radio className="h-4 w-4 text-white" />
              <span>配信を始める</span>
            </button>

            {onGoToArchives && (
              <button
                id="hero-archives-btn"
                onClick={onGoToArchives}
                className="flex items-center space-x-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 px-4 py-2.5 text-sm font-semibold text-purple-200 transition-colors"
              >
                <Film className="h-4 w-4 text-purple-400" />
                <span>過去のアーカイブを見る</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-rose-600/20 blur-3xl" />
        <div className="absolute -right-32 -bottom-32 h-64 w-64 rounded-full bg-indigo-600/25 blur-3xl" />
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Category Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/50'
                  : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            id="stream-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="配信・配信者を検索..."
            className="w-full rounded-xl bg-slate-900 py-1.5 pl-9 pr-4 text-xs text-slate-100 placeholder-slate-500 border border-slate-800 focus:border-rose-500 outline-none"
          />
        </div>
      </div>

      {/* All Streams Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-slate-200">
          配信中のライブ一覧
        </h2>
        <span className="text-xs text-slate-500">
          {filteredRooms.length} 件を表示中
        </span>
      </div>

      {/* Stream Cards Grid */}
      {filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-900/50 p-12 text-center border border-slate-800">
          <Radio className="h-12 w-12 text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-300">
            現在配信中のライブはありません
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            誰も配信を行っていません。配信スタジオから配信を開始すると、リアルタイムでここに表示されます。
          </p>
          <button
            onClick={onGoToBroadcast}
            className="mt-4 flex items-center space-x-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-rose-500 transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            <span>配信を始める</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className="group cursor-pointer rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-rose-500/60 hover:border-rose-400 overflow-hidden shadow-xl shadow-rose-950/20 transition-all duration-300 hover:-translate-y-1.5"
            >
              {/* Glowing live indicator accent */}
              <div className="h-1 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500" />

              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                {room.thumbnailUrl ? (
                  <img
                    src={room.thumbnailUrl}
                    alt={room.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-tr from-slate-950 via-slate-900 to-rose-950 p-4 text-center">
                    <Radio className="h-10 w-10 text-rose-500 mb-2 opacity-90 group-hover:scale-110 transition-transform animate-pulse" />
                    <span className="text-xs text-rose-300 font-semibold">
                      {room.broadcasterName} が配信中
                    </span>
                  </div>
                )}

                {/* Top Overlay Badges */}
                <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5 z-10">
                  <span className="flex items-center space-x-1 rounded bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white shadow-md animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    <span>LIVE</span>
                  </span>
                  <span className="rounded bg-slate-900/85 px-2 py-0.5 text-[10px] font-semibold text-slate-200 backdrop-blur-xs border border-slate-700/50">
                    {room.category}
                  </span>
                </div>

                {/* Viewer Count & Likes */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center space-x-2 text-[11px] text-white bg-black/75 backdrop-blur-xs px-2.5 py-0.5 rounded-md border border-white/10">
                  <span className="flex items-center space-x-1">
                    <Eye className="h-3 w-3 text-slate-300" />
                    <span className="font-bold">{room.viewerCount}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Heart className="h-3 w-3 text-rose-400 fill-rose-400" />
                    <span>{room.likes}</span>
                  </span>
                </div>
              </div>

              {/* Card Meta */}
              <div className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-pink-600 font-bold text-sm text-white shadow-md">
                    {room.broadcasterName.slice(0, 1)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-rose-400 transition-colors line-clamp-1">
                      {room.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {room.broadcasterName}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-xs">
                  <span className="flex items-center space-x-1 text-rose-400 font-medium">
                    <Flame className="h-3.5 w-3.5" />
                    <span>今すぐ視聴可能</span>
                  </span>
                  <span className="font-bold text-rose-400 group-hover:translate-x-0.5 transition-transform">
                    配信に参加する →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
