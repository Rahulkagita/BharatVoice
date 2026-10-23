import type { ChatMessage } from '../../types';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={`bv-message ${isUser ? 'bv-message--user' : 'bv-message--assistant'}`}>
      <div className="bv-message-bubble">
        <p className="bv-message-text">{message.text}</p>
        <time className="bv-message-time">
          {new Date(message.timestamp).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  );
}
