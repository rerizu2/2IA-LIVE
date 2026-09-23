import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Monitor,
  Sparkles,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
  Clock,
  Eye,
  Heart,
  Settings,
  AlertCircle,
  ExternalLink,
  Tv,
  Columns,
  Layers,
  CheckCircle2,
  Tag,
  Wand2,
  Film,
  Download,
  Check,
  X,
} from 'lucide-react';
import { useMediaStream, type StreamSourceType } from './useMediaStream';
import { useStreamRecorder } from './useStreamRecorder';
import { saveArchive, downloadRecordedVideo } from './archiveStorage';
import { ChatPanel } from './ChatPanel';
import { ViewerPlayer } from './ViewerPlayer';
import type { LiveRoom, ChatMessage, LiveReaction, StreamArchive } from './types';

interface BroadcasterStudioProps {
  roomId?: string;
  room: LiveRoom | null;
  comments: ChatMessage[];
  reactions?: LiveReaction[];
  viewerCount: number;
  likes: number;
  isSocketConnected: boolean;
  onSendMessage: (text: string, isSuperChat?: boolean, amount?: number, color?: string) => void;
  onSendReaction: (emoji: string) => void;
  onSendLike?: () => void;
  onSendStreamFrame: (frameData: string) => void;
  onUpdateStreamInfo: (title?: string, category?: string, isLive?: boolean) => void;
  onStreamReady?: (stream: MediaStream | null) => void;
  currentUserName: string;
  onChangeUserName: (name: string) => void;
  onGoToWatch?: (roomId: string) => void;
  onGoToArchive?: (archiveId: string) => void;
}

const PRESET_TITLES = [
  '🔴 【初配信】みんなで楽しく雑談中！初見さん大歓迎',
  '🎮 まったりゲーム実況プレイ！クリア目指して挑戦',
  '💻 作業用BGM＆プログラミング集中生配信',
  '☕ 質問・お悩み相談歓迎！まったりおしゃべり枠',
  '🎵 音楽・歌ってみた＆リクエスト受付配信！',
];

const CATEGORIES = [
  '雑談・トーク',
  'ゲーム配信',
  '音楽・歌ってみた',
  'プログラミング・作業',
  '料理・日常',
];

export function BroadcasterStudio({
  roomId = 'main-stream',
  room,
  comments,
  reactions = [],
  viewerCount,
  likes,
  isSocketConnected,
  onSendMessage,
  onSendReaction,
  onSendLike = () => {},
  onSendStreamFrame,
  onUpdateStreamInfo,
  onStreamReady,
  currentUserName,
  onChangeUserName,
  onGoToWatch,
  onGoToArchive,
}: BroadcasterStudioProps) {
  const {
    stream,
    sourceType,
    isVideoMuted,
    isAudioMuted,
    audioLevel,
    error: mediaError,
    isLoading: isMediaLoading,
    isIframe,
    startCameraStream,
    startScreenStream,
    startVirtualStream,
    toggleVideo,
    toggleAudio,
    clearError,
    captureFrame,
  } = useMediaStream();

  const {
    isRecording,
    recordedDuration,
    startRecording,
    stopRecording,
    resetRecording,
  } = useStreamRecorder();

  const [isBroadcasting, setIsBroadcasting] = useState(true);
  const [streamTitle, setStreamTitle] = useState(room?.title || '新着ライブ配信');
  const [streamCategory, setStreamCategory] = useState(room?.category || '雑談・トーク');
  const [broadcastDuration, setBroadcastDuration] = useState(0);
  const [titleSavedToast, setTitleSavedToast] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState<string | null>(null);

  // Archive recording state
  const [autoRecord, setAutoRecord] = useState(true);
  const [savedArchive, setSavedArchive] = useState<StreamArchive | null>(null);
  const [savedVideoBlob, setSavedVideoBlob] = useState<Blob | null>(null);
  const [showArchiveSavedModal, setShowArchiveSavedModal] = useState(false);
  const [isSavingArchive, setIsSavingArchive] = useState(false);

  // Monitor Display Mode: 'studio' (Standard studio view), 'live' (Viewer POV player with danmaku), 'split' (both side by side)
  const [monitorMode, setMonitorMode] = useState<'studio' | 'live' | 'split'>('studio');
  const [showPip, setShowPip] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const splitVideoRef = useRef<HTMLVideoElement>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize virtual stream on mount
  useEffect(() => {
    startVirtualStream();
  }, [startVirtualStream]);

  // Sync title from room if room changes and title is not touched yet
  useEffect(() => {
    if (room?.title && !streamTitle) {
      setStreamTitle(room.title);
    }
  }, [room?.title]);

  // Pass stream to parent (for WebRTC tracks)
  useEffect(() => {
    onStreamReady?.(stream);
  }, [stream, onStreamReady]);

  // Attach local stream to video monitor and guarantee play()
  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch((e) => {
        console.warn('Local preview video.play() notice:', e);
      });
    }
    if (splitVideoRef.current && stream) {
      splitVideoRef.current.srcObject = stream;
      splitVideoRef.current.play().catch((e) => {
        console.warn('Split preview video.play() notice:', e);
      });
    }
  }, [stream, monitorMode]);

  // Broadcast duration timer
  useEffect(() => {
    if (isBroadcasting) {
      durationTimerRef.current = setInterval(() => {
        setBroadcastDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      setBroadcastDuration(0);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [isBroadcasting]);

  // High-frequency frame grabber (sends snapshot to viewers every 150ms for smooth live motion fallback + real-time thumbnail)
  useEffect(() => {
    if (!isBroadcasting) return;

    const interval = setInterval(() => {
      const activeVideo = monitorMode === 'split' ? splitVideoRef.current : localVideoRef.current;
      const frame = captureFrame(activeVideo || localVideoRef.current);
      if (frame) {
        setLatestSnapshot(frame);
        onSendStreamFrame(frame);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isBroadcasting, captureFrame, onSendStreamFrame, monitorMode]);

  // Auto-record stream when broadcasting
  useEffect(() => {
    if (isBroadcasting && stream && autoRecord && !isRecording) {
      startRecording(stream);
    }
  }, [isBroadcasting, stream, autoRecord, isRecording, startRecording]);

  const handleStartBroadcast = () => {
    setIsBroadcasting(true);
    onUpdateStreamInfo(streamTitle, streamCategory, true);
    if (stream && autoRecord && !isRecording) {
      startRecording(stream);
    }
  };

  const handleStopBroadcast = async () => {
    setIsBroadcasting(false);
    onUpdateStreamInfo(undefined, undefined, false);

    setIsSavingArchive(true);
    try {
      const blob = await stopRecording();
      setSavedVideoBlob(blob);
      const currentDuration = Math.max(5, broadcastDuration);
      const archiveId = `archive-${Date.now().toString(36)}-${roomId.slice(-6)}`;

      const newArchive: StreamArchive = {
        id: archiveId,
        roomId,
        title: streamTitle || '配信アーカイブ',
        broadcasterName: currentUserName,
        category: streamCategory,
        tags: ['生配信', streamCategory],
        startedAt: Date.now() - currentDuration * 1000,
        endedAt: Date.now(),
        duration: currentDuration,
        views: Math.max(viewerCount, 1),
        likes,
        thumbnailUrl: latestSnapshot || undefined,
        hasRecordedVideo: !!blob,
        comments: [...comments],
        superChats: comments
          .filter((c) => c.isSuperChat && c.amount)
          .map((c) => ({
            amount: c.amount || 0,
            senderName: c.senderName,
            text: c.text,
            color: c.color || '#e11d48',
          })),
        reactionsCount: Math.round(likes * 1.2),
        createdAt: Date.now(),
      };

      const saved = await saveArchive(newArchive, blob || undefined);
      setSavedArchive(saved);
      setShowArchiveSavedModal(true);
    } catch (err) {
      console.error('Failed to save archive:', err);
    } finally {
      setIsSavingArchive(false);
    }
  };

  // Manual archive save
  const handleManualSaveArchive = async () => {
    setIsSavingArchive(true);
    try {
      const activeVideo = monitorMode === 'split' ? splitVideoRef.current : localVideoRef.current;
      const snap = captureFrame(activeVideo || localVideoRef.current) || latestSnapshot;
      const currentDuration = Math.max(5, broadcastDuration);
      const archiveId = `archive-${Date.now().toString(36)}-${roomId.slice(-6)}`;

      const newArchive: StreamArchive = {
        id: archiveId,
        roomId,
        title: streamTitle || '配信アーカイブ',
        broadcasterName: currentUserName,
        category: streamCategory,
        tags: ['生配信', streamCategory],
        startedAt: Date.now() - currentDuration * 1000,
        endedAt: Date.now(),
        duration: currentDuration,
        views: Math.max(viewerCount, 1),
        likes,
        thumbnailUrl: snap || undefined,
        hasRecordedVideo: !!recordedDuration,
        comments: [...comments],
        superChats: comments
          .filter((c) => c.isSuperChat && c.amount)
          .map((c) => ({
            amount: c.amount || 0,
            senderName: c.senderName,
            text: c.text,
            color: c.color || '#e11d48',
          })),
        reactionsCount: Math.round(likes * 1.2),
        createdAt: Date.now(),
      };

      const saved = await saveArchive(newArchive);
      setSavedArchive(saved);
      setShowArchiveSavedModal(true);
    } catch (err) {
      console.error('Failed to save archive:', err);
    } finally {
      setIsSavingArchive(false);
    }
  };

  const handleApplyTitle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!streamTitle.trim()) return;
    onUpdateStreamInfo(streamTitle, streamCategory, isBroadcasting);
    setTitleSavedToast(true);
    setTimeout(() => setTitleSavedToast(false), 2500);
  };

  const handleSelectPreset = (preset: string) => {
    setStreamTitle(preset);
    onUpdateStreamInfo(preset, streamCategory, isBroadcasting);
    setTitleSavedToast(true);
    setTimeout(() => setTitleSavedToast(false), 2000);
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div id="broadcaster-studio" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Studio Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
            <h1 className="text-xl font-bold text-slate-100">ライブ配信スタジオ</h1>
            <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/30">
              STUDIO
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            タイトルを入力して配信を開始できます。自分自身でもリアルタイムに本番ライブ画面を確認できます。
          </p>
        </div>

        {/* Top Actions: View Own Live on Watch Page + Go Live Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Archive Recording Toggle */}
          <div className="flex items-center space-x-1.5 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs">
            <Film className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-slate-300 font-medium hidden sm:inline">アーカイブ録画:</span>
            <button
              type="button"
              onClick={() => setAutoRecord(!autoRecord)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                autoRecord
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {autoRecord ? (isRecording ? `録画中 (${formatDuration(recordedDuration)}) ●` : 'ON (自動保存)') : 'OFF'}
            </button>
          </div>

          {isBroadcasting && (
            <button
              type="button"
              onClick={handleManualSaveArchive}
              disabled={isSavingArchive}
              className="flex items-center space-x-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-500/40 px-3 py-2 text-xs font-semibold text-indigo-300 hover:text-white transition-all shadow-md"
              title="現在の配信状況をアーカイブとして即時保存"
            >
              <Film className="h-3.5 w-3.5 text-indigo-400" />
              <span>アーカイブ保存</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.open(window.location.href, '_blank')}
            className="flex items-center space-x-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-md"
            title="別ウィンドウでフルアクセスで開く（カメラ・画面共有に最適）"
          >
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">新しいタブで開く</span>
          </button>

          {onGoToWatch && (
            <button
              id="view-live-watchpage-btn"
              onClick={() => onGoToWatch(roomId)}
              className="flex items-center space-x-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-indigo-500/40 hover:border-indigo-400 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:text-white transition-all shadow-md"
              title="視聴者と同じフル画面プレイヤーで実際のライブを見る"
            >
              <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
              <span>視聴ページで本番を確認</span>
            </button>
          )}

          {isBroadcasting ? (
            <button
              id="stop-broadcast-btn"
              onClick={handleStopBroadcast}
              disabled={isSavingArchive}
              className="flex items-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-rose-500/50 px-4 py-2 text-sm font-bold text-rose-400 transition-all active:scale-95 shadow-lg disabled:opacity-50"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>{isSavingArchive ? 'アーカイブ保存中...' : '配信を終了する'}</span>
            </button>
          ) : (
            <button
              id="start-broadcast-btn"
              onClick={handleStartBroadcast}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 px-5 py-2 text-sm font-bold text-white shadow-xl shadow-rose-950/60 hover:from-rose-500 hover:to-pink-500 transition-all active:scale-95"
            >
              <Radio className="h-4 w-4" />
              <span>このタイトルで配信を開始する</span>
            </button>
          )}
        </div>
      </div>

      {/* Feature 1: Prominent Title & Settings Card (Requested by User) */}
      <div className="mb-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-5 border-2 border-indigo-500/40 shadow-xl shadow-indigo-950/30">
        <form onSubmit={handleApplyTitle} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-slate-100">
                配信タイトル＆カテゴリー設定
              </h2>
              <span className="text-[11px] text-slate-400">
                （入力したタイトルはサイト全体とリスナーに即時反映されます）
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {titleSavedToast && (
                <span className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold animate-pulse">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>タイトルを反映しました！</span>
                </span>
              )}

              <button
                type="submit"
                id="apply-title-btn"
                className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <span>タイトルを更新・反映</span>
              </button>
            </div>
          </div>

          {/* Title & Category Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3 space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="studio-title-input" className="text-xs font-semibold text-slate-300">
                  配信タイトル <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {streamTitle.length} / 80文字
                </span>
              </div>
              <input
                id="studio-title-input"
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                maxLength={80}
                placeholder="例: 🔴 【初配信】みんなで楽しく雑談中！初見さん大歓迎"
                className="w-full rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white border border-slate-700 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="studio-category-select" className="text-xs font-semibold text-slate-300">
                配信カテゴリー
              </label>
              <select
                id="studio-category-select"
                value={streamCategory}
                onChange={(e) => setStreamCategory(e.target.value)}
                className="w-full rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-medium text-white border border-slate-700 focus:border-indigo-400 outline-none transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Preset Title Suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="flex items-center space-x-1 text-slate-400 text-[11px] mr-1">
              <Wand2 className="h-3 w-3 text-amber-400" />
              <span>おすすめタイトル例:</span>
            </span>
            {PRESET_TITLES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-indigo-400/60 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white transition-all truncate max-w-[260px]"
                title={preset}
              >
                {preset}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Global Live Status Notification Banner */}
      {isBroadcasting && (
        <div
          id="broadcasting-active-alert"
          className="mb-6 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-indigo-950/80 border-2 border-rose-500/60 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl shadow-rose-950/40 animate-pulse"
        >
          <div className="flex items-center space-x-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
            </span>
            <div>
              <p className="text-xs font-bold text-rose-300">
                🔴 LIVE配信中！「{streamTitle}」はサイト全体に公開されています
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                モニター上部の切り替えタブで、自分自身のライブ画面（弾幕・リアクション付き）を確認できます
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <span className="rounded-lg bg-black/50 px-2.5 py-1 text-slate-300 border border-white/10">
              現在の視聴者: <strong className="text-white font-mono">{viewerCount}</strong> 人
            </span>
            <span className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-rose-300 border border-rose-500/30">
              いいね: <strong className="font-mono">{likes}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Feature 2: Monitor View Mode Tabs (Studio Monitor vs Real Live Player vs Split View) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center space-x-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            id="viewmode-studio-btn"
            onClick={() => setMonitorMode('studio')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              monitorMode === 'studio'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>🎥 配信者モニター</span>
          </button>

          <button
            id="viewmode-live-btn"
            onClick={() => setMonitorMode('live')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              monitorMode === 'live'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="リスナーに届いている弾幕コメントやリアクションをそのまま確認"
          >
            <Tv className="h-3.5 w-3.5" />
            <span>📺 実際のライブ画面 (リスナー視点)</span>
            <span className="rounded bg-black/30 px-1 py-0.2 text-[10px] font-bold text-rose-200">
              弾幕付
            </span>
          </button>

          <button
            id="viewmode-split-btn"
            onClick={() => setMonitorMode('split')}
            className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              monitorMode === 'split'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="配信者操作モニターと実際のライブ画面を両方並べて確認"
          >
            <Columns className="h-3.5 w-3.5" />
            <span>🪟 2画面（同時表示）</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-400">
          {monitorMode === 'studio' && (
            <button
              onClick={() => setShowPip(!showPip)}
              className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-800"
            >
              <Layers className="h-3 w-3" />
              <span>{showPip ? 'ライブ小窓: ON' : 'ライブ小窓: OFF'}</span>
            </button>
          )}

          <span className="hidden md:inline text-[11px] text-slate-500">
            {monitorMode === 'live'
              ? 'リスナーが見ている本番画面をそのまま再生中（ハウリング防止のため自動ミュート）'
              : monitorMode === 'split'
                ? '左: カメラモニター / 右: 実際のリスナー視聴画面'
                : '配信機材モニター表示中'}
          </span>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Monitor(s) & Source Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode 1: Standard Broadcaster Studio Monitor */}
          {monitorMode === 'studio' && (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`h-full w-full object-contain ${isVideoMuted ? 'opacity-20' : ''}`}
              />

              {/* Muted video overlay */}
              {isVideoMuted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-slate-400">
                  <VideoOff className="h-12 w-12 mb-2" />
                  <p className="text-sm font-medium">ビデオ映像は現在ミュートされています</p>
                </div>
              )}

              {/* On Air Status Badge */}
              <div className="absolute top-3 left-3 flex items-center space-x-2">
                {isBroadcasting ? (
                  <div className="flex items-center space-x-1.5 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                    <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                    <span>ON AIR</span>
                  </div>
                ) : (
                  <div className="rounded-md bg-slate-800/90 px-2.5 py-1 text-xs font-semibold text-slate-400 backdrop-blur-xs">
                    STANDBY (待機中)
                  </div>
                )}

                {/* Broadcast duration */}
                {isBroadcasting && (
                  <div className="flex items-center space-x-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-mono text-slate-200 backdrop-blur-xs border border-slate-800">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>{formatDuration(broadcastDuration)}</span>
                  </div>
                )}
              </div>

              {/* Live Pip (Small real-time preview of actual live stream) */}
              {showPip && (
                <div
                  onClick={() => setMonitorMode('live')}
                  className="group cursor-pointer absolute top-3 right-3 w-40 sm:w-48 aspect-video rounded-xl bg-black border-2 border-rose-500/80 shadow-2xl overflow-hidden backdrop-blur-md transition-all hover:scale-105"
                  title="クリックで本番ライブ画面に切り替え"
                >
                  <div className="absolute top-1 left-1.5 z-10 flex items-center space-x-1 rounded bg-rose-600/90 px-1.5 py-0.2 text-[9px] font-black text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                    <span>本番LIVE</span>
                  </div>
                  {latestSnapshot ? (
                    <img
                      src={latestSnapshot}
                      alt="Live feed"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-[10px] text-slate-400">
                      <span>本番映像待機中</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 p-1 text-[9px] text-center text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                    クリックで全画面表示
                  </div>
                </div>
              )}

              {/* Bottom Stream Monitor Stats */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between bg-black/60 backdrop-blur-xs px-3 py-2 rounded-xl border border-white/10">
                <div className="flex items-center space-x-4 text-xs text-slate-200">
                  <div className="flex items-center space-x-1">
                    <Eye className="h-3.5 w-3.5 text-indigo-400" />
                    <span>視聴者: {viewerCount}人</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Heart className="h-3.5 w-3.5 text-rose-400" />
                    <span>いいね: {likes}</span>
                  </div>
                </div>

                {/* Real-time audio VU meter */}
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400 font-mono">MIC</span>
                  <div className="h-2.5 w-24 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className={`h-full transition-all duration-75 ${
                        audioLevel > 75
                          ? 'bg-rose-500'
                          : audioLevel > 40
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${isAudioMuted ? 0 : audioLevel}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Real Live Player (Viewer POV with Danmaku and Reactions) */}
          {monitorMode === 'live' && (
            <div className="rounded-2xl border-2 border-rose-500/80 bg-slate-950 p-2 shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 mb-2">
                <div className="flex items-center space-x-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                  </span>
                  <span className="text-xs font-bold text-rose-400">
                    リスナーに届いている実際のライブ画面（弾幕コメント・リアクションリアルタイム動作中）
                  </span>
                </div>
                <button
                  onClick={() => setMonitorMode('studio')}
                  className="text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-md"
                >
                  ← 配信者モニターに戻す
                </button>
              </div>

              <ViewerPlayer
                room={{
                  id: roomId,
                  title: streamTitle,
                  category: streamCategory,
                  tags: [streamCategory],
                  broadcasterName: currentUserName,
                  viewerCount,
                  likes,
                  isLive: isBroadcasting,
                  createdAt: Date.now(),
                  hasAudio: !isAudioMuted,
                  hasVideo: !isVideoMuted,
                }}
                remoteStream={stream}
                fallbackFrame={latestSnapshot}
                isLive={isBroadcasting}
                comments={comments}
                reactions={reactions}
                likes={likes}
                viewerCount={viewerCount}
                isConnected={isSocketConnected}
                onSendLike={onSendLike}
                onSendReaction={onSendReaction}
                isBroadcasterSelfView={true}
              />
            </div>
          )}

          {/* Mode 3: Split View (Studio Monitor on Left, Real Live on Right) */}
          {monitorMode === 'split' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Studio Monitor Side */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-400 px-1">
                  <span>🎥 配信機材モニター</span>
                  <span className="text-[10px] text-slate-500">操作・マイク音量</span>
                </div>
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 border border-indigo-500/40">
                  <video
                    ref={splitVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute top-2 left-2 rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    LOCAL FEED
                  </div>
                </div>
              </div>

              {/* Real Live Player Side */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-rose-400 px-1">
                  <span>📺 実際のライブ画面（リスナー視点）</span>
                  <span className="text-[10px] text-rose-300">弾幕・リアクション付</span>
                </div>
                <div className="rounded-xl border border-rose-500/60 overflow-hidden bg-slate-950">
                  <ViewerPlayer
                    room={{
                      id: roomId,
                      title: streamTitle,
                      category: streamCategory,
                      tags: [streamCategory],
                      broadcasterName: currentUserName,
                      viewerCount,
                      likes,
                      isLive: isBroadcasting,
                      createdAt: Date.now(),
                      hasAudio: !isAudioMuted,
                      hasVideo: !isVideoMuted,
                    }}
                    remoteStream={stream}
                    fallbackFrame={latestSnapshot}
                    isLive={isBroadcasting}
                    comments={comments}
                    reactions={reactions}
                    likes={likes}
                    viewerCount={viewerCount}
                    isConnected={isSocketConnected}
                    onSendLike={onSendLike}
                    onSendReaction={onSendReaction}
                    isBroadcasterSelfView={true}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Media Source & Device Switcher */}
          <div className="rounded-2xl bg-slate-900/90 p-4 border border-slate-800 space-y-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <span>映像・音声ソース選択</span>
              </h2>

              {/* Open in new tab helper button (Critical for iframe permissions) */}
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="flex items-center space-x-1 text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-500/30 transition-all"
                title="ブラウザのセキュリティ制限を受けずにカメラ・画面共有をフル機能で使用できます"
              >
                <ExternalLink className="h-3 w-3" />
                <span>新しいタブで開く（推奨）</span>
              </button>
            </div>

            {/* Iframe guidance note */}
            {isIframe && (
              <div className="text-[11px] bg-slate-950/80 rounded-xl p-2.5 border border-slate-800 text-slate-400 flex items-start space-x-2">
                <AlertCircle className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-slate-300 font-medium">
                    💡 カメラ・画面共有がブロックされる場合
                  </p>
                  <p>
                    ブラウザのセキュリティ仕様により、埋め込み画面(iframe)内でのカメラ起動や画面共有が制限される場合があります。動かない場合は右上の<strong>「新しいタブで開く」</strong>をご利用ください。
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              {/* Virtual Studio */}
              <button
                id="source-virtual-btn"
                onClick={startVirtualStream}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  sourceType === 'virtual'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 ring-2 ring-indigo-500/50'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400'
                }`}
              >
                <Sparkles className="h-5 w-5 mb-1 text-indigo-400" />
                <span>バーチャル配信</span>
                <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                  カメラ不要・BGM付
                </span>
              </button>

              {/* Web Camera */}
              <button
                id="source-camera-btn"
                onClick={startCameraStream}
                disabled={isMediaLoading}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  sourceType === 'camera'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-300 ring-2 ring-rose-500/50'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400'
                } ${isMediaLoading ? 'opacity-70 cursor-wait' : ''}`}
              >
                <Camera className="h-5 w-5 mb-1 text-rose-400" />
                <span>Webカメラ</span>
                <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                  {isMediaLoading && sourceType !== 'camera' ? '起動中...' : '実機カメラ・マイク'}
                </span>
              </button>

              {/* Screen Share */}
              <button
                id="source-screen-btn"
                onClick={startScreenStream}
                disabled={isMediaLoading}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                  sourceType === 'screen'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-2 ring-emerald-500/50'
                    : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400'
                } ${isMediaLoading ? 'opacity-70 cursor-wait' : ''}`}
              >
                <Monitor className="h-5 w-5 mb-1 text-emerald-400" />
                <span>画面共有</span>
                <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                  {isMediaLoading && sourceType !== 'screen' ? '選択中...' : 'PC画面・ゲーム画面'}
                </span>
              </button>
            </div>

            {/* Quick Mute Toggles */}
            <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80">
              <button
                id="toggle-mic-btn"
                onClick={toggleAudio}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isAudioMuted
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isAudioMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span>{isAudioMuted ? 'マイク: OFF' : 'マイク: ON'}</span>
              </button>

              <button
                id="toggle-camera-btn"
                onClick={toggleVideo}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  isVideoMuted
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isVideoMuted ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                <span>{isVideoMuted ? '映像: OFF' : '映像: ON'}</span>
              </button>

              <span className="text-[11px] text-slate-500 ml-auto">
                現在の映像: {sourceType === 'camera' ? 'Webカメラ' : sourceType === 'screen' ? '画面共有' : 'バーチャル配信'}
              </span>
            </div>

            {/* Error Guidance Box with One-Click Solutions */}
            {mediaError && (
              <div
                id="media-error-box"
                className="space-y-2 rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 text-xs text-rose-200 shadow-md"
              >
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-bold text-rose-300">
                      カメラまたは画面共有を開始できませんでした
                    </p>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed">
                      {mediaError}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/20">
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="flex items-center space-x-1 bg-white hover:bg-slate-100 text-slate-900 font-bold px-3 py-1 rounded-lg text-[11px] transition-all shadow"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>新しいタブで開いて再試行</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      startCameraStream();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] border border-slate-700 transition-all"
                  >
                    カメラを再試行
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      startScreenStream();
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[11px] border border-slate-700 transition-all"
                  >
                    画面共有を再試行
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearError();
                      startVirtualStream();
                    }}
                    className="text-slate-400 hover:text-white px-2 py-1 text-[11px] ml-auto"
                  >
                    バーチャル配信に戻す
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Live Chat Feed for Broadcaster */}
        <div className="h-[620px] lg:h-auto flex flex-col">
          <ChatPanel
            comments={comments}
            onSendMessage={onSendMessage}
            onSendReaction={onSendReaction}
            currentUserName={currentUserName}
            onChangeUserName={onChangeUserName}
            isBroadcaster={true}
          />
        </div>
      </div>

      {/* Archive Saved Modal */}
      {showArchiveSavedModal && savedArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg">
                  <Film className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">アーカイブを保存しました！</h3>
                  <p className="text-xs text-slate-400">
                    配信映像とチャット履歴がアーカイブとして記録されました
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowArchiveSavedModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-950 p-4 space-y-2 border border-slate-800 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>タイトル:</span>
                <span className="font-bold text-white max-w-[260px] truncate">{savedArchive.title}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>録画時間:</span>
                <span className="font-mono text-emerald-400 font-bold">{formatDuration(savedArchive.duration)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>チャット件数:</span>
                <span className="text-slate-200 font-semibold">{savedArchive.comments.length} 件</span>
              </div>
              {savedArchive.superChats && savedArchive.superChats.length > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>スーパーチャット:</span>
                  <span className="text-amber-400 font-bold">{savedArchive.superChats.length} 件</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              {onGoToArchive && (
                <button
                  onClick={() => {
                    setShowArchiveSavedModal(false);
                    onGoToArchive(savedArchive.id);
                  }}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-950/60 transition-all active:scale-95"
                >
                  <Film className="h-4 w-4" />
                  <span>アーカイブ再生ページで視聴・確認する</span>
                </button>
              )}

              {savedVideoBlob && (
                <button
                  onClick={() => downloadRecordedVideo(savedVideoBlob, savedArchive.title)}
                  className="w-full flex items-center justify-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
                >
                  <Download className="h-4 w-4 text-emerald-400" />
                  <span>録画動画ファイル (.webm) をPCにダウンロード</span>
                </button>
              )}

              <button
                onClick={() => setShowArchiveSavedModal(false)}
                className="w-full py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors text-center"
              >
                スタジオに戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
