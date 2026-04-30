import { Handle, NodeProps, Position } from '@xyflow/react';
import { Bot, GitBranch, Loader2, MessageSquareText, Send, UserRound } from 'lucide-react';
import { FormEvent, useCallback, useMemo, useRef, useState } from 'react';
import { createBranchFromSelection, createRun, createUserMessage, executeRun } from '../lib/api';
import { Highlight, Message, NodeLayout } from '../lib/domain';
import { branchHighlightHandleId, ConversationNodeData } from '../lib/reactFlowAdapter';
import { readTextSelectionWithin, TextSelectionRange } from '../lib/textSelection';

type InlineSelectionDraft = TextSelectionRange & {
  messageId: string;
  toolbarPosition: {
    left: number;
    top: number;
  };
};

export function ConversationNode({ data, id, selected }: NodeProps) {
  const nodeData = data as ConversationNodeData;
  const [draft, setDraft] = useState('');
  const [selectionDraft, setSelectionDraft] = useState<InlineSelectionDraft | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sortedMessages = useMemo(
    () => [...nodeData.messages].sort((left, right) => left.sequence - right.sequence),
    [nodeData.messages],
  );

  const onAssistantSelection = useCallback((message: Message, element: HTMLElement) => {
    const selection = readTextSelectionWithin(element, message.content);
    if (!selection) {
      setSelectionDraft(null);
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const buttonWidth = 92;
    setSelectionDraft({
      ...selection,
      messageId: message.id,
      toolbarPosition: {
        left: Math.max(
          8,
          Math.min(selection.rect.left - elementRect.left + selection.rect.width + 8, elementRect.width - buttonWidth),
        ),
        top: Math.max(0, selection.rect.top - elementRect.top - 4),
      },
    });
  }, []);

  const onAsk = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const content = draft.trim();
      if (!content || isAsking) {
        return;
      }

      setIsAsking(true);
      setError(null);
      try {
        await createUserMessage({ content, nodeId: id });
        setDraft('');
        const run = await createRun({ nodeId: id });
        const result = await executeRun(run.id);
        if (result.run.status === 'FAILED') {
          setError(result.run.errorMessage ?? 'AI run failed');
        }

        await nodeData.onNodeMessagesChanged?.();
      } catch (askError) {
        setError(askError instanceof Error ? askError.message : 'Unable to ask AI');
      } finally {
        setIsAsking(false);
      }
    },
    [draft, id, isAsking, nodeData],
  );

  const onBranch = useCallback(async () => {
    if (!selectionDraft || isBranching) {
      return;
    }

    setIsBranching(true);
    setError(null);
    try {
      const result = await createBranchFromSelection({
        childNode: {
          layout: buildChildLayout(nodeData.layout),
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
      await nodeData.onBranchCreated?.(result.childNode.id);
    } catch (branchError) {
      setError(branchError instanceof Error ? branchError.message : 'Unable to create branch');
    } finally {
      setIsBranching(false);
    }
  }, [isBranching, nodeData, selectionDraft]);

  return (
    <article className={`conversation-node ${selected ? 'is-selected is-expanded' : ''}`}>
      <Handle className="node-handle" position={Position.Top} type="target" />
      <div className="conversation-node__header">
        <span className="conversation-node__icon" aria-hidden="true">
          <MessageSquareText size={16} />
        </span>
        <div>
          <h2>{nodeData.title}</h2>
          <p>{nodeData.type.replace('_', ' ').toLowerCase()}</p>
        </div>
      </div>

      {selected ? (
        <>
          {nodeData.branchContext ? (
            <div className="conversation-node__context nodrag nopan nowheel">
              <span>Context</span>
              <p>{nodeData.branchContext.text}</p>
            </div>
          ) : null}
          <div className="conversation-node__thread nodrag nopan nowheel">
            {error ? <div className="conversation-node__error">{error}</div> : null}
            {sortedMessages.length > 0 ? (
              sortedMessages.map((message) => (
                <CanvasMessage
                  highlights={nodeData.highlightsByMessageId[message.id] ?? []}
                  isBranching={isBranching}
                  key={message.id}
                  message={message}
                  onAssistantSelection={onAssistantSelection}
                  onBranch={onBranch}
                  selectionDraft={selectionDraft?.messageId === message.id ? selectionDraft : null}
                />
              ))
            ) : (
              <p className="conversation-node__empty">No messages yet</p>
            )}
            {isAsking ? (
              <div className="canvas-message canvas-message--assistant">
                <span className="canvas-message__avatar" aria-hidden="true">
                  <Loader2 className="spin" size={14} />
                </span>
                <div className="canvas-message__body">Running</div>
              </div>
            ) : null}
          </div>
          <form className="conversation-node__composer nodrag nopan nowheel" onSubmit={onAsk}>
            <textarea
              aria-label="Ask about this node"
              disabled={isAsking}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about this node"
              rows={3}
              value={draft}
            />
            <button className="primary-button" disabled={isAsking || draft.trim().length === 0} type="submit">
              <Send size={16} />
              Ask
            </button>
          </form>
        </>
      ) : (
        <CollapsedNodeBody nodeData={nodeData} />
      )}

      <Handle className="node-handle" position={Position.Bottom} type="source" />
    </article>
  );
}

function CollapsedNodeBody({ nodeData }: { nodeData: ConversationNodeData }) {
  const hasMessages = nodeData.messagePreviews.length > 0;
  const hasBranchHighlights = nodeData.branchHighlights.length > 0;

  return (
    <>
      {nodeData.summary ? <p className="conversation-node__summary">{nodeData.summary}</p> : null}
      <div className="conversation-node__messages nodrag">
        {hasMessages ? (
          nodeData.messagePreviews.map((message) => (
            <div className="conversation-node__message" key={message.id}>
              <span>{message.role.toLowerCase()}</span>
              <p>{truncateText(message.content, 110)}</p>
            </div>
          ))
        ) : (
          <p className="conversation-node__empty">No messages yet</p>
        )}
      </div>
      {hasBranchHighlights ? (
        <div className="conversation-node__highlights nodrag">
          <span>Branch points</span>
          {nodeData.branchHighlights.map((highlight) => (
            <div className="conversation-node__highlight" key={highlight.id} title={highlight.text}>
              <mark>{truncateText(highlight.text, 80)}</mark>
              <Handle
                className="node-handle node-handle--highlight"
                id={branchHighlightHandleId(highlight.id)}
                position={Position.Right}
                type="source"
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function CanvasMessage({
  highlights,
  isBranching,
  message,
  onAssistantSelection,
  onBranch,
  selectionDraft,
}: {
  highlights: Highlight[];
  isBranching: boolean;
  message: Message;
  onAssistantSelection: (message: Message, element: HTMLElement) => void;
  onBranch: () => void;
  selectionDraft: InlineSelectionDraft | null;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isAssistant = message.role === 'ASSISTANT';
  const Icon = isAssistant ? Bot : UserRound;

  const captureSelection = useCallback(() => {
    if (isAssistant && contentRef.current) {
      onAssistantSelection(message, contentRef.current);
    }
  }, [isAssistant, message, onAssistantSelection]);

  return (
    <article className={`canvas-message ${isAssistant ? 'canvas-message--assistant' : 'canvas-message--user'}`}>
      {isAssistant ? (
        <span className="canvas-message__avatar" aria-hidden="true">
          <Icon size={14} />
        </span>
      ) : null}
      <div className="canvas-message__body">
        <div
          className={`canvas-message__content ${isAssistant ? 'canvas-message__content--selectable' : ''}`}
          onKeyUp={captureSelection}
          onMouseUp={captureSelection}
          ref={contentRef}
          tabIndex={isAssistant ? 0 : undefined}
        >
          <HighlightedContent
            content={message.content}
            draftRange={selectionDraft}
            highlights={isAssistant ? highlights : []}
            withHandles={isAssistant}
          />
          {selectionDraft ? (
            <button
              className="inline-branch-button"
              disabled={isBranching}
              onClick={onBranch}
              style={{ left: selectionDraft.toolbarPosition.left, top: selectionDraft.toolbarPosition.top }}
              type="button"
            >
              {isBranching ? <Loader2 className="spin" size={13} /> : <GitBranch size={13} />}
              Branch
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function HighlightedContent({
  content,
  draftRange,
  highlights,
  withHandles,
}: {
  content: string;
  draftRange?: InlineSelectionDraft | null;
  highlights: Highlight[];
  withHandles: boolean;
}) {
  const ranges = normalizeHighlights(content, highlights, draftRange);
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
      <mark
        className={`canvas-message-highlight ${range.isDraft ? 'canvas-message-highlight--draft' : ''}`}
        key={range.id}
      >
        {content.slice(range.startOffset, range.endOffset)}
        {withHandles && !range.isDraft ? (
          <Handle
            className="node-handle node-handle--inline-highlight"
            id={branchHighlightHandleId(range.id)}
            position={Position.Right}
            type="source"
          />
        ) : null}
      </mark>,
    );
    cursor = range.endOffset;
  }

  if (cursor < content.length) {
    parts.push(content.slice(cursor));
  }

  return <>{parts}</>;
}

type RenderedHighlightRange = Pick<Highlight, 'endOffset' | 'id' | 'startOffset'> & {
  isDraft: boolean;
};

function normalizeHighlights(
  content: string,
  highlights: Highlight[],
  draftRange?: InlineSelectionDraft | null,
) {
  const candidates: RenderedHighlightRange[] = [
    ...highlights.map((highlight) => ({ ...highlight, isDraft: false })),
  ];
  if (draftRange) {
    candidates.push({
      endOffset: draftRange.endOffset,
      id: 'draft-selection',
      isDraft: true,
      startOffset: draftRange.startOffset,
    });
  }

  const ranges: RenderedHighlightRange[] = [];
  let cursor = 0;

  for (const highlight of candidates.sort((left, right) => left.startOffset - right.startOffset)) {
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
    height: 220,
    width: 520,
    x: numberOrDefault(parentLayout?.x, 100) + 440,
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
