import { useCallback, useEffect, useRef } from 'react';
import type { ChatMessage } from '../../types';
import MessageBubble from './MessageBubble';

interface ConversationProps {
  messages: ChatMessage[];
}

export default function Conversation({ messages }: ConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // Hide scroll-to-bottom cue when user scrolls manually (none implemented).
  }, []);

  if (messages.length === 0) {
    return (
      <div className="bv-conversation bv-conversation--empty" ref={containerRef}>
        <p className="bv-empty-text">Start a conversation by typing or speaking above.</p>
      </div>
    );
  }

  return (
    <div className="bv-conversation" ref={containerRef} onScroll={handleScroll}>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
