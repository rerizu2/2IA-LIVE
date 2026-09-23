import { useState } from 'react';
import {
  Film,
  Play,
  Heart,
  Eye,
  MessageSquare,
  Clock,
  Calendar,
  Search,
  Radio,
  Download,
  Sparkles,
  Layers,
  ArrowUpDown,
} from 'lucide-react';
import type { StreamArchive } from './types';

interface ArchiveListProps {
  archives: StreamArchive[];
  onSelectArchive: (archiveId: string) => void;
  onGoToBroadcast: () => void;
  onGoToLiveBrowse: () => void;
}

const CATEGORIES = [
  'すべて',
  '雑談・トーク',
  'ゲーム配信',
  '音楽・歌ってみた',
  'プログラミング・作業',
  '料理・日常',
];

export function ArchiveList({
  archives,
  onSelectArchive,
  onGoToBroadcast,
  onGoToLiveBrowse,
}: ArchiveListProps) {
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'views' | 'likes' | 'duration'>('newest');

  const filteredArchives = archives
    .filter((a) => {
      const matchCat = selectedCategory === 'すべて' || a.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        a.title.toLowerCase().includes(q) ||
        a.broadcasterName.toLowerCase().includes(q) ||
        (a.tags && a.tags.some((t) => t.toLowerCase().includes(q)));
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return b.createdAt - a.createdAt;
      if (sortBy === 'views') return b.views - a.views;
      if (sortBy === 'likes') return b.likes - a.likes;
      if (sortBy === 'duration') return b.duration - a.duration;
      return 0;
    });

  const formatDuration = (secs: number) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h > 0) {
      return `${h}:${remM.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
    }
    return `${remM.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-6 sm:p-8 border border-slate-800 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
            <Film className="h-3.5 w-3.5 text-indigo-400" />
            <span>過去のライブ配信アーカイブ ＆ チャットリプレイ</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            配信を見逃しても大丈夫！アーカイブで全編フル再生
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            配信終了後の生放送映像、当時のリアルタイムコメント、弾幕、スーパーチャットをタイムラインに合わせて完全同期リプレイ。
            配信者は配信終了時に自動的に録画をアーカイブとして保存できます。
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onGoToLiveBrowse}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950/50 transition-all active:scale-95"
            >
              <Radio className="h-4 w-4 text-white animate-pulse" />
              <span>現在ライブ中の配信を見る</span>
            </button>

            <button
              onClick={onGoToBroadcast}
              className="flex items-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors"
            >
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>自分で配信してアーカイブを残す</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="アーカイブのタイトル、配信者、タグで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Sort Switcher */}
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-500" />
            <span>並び替え:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="newest">最新の配信順</option>
              <option value="views">再生回数が多い順</option>
              <option value="likes">いいねが多い順</option>
              <option value="duration">録画時間が長い順</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Archives Grid */}
      {filteredArchives.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-4">
          <Film className="mx-auto h-12 w-12 text-slate-600" />
          <h3 className="text-base font-bold text-white">該当するアーカイブが見つかりません</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            条件を変えて再検索するか、新しい配信を行ってアーカイブを残してみましょう。
          </p>
          <button
            onClick={() => {
              setSelectedCategory('すべて');
              setSearchQuery('');
            }}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-200"
          >
            フィルターをリセット
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredArchives.map((archive) => (
            <div
              key={archive.id}
              onClick={() => onSelectArchive(archive.id)}
              className="group cursor-pointer rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-lg hover:shadow-2xl hover:border-indigo-500/50 transition-all duration-200 hover:-translate-y-1 flex flex-col"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                {archive.thumbnailUrl ? (
                  <img
                    src={archive.thumbnailUrl}
                    alt={archive.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-950 text-slate-500">
                    <Film className="h-10 w-10 text-indigo-400/40" />
                  </div>
                )}

                {/* Duration Badge */}
                <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-mono font-bold text-white backdrop-blur-sm">
                  {formatDuration(archive.duration)}
                </div>

                {/* Top Badges */}
                <div className="absolute top-2.5 left-2.5 flex items-center space-x-1.5">
                  <span className="rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
                    {archive.category}
                  </span>
                  {archive.hasRecordedVideo && (
                    <span className="rounded-md bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">
                      録画あり
                    </span>
                  )}
                </div>

                {/* Play Hover Overlay */}
                <div className="absolute inset-0 bg-indigo-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="h-6 w-6 fill-white translate-x-0.5" />
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="line-clamp-2 text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors leading-snug">
                    {archive.title}
                  </h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <span className="font-semibold text-slate-300 truncate max-w-[140px]">
                      {archive.broadcasterName}
                    </span>
                    <span>•</span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(archive.startedAt).toLocaleDateString('ja-JP')}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {archive.tags && archive.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {archive.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Bottom Stats */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Eye className="h-3 w-3 text-indigo-400" />
                      <span>{archive.views} 回</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Heart className="h-3 w-3 text-rose-400" />
                      <span>{archive.likes}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <MessageSquare className="h-3 w-3 text-emerald-400" />
                      <span>{archive.comments.length}</span>
                    </span>
                  </div>

                  <span className="text-indigo-400 font-semibold text-[10px] group-hover:underline">
                    再生する →
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
