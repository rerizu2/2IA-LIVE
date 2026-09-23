import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Flame,
  Heart,
  Volume2,
  VolumeX,
  User,
  ArrowDown,
  Gift,
  X,
} from 'lucide-react';
import type { ChatMessage } from './types';

interface ChatPanelProps {
  comments: ChatMessage[];
  onSendMessage: (text: string, isSuperChat?: boolean, amount?: number, color?: string) => void;
  onSendReaction: (emoji: string) => void;
  currentUserName: string;
  onChangeUserName: (name: string) => void;
  isBroadcaster?: boolean;
}

const QUICK_COMMENTS = [
  '888888👏',
  'ナイス！👍',
  '草www',
  'こんばんは〜！✨',
  '音質最高！',
  '神配信🔥',
];

const QUICK_REACTIONS = ['👏', '❤️', '🔥', '🎉', '🌟', '🤣'];

const SUPER_CHAT_PRESETS = [
  { amount: 200, label: '¥200', color: '#0284c7', bg: 'bg-sky-500' },
  { amount: 500, label: '¥500', color: '#16a34a', bg: 'bg-emerald-500' },
  { amount: 1000, label: '¥1,000', color: '#d97706', bg: 'bg-amber-500' },
  { amount: 5000, label: '¥5,000', color: '#dc2626', bg: 'bg-rose-500' },
  { amount: 10000, label: '¥10,000', color: '#9333ea', bg: 'bg-purple-600' },
];

export function ChatPanel({
  comments,
  onSendMessage,
  onSendReaction,
  currentUserName,
  onChangeUserName,
  isBroadcaster = false,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUserName);
  const [showSuperChatModal, setShowSuperChatModal] = useState(false);
  const [selectedSuperChat, setSelectedSuperChat] = useState(SUPER_CHAT_PRESETS[1]);
  const [superChatMessage, setSuperChatMessage] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const chatListRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Synthesize pleasant sound effect for chat/reaction
  const playSoundEffect = (type: 'comment' | 'superchat' | 'reaction') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'superchat') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'reaction') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch {
      // AudioContext policy
    }
  };

  // Scroll to bottom when new messages arrive if auto-scroll is on
  useEffect(() => {
    if (!chatListRef.current) return;
    if (autoScroll) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
      setHasNewMessages(false);
    } else {
      setHasNewMessages(true);
    }

    if (comments.length > 0) {
      const last = comments[comments.length - 1];
      if (last.isSuperChat) {
        playSoundEffect('superchat');
      } else {
        playSoundEffect('comment');
      }
    }
  }, [comments, autoScroll]);

  const handleScroll = () => {
    if (!chatListRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatListRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
    if (isAtBottom) {
      setHasNewMessages(false);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleSendSuperChat = () => {
    if (!superChatMessage.trim()) return;
    onSendMessage(
      superChatMessage.trim(),
      true,
      selectedSuperChat.amount,
      selectedSuperChat.color,
    );
    setSuperChatMessage('');
    setShowSuperChatModal(false);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onChangeUserName(nameInput.trim());
      setIsEditingName(false);
    }
  };

  return (
    <div
      id="chat-panel"
      className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl"
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-semibold text-slate-200">ライブチャット</h2>
          <span className="text-xs text-slate-400 font-mono">({comments.length})</span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Sound Toggle */}
          <button
            id="toggle-chat-sound"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              soundEnabled
                ? 'bg-indigo-600/30 text-indigo-400 hover:bg-indigo-600/50'
                : 'text-slate-400 hover:bg-slate-800'
            }`}
            title={soundEnabled ? '効果音: ON' : '効果音: OFF'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* User Nickname */}
          {isEditingName ? (
            <form onSubmit={handleSaveName} className="flex items-center space-x-1">
              <input
                id="edit-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={20}
                className="w-28 rounded bg-slate-800 px-2 py-0.5 text-xs text-white border border-indigo-500 outline-none"
                placeholder="名前"
                autoFocus
              />
              <button
                type="submit"
                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded font-medium"
              >
                保存
              </button>
            </form>
          ) : (
            <button
              id="user-name-btn"
              onClick={() => {
                setNameInput(currentUserName);
                setIsEditingName(true);
              }}
              className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white bg-slate-800/80 px-2 py-1 rounded border border-slate-700 hover:border-slate-600 transition-colors"
              title="クリックしてユーザー名を変更"
            >
              <User className="h-3 w-3 text-slate-400" />
              <span className="max-w-[90px] truncate">{currentUserName}</span>
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages List */}
      <div
        ref={chatListRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto p-3 space-y-2.5 text-sm"
      >
        {comments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-4 text-slate-500">
            <Sparkles className="h-8 w-8 mb-2 opacity-30 text-indigo-400" />
            <p className="text-xs">まだコメントがありません</p>
            <p className="text-[11px] text-slate-600 mt-1">
              最初のコメントやリアクションを送ってみましょう！
            </p>
          </div>
        ) : (
          comments.map((msg) => {
            if (msg.isSuperChat) {
              return (
                <div
                  key={msg.id}
                  className="rounded-lg p-3 text-white shadow-md border border-amber-500/40 bg-gradient-to-r from-amber-600/90 to-orange-600/90"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                    <span className="flex items-center space-x-1">
                      <Gift className="h-3.5 w-3.5" />
                      <span>{msg.senderName}</span>
                    </span>
                    <span className="bg-black/30 px-2 py-0.5 rounded-full font-mono">
                      ¥{msg.amount?.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{msg.text}</p>
                </div>
              );
            }

            return (
              <div key={msg.id} className="group flex items-start space-x-2 text-xs sm:text-sm">
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm mt-0.5"
                  style={{ backgroundColor: msg.color || '#4f46e5' }}
                >
                  {msg.senderName.slice(0, 1)}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-baseline space-x-1.5">
                    <span className="font-semibold text-slate-300 text-xs truncate max-w-[120px]">
                      {msg.senderName}
                    </span>
                    {msg.isBroadcaster && (
                      <span className="rounded bg-rose-600 px-1 py-0.2 text-[9px] font-bold text-white tracking-wide">
                        配信者
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-slate-100 break-words leading-relaxed select-text">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Floating scroll to bottom notice */}
        {hasNewMessages && (
          <button
            onClick={() => {
              if (chatListRef.current) {
                chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
                setAutoScroll(true);
                setHasNewMessages(false);
              }
            }}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center space-x-1 rounded-full bg-indigo-600 px-3 py-1 text-xs text-white shadow-lg hover:bg-indigo-500 transition-all animate-bounce"
          >
            <ArrowDown className="h-3 w-3" />
            <span>新しいコメント ↓</span>
          </button>
        )}
      </div>

      {/* Quick Reactions Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950/60 border-t border-slate-800/80 gap-1 overflow-x-auto">
        <div className="flex items-center space-x-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSendReaction(emoji);
                playSoundEffect('reaction');
              }}
              className="text-base sm:text-lg hover:scale-125 transition-transform active:scale-95 p-1 rounded hover:bg-slate-800"
              title={`リアクション: ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Super Chat Trigger */}
        {!isBroadcaster && (
          <button
            id="super-chat-btn"
            onClick={() => setShowSuperChatModal(true)}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-colors"
            title="スパチャ（投げ銭）を送る"
          >
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">スパチャ</span>
          </button>
        )}
      </div>

      {/* Quick Comment Chips */}
      <div className="flex items-center space-x-1.5 px-3 py-1 bg-slate-950/40 overflow-x-auto text-[11px] whitespace-nowrap scrollbar-none">
        {QUICK_COMMENTS.map((chip) => (
          <button
            key={chip}
            onClick={() => {
              onSendMessage(chip);
            }}
            className="rounded bg-slate-800/80 hover:bg-slate-700 px-2 py-0.5 text-slate-300 hover:text-white transition-colors border border-slate-700/50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Comment Input Form */}
      <form
        onSubmit={handleSend}
        className="flex items-center space-x-2 p-2.5 bg-slate-950 border-t border-slate-800"
      >
        <input
          id="chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            isBroadcaster ? '配信者として発言...' : 'コメントを入力 (Enterで送信)...'
          }
          maxLength={200}
          className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
        />
        <button
          id="send-comment-btn"
          type="submit"
          disabled={!inputText.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          title="コメントを送信"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {/* Super Chat Modal */}
      {showSuperChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">スーパーチャットを送る</h3>
                  <p className="text-xs text-slate-400">配信者を直接応援できます</p>
                </div>
              </div>
              <button
                onClick={() => setShowSuperChatModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {SUPER_CHAT_PRESETS.map((preset) => (
                <button
                  key={preset.amount}
                  onClick={() => setSelectedSuperChat(preset)}
                  className={`py-2 px-2 rounded-xl text-center font-bold text-xs border transition-all ${
                    selectedSuperChat.amount === preset.amount
                      ? 'border-white text-white shadow-md scale-102 ' + preset.bg
                      : 'border-slate-800 bg-slate-800/80 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Preview Card */}
            <div
              className="rounded-xl p-3 mb-4 text-white shadow-lg transition-all"
              style={{ backgroundColor: selectedSuperChat.color }}
            >
              <div className="flex items-center justify-between text-xs mb-1 font-bold">
                <span>{currentUserName}</span>
                <span>{selectedSuperChat.label}</span>
              </div>
              <p className="text-xs opacity-90 break-words">
                {superChatMessage || '応援メッセージがここに入ります'}
              </p>
            </div>

            {/* Message input */}
            <textarea
              id="superchat-textarea"
              value={superChatMessage}
              onChange={(e) => setSuperChatMessage(e.target.value)}
              placeholder="配信者への応援メッセージを入力してください..."
              rows={3}
              maxLength={150}
              className="w-full rounded-xl bg-slate-950 p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 border border-slate-700 focus:border-amber-500 outline-none mb-4 resize-none"
            />

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSuperChatModal(false)}
                className="flex-1 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                id="submit-superchat-btn"
                onClick={handleSendSuperChat}
                disabled={!superChatMessage.trim()}
                className="flex-1 py-2 text-xs font-bold text-white rounded-lg bg-amber-600 hover:bg-amber-500 shadow-md shadow-amber-950 disabled:opacity-40 transition-all"
              >
                {selectedSuperChat.label} を送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
