import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Share2,
  Heart,
  MessageSquare,
  Sparkles,
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Trash2,
  FileText,
  Radio,
  Check,
  Send,
  Video,
} from 'lucide-react';
import type { StreamArchive, ChatMessage } from './types';
import {
  getLocalVideoBlob,
  likeArchive,
  postArchiveComment,
  deleteArchive,
  downloadRecordedVideo,
  downloadChatLogJson,
} from './archiveStorage';

interface ArchiveWatchPageProps {
  archive: StreamArchive;
  onBack: () => void;
  onGoToLive: () => void;
  onArchiveDeleted?: (archiveId: string) => void;
}

export function ArchiveWatchPage({
  archive: initialArchive,
  onBack,
  onGoToLive,
  onArchiveDeleted,
}: ArchiveWatchPageProps) {
  const [archive, setArchive] = useState<StreamArchive>(initialArchive);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localVideoBlob, setLocalVideoBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialArchive.duration || 60);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showDanmaku, setShowDanmaku] = useState(true);
  const [replayMode, setReplayMode] = useState<'sync' | 'all'>('sync');
  const [activeDanmaku, setActiveDanmaku] = useState<{ id: string; text: string; top: number; color?: string }[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Load recorded video from IndexedDB if available
  useEffect(() => {
    let active = true;
    async function loadLocalBlob() {
      const blob = await getLocalVideoBlob(initialArchive.id);
      if (blob && active) {
        setLocalVideoBlob(blob);
        const url = URL.createObjectURL(blob);
        setLocalVideoUrl(url);
      }
    }
    loadLocalBlob();

    return () => {
      active = false;
      if (localVideoUrl) {
        URL.revokeObjectURL(localVideoUrl);
      }
    };
  }, [initialArchive.id]);

  const effectiveVideoSrc = localVideoUrl || archive.videoUrl || null;

  // Track video progress
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  // Chat replay filtering based on timestamp
  // If replayMode is 'sync', show only comments whose offset relative to archive.startedAt is <= currentTime
  const visibleComments = archive.comments.filter((c) => {
    if (replayMode === 'all') return true;
    const offsetSec = Math.max(0, (c.timestamp - archive.startedAt) / 1000);
    // Show if comment happened at or before currentTime (or if negative/init, always show)
    return offsetSec <= currentTime;
  });

  // Danmaku comments triggered around currentTime
  useEffect(() => {
    if (!showDanmaku || !isPlaying) return;

    // Find comments that occurred within the last 1.5 seconds of currentTime
    const currentSecond = Math.floor(currentTime);
    const triggered = archive.comments.filter((c) => {
      const offsetSec = Math.max(0, (c.timestamp - archive.startedAt) / 1000);
      return Math.abs(offsetSec - currentSecond) < 1;
    });

    if (triggered.length > 0) {
      const newItems = triggered.map((c, idx) => ({
        id: `${c.id}-${currentTime}-${idx}`,
        text: c.text,
        top: 15 + ((idx * 28 + (currentSecond % 4) * 20) % 70),
        color: c.color || (c.isSuperChat ? '#f59e0b' : '#ffffff'),
      }));

      setActiveDanmaku((prev) => [...prev.slice(-15), ...newItems]);

      const timer = setTimeout(() => {
        setActiveDanmaku((prev) => prev.filter((item) => !newItems.some((n) => n.id === item.id)));
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [Math.floor(currentTime), showDanmaku, isPlaying, archive.comments, archive.startedAt]);

  // Auto-scroll chat replay list
  useEffect(() => {
    if (replayMode === 'sync') {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleComments.length, replayMode]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      // Slideshow simulation if no video src
      setIsPlaying(!isPlaying);
    }
  };

  // Simulate progress timer if no video element
  useEffect(() => {
    if (!effectiveVideoSrc && isPlaying) {
      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackRate);
      return () => clearInterval(interval);
    }
  }, [effectiveVideoSrc, isPlaying, duration, playbackRate]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    setCurrentTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleLike = async () => {
    if (isLiked) return;
    setIsLiked(true);
    setArchive((prev) => ({ ...prev, likes: prev.likes + 1 }));
    await likeArchive(archive.id);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    const added = await postArchiveComment(archive.id, {
      text: newCommentText.trim(),
      senderName: 'あなた (アーカイブ視聴)',
      color: '#38bdf8',
    });

    if (added) {
      setArchive((prev) => ({
        ...prev,
        comments: [...prev.comments, added],
      }));
      setNewCommentText('');
    }
  };

  const handleDelete = async () => {
    await deleteArchive(archive.id);
    onArchiveDeleted?.(archive.id);
    onBack();
  };

  const formatTime = (secs: number) => {
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-400" />
          <span>アーカイブ一覧へ戻る</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={onGoToLive}
            className="flex items-center space-x-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 px-3 py-1.5 text-xs font-bold text-rose-300 transition-colors"
          >
            <Radio className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
            <span>現在配信中のライブを見る</span>
          </button>
        </div>
      </div>

      {/* Main Player & Chat Replay Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Video Player & Metadata */}
        <div className="lg:col-span-2 space-y-4">
          {/* Player Container */}
          <div
            ref={containerRef}
            className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl border border-slate-800 flex items-center justify-center select-none"
          >
            {effectiveVideoSrc ? (
              <video
                ref={videoRef}
                src={effectiveVideoSrc}
                poster={archive.thumbnailUrl}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                className="h-full w-full object-contain cursor-pointer"
                onClick={togglePlay}
                playsInline
              />
            ) : (
              <div
                onClick={togglePlay}
                className="relative h-full w-full cursor-pointer overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950"
              >
                {archive.thumbnailUrl ? (
                  <img
                    src={archive.thumbnailUrl}
                    alt={archive.title}
                    className="absolute inset-0 h-full w-full object-cover opacity-60 filter blur-sm"
                  />
                ) : null}
                <div className="relative z-10 text-center p-6 space-y-3 bg-black/60 rounded-2xl backdrop-blur-md max-w-md border border-slate-700">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600/30 border border-indigo-400/40 text-indigo-300">
                    <Video className="h-8 w-8" />
                  </div>
                  <h3 className="text-base font-bold text-white">アーカイブ録画再生中</h3>
                  <p className="text-xs text-slate-300">
                    配信時のフレームスナップショットとチャットリプレイを完全同期で再生しています
                  </p>
                  <div className="text-xs font-mono text-indigo-300 bg-indigo-950/60 py-1 px-3 rounded-full inline-block border border-indigo-500/30">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
              </div>
            )}

            {/* Danmaku Comment Overlay */}
            {showDanmaku && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
                {activeDanmaku.map((item) => (
                  <div
                    key={item.id}
                    className="absolute whitespace-nowrap text-lg sm:text-2xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-danmaku font-sans tracking-wide"
                    style={{
                      top: `${item.top}%`,
                      color: item.color || '#ffffff',
                    }}
                  >
                    {item.text}
                  </div>
                ))}
              </div>
            )}

            {/* VOD Badge overlay */}
            <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
              <span className="rounded-md bg-slate-900/90 border border-slate-700 px-2.5 py-1 text-xs font-bold text-slate-200 backdrop-blur-md shadow-lg flex items-center space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                <span>ARCHIVE (録画)</span>
              </span>
              <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-mono text-slate-300 backdrop-blur-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Big Play Button Overlay on Pause */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute z-20 flex h-20 w-20 items-center justify-center rounded-full bg-rose-600/90 hover:bg-rose-500 text-white shadow-2xl backdrop-blur-md transition-transform hover:scale-110 active:scale-95 border-2 border-white/20"
              >
                <Play className="h-8 w-8 fill-white translate-x-0.5" />
              </button>
            )}

            {/* Video Controls Bar */}
            <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 transition-opacity duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              {/* Progress Slider */}
              <div className="relative mb-3 flex items-center">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-slate-700 accent-rose-500 hover:h-2.5 transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-white">
                {/* Left Controls */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white" />}
                  </button>

                  <button
                    onClick={() => {
                      if (videoRef.current) videoRef.current.currentTime = Math.max(0, currentTime - 10);
                      else setCurrentTime((prev) => Math.max(0, prev - 10));
                    }}
                    className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white"
                    title="10秒戻る"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center space-x-1.5 group/vol">
                    <button
                      onClick={toggleMute}
                      className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-white"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 appearance-none rounded bg-slate-600 accent-white"
                    />
                  </div>

                  <span className="text-xs font-mono text-slate-300">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right Controls */}
                <div className="flex items-center space-x-2">
                  {/* Danmaku Toggle */}
                  <button
                    onClick={() => setShowDanmaku(!showDanmaku)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors ${
                      showDanmaku
                        ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 line-through'
                    }`}
                    title="弾幕コメントの表示切替"
                  >
                    弾幕
                  </button>

                  {/* Speed Selector */}
                  <div className="relative flex items-center space-x-1 text-xs bg-slate-800/80 rounded-lg px-2 py-1 border border-slate-700">
                    {[1, 1.25, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`px-1 py-0.5 rounded ${
                          playbackRate === s ? 'bg-indigo-600 font-bold text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white"
                  >
                    <Maximize className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Archive Info Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-300 border border-indigo-500/30">
                    {archive.category}
                  </span>
                  {archive.hasRecordedVideo && (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                      高画質録画あり
                    </span>
                  )}
                  <span className="flex items-center space-x-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    <span>録画時間: {formatTime(archive.duration)}</span>
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {archive.title}
                </h1>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleLike}
                  className={`flex items-center space-x-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
                    isLiked
                      ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-950/50'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isLiked ? 'fill-white' : 'text-rose-400'}`} />
                  <span>{archive.likes}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center space-x-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors"
                  title="リンクをコピー"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Share2 className="h-4 w-4" />}
                  <span>{copiedLink ? 'コピー済' : '共有'}</span>
                </button>

                {localVideoBlob ? (
                  <button
                    onClick={() => downloadRecordedVideo(localVideoBlob, archive.title)}
                    className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 text-xs font-bold shadow-md transition-all active:scale-95"
                    title="録画ビデオをダウンロード"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">動画DL</span>
                  </button>
                ) : null}

                <button
                  onClick={() => downloadChatLogJson(archive)}
                  className="flex items-center space-x-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors"
                  title="チャットログ(JSON)をダウンロード"
                >
                  <FileText className="h-4 w-4 text-amber-400" />
                  <span className="hidden sm:inline">ログDL</span>
                </button>

                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="アーカイブを削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Broadcaster Bar */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
              <div className="flex items-center space-x-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-sm font-bold text-white shadow-md">
                  {archive.broadcasterName.slice(0, 1)}
                </div>
                <div>
                  <div className="font-bold text-slate-200">{archive.broadcasterName}</div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(archive.startedAt).toLocaleString('ja-JP')} 配信</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-slate-400">
                <span className="flex items-center space-x-1">
                  <Eye className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{archive.views} 回再生</span>
                </span>
                <span className="flex items-center space-x-1">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{archive.comments.length} コメント</span>
                </span>
              </div>
            </div>

            {/* Tags */}
            {archive.tags && archive.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {archive.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-lg bg-slate-800/90 px-2.5 py-1 text-[11px] font-medium text-slate-300 border border-slate-700/60"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Synchronized Chat Replay Panel */}
        <div className="flex flex-col h-[650px] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-800 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="rounded-lg bg-indigo-500/20 p-1.5 text-indigo-400 border border-indigo-500/30">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">チャットリプレイ</h3>
                  <p className="text-[11px] text-slate-400">
                    {visibleComments.length} / {archive.comments.length} 件表示中
                  </p>
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
                <button
                  onClick={() => setReplayMode('sync')}
                  className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                    replayMode === 'sync' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  同期再生
                </button>
                <button
                  onClick={() => setReplayMode('all')}
                  className={`rounded-md px-2 py-1 font-semibold transition-colors ${
                    replayMode === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  全件表示
                </button>
              </div>
            </div>

            {archive.superChats && archive.superChats.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto py-1 text-[11px] no-scrollbar">
                <span className="font-bold text-amber-400">スパチャ:</span>
                {archive.superChats.map((sc, idx) => (
                  <span
                    key={idx}
                    className="flex-shrink-0 rounded-full px-2 py-0.5 font-bold text-white shadow-sm"
                    style={{ backgroundColor: sc.color || '#f59e0b' }}
                  >
                    ¥{sc.amount.toLocaleString()} ({sc.senderName})
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Comments Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {visibleComments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <Clock className="h-8 w-8 text-slate-600 animate-pulse" />
                <p className="text-xs">再生を進めると当時のコメントが表示されます</p>
                <button
                  onClick={() => setReplayMode('all')}
                  className="text-xs text-indigo-400 hover:underline font-semibold"
                >
                  全コメントを今すぐ見る
                </button>
              </div>
            ) : (
              visibleComments.map((msg) => {
                const commentOffsetSec = Math.max(0, (msg.timestamp - archive.startedAt) / 1000);
                const isRecent = Math.abs(commentOffsetSec - currentTime) < 2;

                return (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-2.5 text-xs transition-all duration-300 ${
                      msg.isSuperChat
                        ? 'bg-amber-950/40 border border-amber-500/40 shadow-sm'
                        : isRecent
                        ? 'bg-indigo-950/40 border border-indigo-500/30'
                        : 'bg-slate-950/60 border border-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="font-bold truncate max-w-[120px]"
                          style={{ color: msg.color || '#94a3b8' }}
                        >
                          {msg.senderName}
                        </span>
                        {msg.isBroadcaster && (
                          <span className="rounded bg-rose-600 px-1 py-0.2 text-[9px] font-black text-white">
                            配信者
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">
                        {formatTime(commentOffsetSec)}
                      </span>
                    </div>

                    {msg.isSuperChat && msg.amount && (
                      <div className="mb-1 inline-block rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-500/30">
                        スーパーチャット ¥{msg.amount.toLocaleString()}
                      </div>
                    )}

                    <p className="text-slate-200 break-words leading-relaxed">{msg.text}</p>
                  </div>
                );
              })
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Add VOD Comment Form */}
          <form onSubmit={handleAddComment} className="border-t border-slate-800 p-3 bg-slate-950/90">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="アーカイブにコメントを追加..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">アーカイブを削除しますか？</h3>
            <p className="text-xs text-slate-300">
              『{archive.title}』の録画データおよびチャット履歴が完全に削除されます。この操作は元に戻せません。
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-slate-300"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
