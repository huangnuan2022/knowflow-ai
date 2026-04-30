import { Handle, NodeProps, NodeResizer, Position, ResizeParams, useUpdateNodeInternals } from '@xyflow/react';
import { Bot, GitBranch, Loader2, MessageSquareText, Send, Trash2, UserRound } from 'lucide-react';
import { FormEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const isExpanded = nodeData.isExpanded;
  const [draft, setDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState(nodeData.title);
  const [summaryDraft, setSummaryDraft] = useState(nodeData.summary ?? '');
  const [selectionDraft, setSelectionDraft] = useState<InlineSelectionDraft | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const sortedMessages = useMemo(
    () => [...nodeData.messages].sort((left, right) => left.sequence - right.sequence),
    [nodeData.messages],
  );
  const highlightHandleKey = useMemo(() => {
    const expandedHighlightIds = sortedMessages.flatMap((message) =>
      (nodeData.highlightsByMessageId[message.id] ?? []).map((highlight) => highlight.id),
    );
    const collapsedHighlightIds = nodeData.branchHighlights.map((highlight) => highlight.id);
    return [...expandedHighlightIds, ...collapsedHighlightIds].sort().join('|');
  }, [nodeData.branchHighlights, nodeData.highlightsByMessageId, sortedMessages]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [highlightHandleKey, id, isExpanded, updateNodeInternals]);

  useEffect(() => {
    setTitleDraft(nodeData.title);
  }, [nodeData.title]);

  useEffect(() => {
    setSummaryDraft(nodeData.summary ?? '');
  }, [nodeData.summary]);

  const saveTitle = useCallback(async () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      setTitleDraft(nodeData.title);
      return;
    }
    if (nextTitle === nodeData.title) {
      return;
    }

    setIsSavingDetails(true);
    setError(null);
    try {
      await nodeData.onNodeDetailsChanged?.(id, { title: nextTitle });
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : 'Unable to save node title');
      setTitleDraft(nodeData.title);
    } finally {
      setIsSavingDetails(false);
    }
  }, [id, nodeData, titleDraft]);

  const saveSummary = useCallback(async () => {
    const nextSummary = summaryDraft.trim();
    const currentSummary = (nodeData.summary ?? '').trim();
    if (nextSummary === currentSummary) {
      return;
    }

    setIsSavingDetails(true);
    setError(null);
    try {
      await nodeData.onNodeDetailsChanged?.(id, { summary: nextSummary.length > 0 ? nextSummary : null });
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : 'Unable to save node summary');
      setSummaryDraft(nodeData.summary ?? '');
    } finally {
      setIsSavingDetails(false);
    }
  }, [id, nodeData, summaryDraft]);

  const onTitleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur();
      }
      if (event.key === 'Escape') {
        setTitleDraft(nodeData.title);
        event.currentTarget.blur();
      }
    },
    [nodeData.title],
  );

  const onSummaryKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        setSummaryDraft(nodeData.summary ?? '');
        event.currentTarget.blur();
      }
    },
    [nodeData.summary],
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
      await nodeData.onBranchCreated?.(result.childNode.id, id);
    } catch (branchError) {
      setError(branchError instanceof Error ? branchError.message : 'Unable to create branch');
    } finally {
      setIsBranching(false);
    }
  }, [id, isBranching, nodeData, selectionDraft]);

  const onDelete = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (isDeleting) {
        return;
      }

      const shouldDelete = window.confirm('Delete this node and its connected edges?');
      if (!shouldDelete) {
        return;
      }

      setIsDeleting(true);
      setError(null);
      try {
        await nodeData.onNodeDeleteRequested?.(id);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete node');
      } finally {
        setIsDeleting(false);
      }
    },
    [id, isDeleting, nodeData],
  );

  const onResizeEnd = useCallback(
    (_: unknown, params: ResizeParams) => {
      void nodeData.onNodeResizeEnded?.(id, {
        height: params.height,
        width: params.width,
        x: params.x,
        y: params.y,
      });
    },
    [id, nodeData],
  );

  return (
    <article className={`conversation-node ${isExpanded ? 'is-selected is-expanded' : ''}`}>
      <NodeResizer
        autoScale={false}
        color="#2563eb"
        handleClassName="node-resizer-handle nodrag nopan"
        isVisible={isExpanded}
        lineClassName="node-resizer-line nodrag nopan"
        minHeight={isExpanded ? 420 : 180}
        minWidth={isExpanded ? 520 : 300}
        onResizeEnd={onResizeEnd}
      />
      <Handle
        className={`node-handle node-handle--manual ${isExpanded ? 'node-handle--manual-hidden' : ''}`}
        isConnectable={!isExpanded}
        position={Position.Top}
        type="target"
      />
      <div className="conversation-node__header">
        <span className="conversation-node__icon" aria-hidden="true">
          <MessageSquareText size={16} />
        </span>
        <div className="conversation-node__title-stack">
          {isExpanded ? (
            <input
              aria-label="Node title"
              className="conversation-node__title-input nodrag nopan"
              disabled={isSavingDetails}
              onBlur={() => void saveTitle()}
              onChange={(event) => setTitleDraft(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={onTitleKeyDown}
              onPointerDown={(event) => event.stopPropagation()}
              spellCheck={false}
              title="Node title"
              value={titleDraft}
            />
          ) : (
            <h2>{nodeData.title}</h2>
          )}
        </div>
        <button
          aria-label={`Delete ${nodeData.title}`}
          className="node-action-button nodrag nopan"
          disabled={isDeleting}
          onClick={onDelete}
          title="Delete node"
          type="button"
        >
          {isDeleting ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
        </button>
      </div>

      {isExpanded ? (
        <>
          <textarea
            aria-label="Node summary"
            className="conversation-node__summary-input nodrag nopan nowheel"
            disabled={isSavingDetails}
            onBlur={() => void saveSummary()}
            onChange={(event) => setSummaryDraft(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={onSummaryKeyDown}
            onPointerDown={(event) => event.stopPropagation()}
            placeholder="Add node summary"
            rows={2}
            value={summaryDraft}
          />
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
                  branchTargetsByHighlightId={nodeData.branchTargetsByHighlightId}
                  key={message.id}
                  message={message}
                  onAssistantSelection={onAssistantSelection}
                  onBranch={onBranch}
                  onBranchTargetSelected={nodeData.onBranchTargetSelected}
                  selectionDraft={selectionDraft?.messageId === message.id ? selectionDraft : null}
                  sourceNodeId={id}
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
        <CollapsedNodeBody nodeData={nodeData} sourceNodeId={id} />
      )}

      <Handle
        className={`node-handle node-handle--manual ${isExpanded ? 'node-handle--manual-hidden' : ''}`}
        isConnectable={!isExpanded}
        position={Position.Bottom}
        type="source"
      />
    </article>
  );
}

function CollapsedNodeBody({
  nodeData,
  sourceNodeId,
}: {
  nodeData: ConversationNodeData;
  sourceNodeId: string;
}) {
  const hasBranchHighlights = nodeData.branchHighlights.length > 0;

  return (
    <>
      {nodeData.summary ? <p className="conversation-node__summary-preview">{nodeData.summary}</p> : null}
      {hasBranchHighlights ? (
        <div className="conversation-node__highlights">
          <span>Branch points</span>
          {nodeData.branchHighlights.map((highlight) => (
            <div className="conversation-node__highlight" key={highlight.id} title={highlight.text}>
              <button
                className="conversation-node__highlight-button nodrag nopan"
                onClick={(event) => {
                  event.stopPropagation();
                  nodeData.onBranchTargetSelected?.(highlight.targetNodeId, sourceNodeId);
                }}
                type="button"
              >
                {truncateText(highlight.text, 80)}
              </button>
              <Handle
                className="node-handle node-handle--highlight"
                id={branchHighlightHandleId(highlight.id)}
                isConnectable={false}
                position={Position.Right}
                type="source"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="conversation-node__empty">No branch points yet</p>
      )}
    </>
  );
}

function CanvasMessage({
  branchTargetsByHighlightId,
  highlights,
  isBranching,
  message,
  onAssistantSelection,
  onBranch,
  onBranchTargetSelected,
  selectionDraft,
  sourceNodeId,
}: {
  branchTargetsByHighlightId: Record<string, string>;
  highlights: Highlight[];
  isBranching: boolean;
  message: Message;
  onAssistantSelection: (message: Message, element: HTMLElement) => void;
  onBranch: () => void;
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  selectionDraft: InlineSelectionDraft | null;
  sourceNodeId: string;
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
            branchTargetsByHighlightId={branchTargetsByHighlightId}
            content={message.content}
            draftRange={selectionDraft}
            highlights={isAssistant ? highlights : []}
            onBranchTargetSelected={onBranchTargetSelected}
            sourceNodeId={sourceNodeId}
            withHandles={isAssistant}
          />
          {selectionDraft ? (
            <button
              className="inline-branch-button"
              disabled={isBranching}
              onClick={(event) => {
                event.stopPropagation();
                void onBranch();
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onMouseUp={(event) => event.stopPropagation()}
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
  branchTargetsByHighlightId,
  content,
  draftRange,
  highlights,
  onBranchTargetSelected,
  sourceNodeId,
  withHandles,
}: {
  branchTargetsByHighlightId: Record<string, string>;
  content: string;
  draftRange?: InlineSelectionDraft | null;
  highlights: Highlight[];
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  sourceNodeId: string;
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

    const targetNodeId = branchTargetsByHighlightId[range.id];
    const canJumpToBranch = !range.isDraft && Boolean(targetNodeId);

    parts.push(
      <mark
        className={[
          'canvas-message-highlight',
          range.isDraft ? 'canvas-message-highlight--draft' : '',
          canJumpToBranch ? 'canvas-message-highlight--jumpable' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        key={range.id}
        onClick={
          canJumpToBranch
            ? (event) => {
                event.stopPropagation();
                onBranchTargetSelected?.(targetNodeId, sourceNodeId);
              }
            : undefined
        }
        onKeyDown={
          canJumpToBranch
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onBranchTargetSelected?.(targetNodeId, sourceNodeId);
                }
              }
            : undefined
        }
        role={canJumpToBranch ? 'button' : undefined}
        tabIndex={canJumpToBranch ? 0 : undefined}
        title={canJumpToBranch ? 'Jump to branch node' : undefined}
      >
        {content.slice(range.startOffset, range.endOffset)}
        {withHandles && !range.isDraft ? (
          <Handle
            className="node-handle node-handle--inline-highlight"
            id={branchHighlightHandleId(range.id)}
            isConnectable={false}
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
    x: numberOrDefault(parentLayout?.x, 100) + 680,
    y: numberOrDefault(parentLayout?.y, 120) + 72,
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
