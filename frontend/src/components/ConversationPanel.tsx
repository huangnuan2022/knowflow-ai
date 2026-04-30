import { Bot, Loader2, Send, UserRound } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { createRun, createUserMessage, executeRun, getMessages } from '../lib/api';
import { DomainNode, Message } from '../lib/domain';

type ConversationPanelProps = {
  node?: DomainNode;
};

export function ConversationPanel({ node }: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((left, right) => left.sequence - right.sequence),
    [messages],
  );

  const refreshMessages = useCallback(async () => {
    if (!node) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setMessages(await getMessages(node.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [node]);

  useEffect(() => {
    void refreshMessages();
  }, [refreshMessages]);

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!node || isSubmitting) {
        return;
      }

      const content = draft.trim();
      if (!content) {
        return;
      }

      setIsSubmitting(true);
      setError(null);
      try {
        const userMessage = await createUserMessage({ content, nodeId: node.id });
        setDraft('');
        setMessages((currentMessages) => [...currentMessages, userMessage]);

        const run = await createRun({ nodeId: node.id });
        const result = await executeRun(run.id);
        const assistantMessage = result.message;
        if (assistantMessage) {
          setMessages((currentMessages) => [...currentMessages, assistantMessage]);
        }

        if (result.run.status === 'FAILED') {
          setError(result.run.errorMessage ?? 'AI run failed');
        }
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Unable to run AI');
        await refreshMessages();
      } finally {
        setIsSubmitting(false);
      }
    },
    [draft, isSubmitting, node, refreshMessages],
  );

  if (!node) {
    return (
      <aside className="conversation-panel">
        <div className="conversation-panel__empty">Select a node</div>
      </aside>
    );
  }

  return (
    <aside className="conversation-panel" aria-label="Conversation thread">
      <header className="conversation-panel__header">
        <span>Conversation</span>
        <h2>{node.title}</h2>
      </header>

      {error ? <div className="conversation-panel__error">{error}</div> : null}

      <div className="message-list" aria-busy={isLoading || isSubmitting}>
        {isLoading ? <div className="message-list__state">Loading</div> : null}
        {!isLoading && sortedMessages.length === 0 ? (
          <div className="message-list__state">No messages</div>
        ) : null}
        {sortedMessages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isSubmitting ? (
          <div className="message-bubble message-bubble--assistant">
            <span className="message-bubble__icon" aria-hidden="true">
              <Loader2 className="spin" size={16} />
            </span>
            <div className="message-bubble__content">Running</div>
          </div>
        ) : null}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          aria-label="Message"
          disabled={isSubmitting}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about this node"
          rows={4}
          value={draft}
        />
        <button
          className="primary-button composer__submit"
          disabled={isSubmitting || draft.trim().length === 0}
          type="submit"
        >
          <Send size={17} />
          Ask
        </button>
      </form>
    </aside>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === 'ASSISTANT';
  const Icon = isAssistant ? Bot : UserRound;

  return (
    <article className={`message-bubble ${isAssistant ? 'message-bubble--assistant' : 'message-bubble--user'}`}>
      <span className="message-bubble__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div>
        <div className="message-bubble__role">{message.role.toLowerCase()}</div>
        <div className="message-bubble__content">{message.content}</div>
      </div>
    </article>
  );
}
