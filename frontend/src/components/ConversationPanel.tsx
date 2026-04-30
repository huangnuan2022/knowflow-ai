import { Bot, GitBranch, Loader2, Send, UserRound } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createBranchFromSelection,
  createRun,
  createUserMessage,
  executeRun,
  getHighlights,
  getMessages,
} from '../lib/api';
import { DomainNode, Highlight, Message, NodeLayout } from '../lib/domain';
import { readTextSelectionWithin, TextSelectionRange } from '../lib/textSelection';

type ConversationPanelProps = {
  branchContext?: BranchContext;
  node?: DomainNode;
  onBranchCreated?: (childNodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
  readOnly?: boolean;
};

type BranchContext = {
  sourceNodeId: string;
  text: string;
};

type BranchSelectionDraft = TextSelectionRange & {
  messageId: string;
};

type HighlightsByMessageId = Record<string, Highlight[]>;

export function ConversationPanel({
  branchContext,
  node,
  onBranchCreated,
  onNodeMessagesChanged,
  readOnly = false,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [highlightsByMessageId, setHighlightsByMessageId] = useState<HighlightsByMessageId>({});
  const [draft, setDraft] = useState('');
  const [selectionDraft, setSelectionDraft] = useState<BranchSelectionDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((left, right) => left.sequence - right.sequence),
    [messages],
  );

  const refreshMessages = useCallback(async () => {
    if (!node) {
      setMessages([]);
      setHighlightsByMessageId({});
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextMessages = await getMessages(node.id);
      setMessages(nextMessages);
      setHighlightsByMessageId(await loadHighlightsByMessageId(nextMessages));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [node]);

  useEffect(() => {
    void refreshMessages();
  }, [refreshMessages]);

  useEffect(() => {
    setSelectionDraft(null);
  }, [node?.id]);

  const onAssistantSelection = useCallback(
    (message: Message, element: HTMLElement) => {
      if (readOnly) {
        return;
      }

      const selection = readTextSelectionWithin(element, message.content);
      setSelectionDraft(selection ? { ...selection, messageId: message.id } : null);
    },
    [readOnly],
  );

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!node || isSubmitting || readOnly) {
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

        await onNodeMessagesChanged?.();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Unable to run AI');
        await refreshMessages();
      } finally {
        setIsSubmitting(false);
      }
    },
    [draft, isSubmitting, node, onNodeMessagesChanged, readOnly, refreshMessages],
  );

  const onBranch = useCallback(async () => {
    if (!node || !selectionDraft || isBranching || readOnly) {
      return;
    }

    setIsBranching(true);
    setError(null);
    try {
      const result = await createBranchFromSelection({
        childNode: {
          layout: buildChildLayout(node.layout),
          summary: `Selected context: ${truncateText(selectionDraft.selectedTextSnapshot, 96)}`,
          title: `Branch: ${truncateText(selectionDraft.selectedTextSnapshot, 44)}`,
        },
        context: {
          tokenEstimate: estimateTokenCount(selectionDraft.selectedTextSnapshot),
        },
        endOffset: selectionDraft.endOffset,
        messageId: selectionDraft.messageId,
        selectedTextSnapshot: selectionDraft.selectedTextSnapshot,
        startOffset: selectionDraft.startOffset,
      });

      setSelectionDraft(null);
      window.getSelection()?.removeAllRanges();
      await onBranchCreated?.(result.childNode.id);
    } catch (branchError) {
      setError(branchError instanceof Error ? branchError.message : 'Unable to create branch');
    } finally {
      setIsBranching(false);
    }
  }, [isBranching, node, onBranchCreated, readOnly, selectionDraft]);

  if (!node) {
    return (
      <aside className={`conversation-panel ${readOnly ? 'conversation-panel--inspector' : ''}`}>
        <div className="conversation-panel__empty">Select a node</div>
      </aside>
    );
  }

  return (
    <aside
      className={`conversation-panel ${readOnly ? 'conversation-panel--inspector' : ''}`}
      aria-label={readOnly ? 'Conversation inspector' : 'Conversation thread'}
    >
      <header className="conversation-panel__header">
        <span>{readOnly ? 'Inspector' : 'Conversation'}</span>
        <h2>{node.title}</h2>
      </header>

      {error ? <div className="conversation-panel__error">{error}</div> : null}

      {branchContext ? (
        <div className="context-chip" title={branchContext.text}>
          <span>Context</span>
          <p>{branchContext.text}</p>
        </div>
      ) : null}

      {!readOnly && selectionDraft ? (
        <div className="branch-selection">
          <div>
            <span>Selection</span>
            <p>{selectionDraft.selectedTextSnapshot}</p>
          </div>
          <button className="primary-button" disabled={isBranching} onClick={onBranch} type="button">
            {isBranching ? <Loader2 className="spin" size={17} /> : <GitBranch size={17} />}
            Branch
          </button>
        </div>
      ) : null}

      <div className="message-list" aria-busy={isLoading || isSubmitting}>
        {isLoading ? <div className="message-list__state">Loading</div> : null}
        {!isLoading && sortedMessages.length === 0 ? (
          <div className="message-list__state">No messages</div>
        ) : null}
        {sortedMessages.map((message) => (
          <MessageBubble
            isSelectedForBranch={selectionDraft?.messageId === message.id}
            key={message.id}
            enableBranching={!readOnly}
            highlights={highlightsByMessageId[message.id] ?? []}
            message={message}
            onAssistantSelection={onAssistantSelection}
          />
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

      {!readOnly ? (
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
      ) : null}
    </aside>
  );
}

function MessageBubble({
  enableBranching,
  isSelectedForBranch,
  highlights,
  message,
  onAssistantSelection,
}: {
  enableBranching: boolean;
  isSelectedForBranch: boolean;
  highlights: Highlight[];
  message: Message;
  onAssistantSelection: (message: Message, element: HTMLElement) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isAssistant = message.role === 'ASSISTANT';
  const Icon = isAssistant ? Bot : UserRound;
  const bubbleClassName = [
    'message-bubble',
    isAssistant ? 'message-bubble--assistant' : 'message-bubble--user',
    isSelectedForBranch ? 'message-bubble--branch-source' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const captureSelection = useCallback(() => {
    if (enableBranching && isAssistant && contentRef.current) {
      onAssistantSelection(message, contentRef.current);
    }
  }, [enableBranching, isAssistant, message, onAssistantSelection]);

  return (
    <article className={bubbleClassName}>
      <span className="message-bubble__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div>
        <div className="message-bubble__role">{message.role.toLowerCase()}</div>
        <div
          className={`message-bubble__content ${isAssistant ? 'message-bubble__content--selectable' : ''}`}
          onKeyUp={captureSelection}
          onMouseUp={captureSelection}
          ref={contentRef}
          tabIndex={enableBranching && isAssistant ? 0 : undefined}
        >
          <HighlightedContent content={message.content} highlights={isAssistant ? highlights : []} />
        </div>
      </div>
    </article>
  );
}

function HighlightedContent({ content, highlights }: { content: string; highlights: Highlight[] }) {
  const ranges = normalizeHighlights(content, highlights);
  if (ranges.length === 0) {
    return <>{content}</>;
  }

  const parts = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.startOffset > cursor) {
      parts.push(content.slice(cursor, range.startOffset));
    }

    parts.push(
      <mark className="message-highlight" key={range.id}>
        {content.slice(range.startOffset, range.endOffset)}
      </mark>,
    );
    cursor = range.endOffset;
  }

  if (cursor < content.length) {
    parts.push(content.slice(cursor));
  }

  return <>{parts}</>;
}

async function loadHighlightsByMessageId(messages: Message[]): Promise<HighlightsByMessageId> {
  const assistantMessages = messages.filter((message) => message.role === 'ASSISTANT');
  const entries = await Promise.all(
    assistantMessages.map(async (message) => [message.id, await getHighlights(message.id)] as const),
  );

  return Object.fromEntries(entries);
}

function normalizeHighlights(content: string, highlights: Highlight[]) {
  const ranges: Highlight[] = [];
  let cursor = 0;

  for (const highlight of [...highlights].sort((left, right) => left.startOffset - right.startOffset)) {
    const startOffset = Math.max(0, Math.min(highlight.startOffset, content.length));
    const endOffset = Math.max(startOffset, Math.min(highlight.endOffset, content.length));

    if (endOffset <= startOffset || startOffset < cursor) {
      continue;
    }

    ranges.push({
      ...highlight,
      endOffset,
      startOffset,
    });
    cursor = endOffset;
  }

  return ranges;
}

function buildChildLayout(parentLayout?: NodeLayout | null): NodeLayout {
  return {
    height: 180,
    width: 280,
    x: numberOrDefault(parentLayout?.x, 100) + 360,
    y: numberOrDefault(parentLayout?.y, 120) + 80,
  };
}

function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function truncateText(text: string, maxLength: number) {
  const compact = text.trim().replace(/\s+/g, ' ');
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 3))}...` : compact;
}
