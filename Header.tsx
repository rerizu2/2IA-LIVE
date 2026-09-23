import { useState } from 'react';
import {
  Radio,
  Tv,
  SplitSquareVertical,
  Sparkles,
  ChevronDown,
  FileCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  X,
  Film,
} from 'lucide-react';
import type { LiveRoom } from './types';

interface HeaderProps {
  currentTab: 'browse' | 'broadcast' | 'dual' | 'watch' | 'archives' | 'archive-watch';
  onSelectTab: (tab: 'browse' | 'broadcast' | 'dual' | 'archives') => void;
  activeRoomCount: number;
  archiveCount?: number;
  liveRooms?: LiveRoom[];
  onSelectRoom?: (roomId: string) => void;
}

export function Header({
  currentTab,
  onSelectTab,
  activeRoomCount,
  archiveCount = 0,
  liveRooms = [],
  onSelectRoom,
}: HeaderProps) {
  const [showLiveDropdown, setShowLiveDropdown] = useState(false);
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [htmlCode, setHtmlCode] = useState<string>('');
  const [loadingHtml, setLoadingHtml] = useState(false);

  const hasLive = liveRooms.length > 0;
  const primaryLive = liveRooms[0];

  const handleOpenHtmlModal = async () => {
    setShowHtmlModal(true);
    if (!htmlCode) {
      setLoadingHtml(true);
      try {
        const res = await fetch('/standalone.html');
        if (res.ok) {
          const text = await res.text();
          setHtmlCode(text);
        }
      } catch (e) {
        console.error('Failed to load standalone.html:', e);
      } finally {
        setLoadingHtml(false);
      }
    }
  };

  const handleDownloadHtml = () => {
    const a = document.createElement('a');
    a.href = '/api/download-single-html';
    a.download = 'livestream_standalone.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyHtml = async () => {
    if (htmlCode) {
      await navigator.clipboard.writeText(htmlCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur-md">
      {/* Platform-wide Live Announcement Banner if any room is live */}
      {hasLive && (
        <div
          id="header-live-alert-bar"
          className="relative bg-gradient-to-r from-rose-950/90 via-slate-900 to-indigo-950/90 border-b border-rose-500/30 px-4 py-1.5 text-xs text-slate-200"
        >
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 truncate">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>

              <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[10px] font-black text-white shrink-0 shadow">
                LIVE NOW
              </span>

              <span className="font-semibold text-slate-100 truncate">
                {primaryLive.title}
              </span>

              <span className="text-slate-400 text-[11px] hidden sm:inline truncate">
                （配信者: {primaryLive.broadcasterName} / 視聴者 {primaryLive.viewerCount}人）
              </span>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {liveRooms.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setShowLiveDropdown(!showLiveDropdown)}
                    className="flex items-center space-x-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700"
                  >
                    <span>他の配信 ({liveRooms.length})</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>

                  {showLiveDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 rounded-xl bg-slate-900 border border-slate-800 p-2 shadow-xl z-50">
                      <p className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                        配信中のライブ一覧
                      </p>
                      <div className="space-y-1 mt-1">
                        {liveRooms.map((room) => (
                          <div
                            key={room.id}
                            onClick={() => {
                              onSelectRoom?.(room.id);
                              setShowLiveDropdown(false);
                            }}
                            className="flex cursor-pointer items-center justify-between rounded-lg p-1.5 hover:bg-slate-800 transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="truncate text-xs font-semibold text-slate-200">
                                {room.title}
                              </p>
                              <p className="truncate text-[10px] text-slate-400">
                                {room.broadcasterName}
                              </p>
                            </div>
                            <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 shrink-0">
                              {room.viewerCount}人
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => onSelectRoom?.(primaryLive.id)}
                className="flex items-center space-x-1 rounded-md bg-rose-600 hover:bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow transition-all active:scale-95"
              >
                <span>今すぐ視聴</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand / Logo */}
        <div
          id="brand-logo"
          onClick={() => onSelectTab('browse')}
          className="flex cursor-pointer items-center space-x-3 transition-opacity hover:opacity-90"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-600 shadow-lg shadow-rose-950/50">
            <Radio className="h-5 w-5 text-white animate-pulse" />
            {hasLive && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-slate-100 tracking-tight">LiveStream</span>
              {hasLive ? (
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-black text-white shadow animate-pulse">
                  LIVE NOW
                </span>
              ) : (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">
                  OFFLINE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              リアルタイム配信＆コメントプラットフォーム
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            id="tab-browse"
            onClick={() => onSelectTab('browse')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'browse'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Tv className="h-4 w-4" />
            <span>配信をみる</span>
            {hasLive ? (
              <span className="ml-1 text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full font-bold animate-pulse shadow">
                LIVE {liveRooms.length}
              </span>
            ) : null}
          </button>

          <button
            id="tab-broadcast"
            onClick={() => onSelectTab('broadcast')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'broadcast'
                ? 'bg-rose-600 text-white shadow-sm shadow-rose-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="h-4 w-4" />
            <span>配信スタジオ</span>
          </button>

          <button
            id="tab-archives"
            onClick={() => onSelectTab('archives')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'archives' || currentTab === 'archive-watch'
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Film className="h-4 w-4" />
            <span>アーカイブ</span>
            {archiveCount > 0 && (
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-purple-900/80 text-purple-200 border border-purple-500/30">
                {archiveCount}
              </span>
            )}
          </button>

          <button
            id="tab-dual"
            onClick={() => onSelectTab('dual')}
            className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentTab === 'dual'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/40'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="1画面で配信者と視聴者の両方を体験"
          >
            <SplitSquareVertical className="h-4 w-4" />
            <span>2画面テスト</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded border border-emerald-500/30">
              便利
            </span>
          </button>
        </nav>

        {/* Right CTA */}
        <div className="flex items-center space-x-2">
          {/* Standalone Single HTML Export Button */}
          <button
            id="btn-single-html-export"
            onClick={handleOpenHtmlModal}
            className="flex items-center space-x-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-sm transition-all"
            title="プログラム全体を1つのHTMLファイルとして保存・書き出し"
          >
            <FileCode className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline">単一HTML保存</span>
            <span className="sm:hidden">HTML</span>
          </button>

          {currentTab !== 'broadcast' && (
            <button
              id="cta-go-live"
              onClick={() => onSelectTab('broadcast')}
              className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-md shadow-rose-950/40 hover:from-rose-500 hover:to-pink-500 transition-all active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">今すぐ配信する</span>
              <span className="sm:hidden">配信</span>
            </button>
          )}
        </div>
      </div>

      {/* Standalone Single HTML Modal */}
      {showHtmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="rounded-xl bg-amber-500/20 p-2 text-amber-400 border border-amber-500/30">
                  <FileCode className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    単一HTMLファイル（All-in-One Standalone）
                  </h3>
                  <p className="text-xs text-slate-400">
                    HTML、CSS、JavaScript、WebRTC、チャット、配信スタジオを1ファイルに完全統合
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHtmlModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-indigo-950/40 border border-indigo-500/30 p-4 text-xs text-indigo-200 space-y-2">
              <p className="font-semibold text-indigo-100">
                ✨ サーバー不要！ローカルPCでダブルクリックするだけで動きます
              </p>
              <ul className="list-disc pl-4 space-y-1 text-indigo-300">
                <li>
                  ダウンロードした <code>livestream_standalone.html</code> をブラウザで開くだけで即座に起動します。
                </li>
                <li>
                  ブラウザで2つのタブ（または別ウィンドウ）を開いて片方を配信、片方を視聴にすると、<strong>サーバーなしでマルチタブP2Pリアルタイム生配信</strong>が可能です。
                </li>
                <li>
                  カメラ映像・音声・画面共有・弾幕コメント・スパチャ（スーパーチャット）・リアクションもすべて同梱されています。
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                onClick={handleDownloadHtml}
                className="flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 p-3 text-xs font-bold text-white shadow-lg shadow-rose-950/40 transition-all active:scale-95"
              >
                <Download className="h-4 w-4" />
                <span>HTMLファイルをダウンロード</span>
              </button>

              <a
                href="/standalone.html"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 text-xs font-semibold text-slate-200 transition-all"
              >
                <ExternalLink className="h-4 w-4 text-indigo-400" />
                <span>別タブで単一HTMLを開く</span>
              </a>

              <button
                onClick={handleCopyHtml}
                disabled={loadingHtml}
                className="flex items-center justify-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 p-3 text-xs font-semibold text-slate-200 transition-all"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300">コピーしました！</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-amber-400" />
                    <span>HTMLコードをコピー</span>
                  </>
                )}
              </button>
            </div>

            {/* Preview Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>HTMLソースプレビュー (完全自己完結型)</span>
                <span>{htmlCode ? `${Math.round(htmlCode.length / 1024)} KB` : '読み込み中...'}</span>
              </div>
              <div className="h-36 overflow-y-auto rounded-xl bg-slate-950 p-3 text-[11px] font-mono text-slate-300 border border-slate-800">
                {loadingHtml ? (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    読み込み中...
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap">{htmlCode.slice(0, 1500)}...&#10;&#10;/* [全体コードを含む完全な単一HTMLファイルです] */</pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
