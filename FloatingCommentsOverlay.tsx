import { useEffect, useState, useRef } from 'react';
import type { ChatMessage, LiveReaction } from './types';

interface FloatingItem {
  id: string;
  text: string;
  topPercent: number; // 5% to 80%
  color: string;
  isSuperChat?: boolean;
}

interface FloatingReactionItem {
  id: string;
  emoji: string;
  xPercent: number;
}

interface FloatingCommentsOverlayProps {
  comments: ChatMessage[];
  reactions: LiveReaction[];
  enabled: boolean;
}

export function FloatingCommentsOverlay({
  comments,
  reactions,
  enabled,
}: FloatingCommentsOverlayProps) {
  const [activeItems, setActiveItems] = useState<FloatingItem[]>([]);
  const [activeReactions, setActiveReactions] = useState<FloatingReactionItem[]>([]);
  const processedCommentIdsRef = useRef<Set<string>>(new Set());
  const processedReactionIdsRef = useRef<Set<string>>(new Set());

  // Watch for new comments and push into Danmaku animation queue
  useEffect(() => {
    if (!enabled || comments.length === 0) return;

    const latest = comments[comments.length - 1];
    if (latest && !processedCommentIdsRef.current.has(latest.id)) {
      processedCommentIdsRef.current.add(latest.id);

      // Keep set size manageable
      if (processedCommentIdsRef.current.size > 200) {
        processedCommentIdsRef.current.clear();
      }

      // Random track between 8% and 75%
      const topPercent = Math.floor(Math.random() * 65) + 8;
      const newItem: FloatingItem = {
        id: latest.id,
        text: latest.text,
        topPercent,
        color: latest.isSuperChat ? '#f59e0b' : '#ffffff',
        isSuperChat: latest.isSuperChat,
      };

      setActiveItems((prev) => [...prev, newItem]);

      // Remove after animation completes (~7 seconds)
      setTimeout(() => {
        setActiveItems((prev) => prev.filter((item) => item.id !== newItem.id));
      }, 7000);
    }
  }, [comments, enabled]);

  // Watch for new reactions (floating heart/emoji bubbles)
  useEffect(() => {
    if (reactions.length === 0) return;

    const latest = reactions[reactions.length - 1];
    if (latest && !processedReactionIdsRef.current.has(latest.id)) {
      processedReactionIdsRef.current.add(latest.id);

      const newReaction: FloatingReactionItem = {
        id: latest.id,
        emoji: latest.emoji,
        xPercent: latest.xPercent || Math.floor(Math.random() * 80) + 10,
      };

      setActiveReactions((prev) => [...prev, newReaction]);

      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((item) => item.id !== newReaction.id));
      }, 3500);
    }
  }, [reactions]);

  if (!enabled) return null;

  return (
    <div
      id="danmaku-container"
      className="pointer-events-none absolute inset-0 overflow-hidden select-none z-20"
    >
      {/* Sliding Danmaku Comments */}
      {activeItems.map((item) => (
        <div
          key={item.id}
          className={`absolute whitespace-nowrap font-bold text-lg sm:text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] animate-danmaku ${
            item.isSuperChat
              ? 'bg-amber-500/90 text-slate-950 px-3 py-1 rounded-full border border-amber-300 font-extrabold shadow-lg shadow-amber-500/40'
              : 'text-white'
          }`}
          style={{
            top: `${item.topPercent}%`,
            color: item.isSuperChat ? undefined : item.color,
            textShadow: '0 0 6px #000, 0 0 10px #000',
          }}
        >
          {item.text}
        </div>
      ))}

      {/* Floating Emoji Reactions */}
      {activeReactions.map((reaction) => (
        <div
          key={reaction.id}
          className="absolute bottom-6 text-3xl sm:text-4xl animate-float-up drop-shadow-md"
          style={{
            left: `${reaction.xPercent}%`,
          }}
        >
          {reaction.emoji}
        </div>
      ))}
    </div>
  );
}
