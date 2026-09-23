import { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Heart,
  Eye,
  MessageSquare,
  Share2,
  Radio,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { LiveRoom, ChatMessage, LiveReaction } from './types';
import { FloatingCommentsOverlay } from './FloatingCommentsOverlay';

interface ViewerPlayerProps {
  room: LiveRoom | null;
  remoteStream: MediaStream | null;
  fallbackFrame: string | null;
  isLive: boolean;
  comments: ChatMessage[];
  reactions: LiveReaction[];
  likes: number;
  viewerCount: number;
  isConnected: boolean;
  onSendLike: () => void;
  onSendReaction: (emoji: string) => void;
  theaterMode?: boolean;
  onToggleTheater?: () => void;
  isBroadcasterSelfView?: boolean;
}

export function ViewerPlayer({
  room,
  remoteStream,
  fallbackFrame,
  isLive,
  comments,
  reactions,
  likes,
  viewerCount,
  isConnected,
  onSendLike,
  onSendReaction,
  theaterMode = false,
  onToggleTheater,
  isBroadcasterSelfView = false,
}: ViewerPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(isBroadcasterSelfView);
  const [volume, setVolume] = useState(isBroadcasterSelfView ? 0 : 0.8);
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasCopiedShare, setHasCopiedShare] = useState(false);
  const [likeAnim, setLikeAnim] = useState(false);
  const [isWebRTCActive, setIsWebRTCActive] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef<number>(0);
  const lastTimeUpdateStampRef = useRef<number>(Date.now());

  // Attach remote stream to video element and ensure autoplay
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((e) => {
          console.warn('Autoplay prevented on stream attach:', e);
          setIsPlaying(false);
        });
    } else {
      setIsWebRTCActive(false);
    }
  }, [remoteStream]);

  // Playback Watchdog: monitors whether WebRTC video is actively advancing frames
  // If frames stall for > 1.2s, automatically drops to server fallback frame so viewers NEVER freeze!
  useEffect(() => {
    const watchdogInterval = setInterval(() => {
      const vid = videoRef.current;
      if (vid && remoteStream) {
        const now = Date.now();
        // If currentTime hasn't moved in 1200ms or video is paused
        if (now - lastTimeUpdateStampRef.current > 1200 || vid.paused) {
          setIsWebRTCActive(false);
          // Attempt automatic unfreeze
          vid.play().catch(() => {});
        }
      } else {
        setIsWebRTCActive(false);
      }
    }, 500);

    return () => clearInterval(watchdogInterval);
  }, [remoteStream]);

  // Video timeupdate handler to verify active motion
  const handleVideoTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid) {
      if (vid.currentTime !== lastTimeRef.current) {
        lastTimeRef.current = vid.currentTime;
        lastTimeUpdateStampRef.current = Date.now();
        if (!isWebRTCActive) {
          setIsWebRTCActive(true);
        }
      }
    }
  };

  // Resume playback on user click or touch
  const handleContainerClick = () => {
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Handle fullscreen change listeners
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!playerContainerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await playerContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMute = !isMuted;
      videoRef.current.muted = nextMute;
      setIsMuted(nextMute);
      if (!nextMute && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const handleLike = () => {
    onSendLike();
    onSendReaction('❤️');
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 600);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setHasCopiedShare(true);
    setTimeout(() => setHasCopiedShare(false), 2000);
  };

  const hasVideoSource = !!remoteStream || !!fallbackFrame;

  return (
    <div className="flex flex-col space-y-4">
      {/* Video Viewport Container */}
      <div
        ref={playerContainerRef}
        onClick={handleContainerClick}
        className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center"
      >
        {/* Layer 1: High-FPS Fallback Frame Relay (Guarantees zero-freeze playback across all networks) */}
        {fallbackFrame && (
          <img
            src={fallbackFrame}
            alt="Live stream relay feed"
            className={`absolute inset-0 h-full w-full object-contain bg-black transition-opacity duration-150 ${
              isWebRTCActive ? 'opacity-0 pointer-events-none' : 'opacity-100 z-10'
            }`}
          />
        )}

        {/* Layer 2: WebRTC Real-Time Video (Zero latency when actively streaming frames) */}
        {remoteStream && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMuted}
            onTimeUpdate={handleVideoTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              if (videoRef.current) videoRef.current.play().catch(() => {});
            }}
            className={`absolute inset-0 h-full w-full object-contain bg-black transition-opacity duration-150 ${
              isWebRTCActive ? 'opacity-100 z-20' : 'opacity-0 pointer-events-none z-0'
            }`}
          />
        )}

        {/* Layer 3: Offline or Waiting State (When neither WebRTC nor relay frame is available) */}
        {!remoteStream && !fallbackFrame && (
          <div className="flex flex-col items-center justify-center p-6 text-center z-10">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800">
              <Radio className="h-8 w-8 text-slate-500 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-200">
              {isLive ? '配信に接続中...' : '配信は現在オフラインです'}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              {isLive
                ? '映像と音声データを読み込んでいます。少々お待ちください。'
                : '配信者が配信を開始すると、自動的に映像が表示されます。'}
            </p>
          </div>
        )}

        {/* Danmaku Floating Comments & Reaction Overlay */}
        <FloatingCommentsOverlay
          comments={comments}
          reactions={reactions}
          enabled={danmakuEnabled}
        />

        {/* Top Badges (Live, Viewer Count, Latency) */}
        <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between z-30">
          <div className="flex items-center space-x-2">
            {isLive ? (
              <div className="flex items-center space-x-1.5 rounded-md bg-rose-600/90 px-2.5 py-1 text-xs font-bold text-white shadow-md backdrop-blur-xs">
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                <span>LIVE</span>
              </div>
            ) : (
              <div className="rounded-md bg-slate-800/90 px-2.5 py-1 text-xs font-semibold text-slate-400 backdrop-blur-xs">
                OFFLINE
              </div>
            )}

            {isBroadcasterSelfView && (
              <div className="rounded-md bg-indigo-600/90 px-2 py-1 text-[11px] font-bold text-white shadow backdrop-blur-xs border border-indigo-400/50">
                <span>👁️ リスナー視点モニター</span>
              </div>
            )}

            <div className="flex items-center space-x-1.5 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-200 backdrop-blur-xs border border-slate-800">
              <Eye className="h-3.5 w-3.5 text-slate-400" />
              <span>{viewerCount} 人が視聴中</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div
              className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs font-medium backdrop-blur-xs border ${
                isConnected
                  ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/50'
                  : 'bg-rose-950/70 text-rose-400 border-rose-800/50'
              }`}
            >
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span className="text-[11px]">
                    {isWebRTCActive ? '超低遅延P2P' : '安定リレー配信'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span className="text-[11px]">再接続中</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Video Control Bar (Reveals on Hover) */}
        <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex items-center space-x-3">
            {/* Mute/Unmute */}
            <button
              onClick={toggleMute}
              className="text-white hover:text-indigo-400 transition-colors p-1"
              title={isMuted ? 'ミュート解除' : 'ミュート'}
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>

            {/* Volume Slider */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="h-1.5 w-16 sm:w-24 cursor-pointer accent-indigo-500 bg-slate-700 rounded-lg appearance-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            {/* Danmaku Toggle */}
            <button
              id="danmaku-toggle-btn"
              onClick={() => setDanmakuEnabled(!danmakuEnabled)}
              className={`flex items-center space-x-1 rounded-md px-2 py-1 text-xs font-semibold transition-all ${
                danmakuEnabled
                  ? 'bg-indigo-600/80 text-white shadow'
                  : 'bg-slate-800/70 text-slate-400 hover:text-slate-200'
              }`}
              title="弾幕（流れるコメント）表示切替"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="text-[11px]">弾幕: {danmakuEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Fullscreen */}
            <button
              id="fullscreen-btn"
              onClick={toggleFullscreen}
              className="text-white hover:text-indigo-400 transition-colors p-1"
              title="全画面表示"
            >
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Stream Info & Broadcaster Details */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-900/60 p-4 border border-slate-800/80">
        <div className="flex items-start space-x-3.5">
          {/* Broadcaster Avatar */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-rose-600 text-lg font-bold text-white shadow-md">
            {room?.broadcasterName?.slice(0, 1) || '播'}
          </div>

          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-100">
                {room?.title || 'ライブ配信'}
              </h1>
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/30">
                {room?.category || '雑談'}
              </span>
            </div>

            <div className="mt-1 flex items-center space-x-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                {room?.broadcasterName || '配信者'}
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>高画質リアルタイム配信</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Like, Share) */}
        <div className="flex items-center space-x-2.5 self-end sm:self-center">
          <button
            id="like-stream-btn"
            onClick={handleLike}
            className={`flex items-center space-x-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 px-3.5 py-2 text-sm font-semibold text-rose-300 transition-all active:scale-90 ${
              likeAnim ? 'scale-110 bg-rose-600/40 ring-2 ring-rose-400' : ''
            }`}
            title="いいねを送る"
          >
            <Heart
              className={`h-4 w-4 text-rose-500 ${likeAnim ? 'fill-rose-500 animate-ping' : 'fill-rose-500/40'}`}
            />
            <span className="font-mono">{likes.toLocaleString()}</span>
          </button>

          <button
            id="share-stream-btn"
            onClick={handleShare}
            className="flex items-center space-x-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors"
            title="配信リンクをコピー"
          >
            <Share2 className="h-4 w-4" />
            <span>{hasCopiedShare ? 'コピー完了！' : '共有'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
