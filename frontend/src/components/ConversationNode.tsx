import { Handle, NodeProps, NodeResizer, Position, ResizeParams, useUpdateNodeInternals } from '@xyflow/react';
import { Bot, ChevronDown, ChevronRight, GitBranch, Loader2, MessageSquareText, Send, Trash2, UserRound } from 'lucide-react';
import {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { createBranchFromSelection, createRun, createUserMessage, executeRun } from '../lib/api';
import { Highlight, Message, NodeLayout } from '../lib/domain';
import {
  BranchColor,
  BranchTargetPreview,
  branchHighlightHandleId,
  branchTargetHandleIdForSide,
  ConversationNodeData,
  colorForHighlightId,
  manualHandleSides,
  manualNodeHandleId,
  ManualHandleSide,
} from '../lib/reactFlowAdapter';
import { findReaderSyncAnchor, scrollReaderToAnchor } from '../lib/readerSync';
import { readTextSelectionWithin, TextSelectionRange } from '../lib/textSelection';

type InlineSelectionDraft = TextSelectionRange & {
  messageId: string;
  toolbarPosition: {
    left: number;
    top: number;
  };
};

type HighlightAnchorState = {
  visibility: 'above' | 'below' | 'visible';
  y?: number;
};

type HighlightMenuState = {
  id: string;
  left: number;
  top: number;
};

type BranchPointMenuState = {
  highlightId: string;
  left: number;
  top: number;
};

export function ConversationNode({ data, id, selected }: NodeProps) {
  const nodeData = data as ConversationNodeData;
  const isExpanded = nodeData.isExpanded;
  const editableSummary = useMemo(
    () => getEditableSummary(nodeData.summary, nodeData.branchContext?.text),
    [nodeData.branchContext?.text, nodeData.summary],
  );
  const [draft, setDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState(nodeData.title);
  const [summaryDraft, setSummaryDraft] = useState(editableSummary ?? '');
  const [selectionDraft, setSelectionDraft] = useState<InlineSelectionDraft | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [highlightAnchorStates, setHighlightAnchorStates] = useState<Record<string, HighlightAnchorState>>({});
  const [revealedHighlightId, setRevealedHighlightId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nodeRef = useRef<HTMLElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const isApplyingReaderSyncRef = useRef(false);
  const lastReaderSyncKeyRef = useRef('');
  const scrollFrameRef = useRef<number | null>(null);
  const readerSyncFrameRef = useRef<number | null>(null);
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeAccentStyle = useMemo(
    () => (nodeData.accentColor ? branchColorStyle(nodeData.accentColor, 'node') : undefined),
    [nodeData.accentColor],
  );
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
  const highlightAnchorStateKey = useMemo(
    () =>
      Object.entries(highlightAnchorStates)
        .map(([highlightId, state]) => `${highlightId}:${state.visibility}:${Math.round(state.y ?? 0)}`)
        .sort()
        .join('|'),
    [highlightAnchorStates],
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [highlightHandleKey, id, isExpanded, updateNodeInternals]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, isContextExpanded, updateNodeInternals]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [highlightAnchorStateKey, id, updateNodeInternals]);

  useEffect(() => {
    setIsContextExpanded(false);
  }, [id, nodeData.branchContext?.text]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
      if (readerSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(readerSyncFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setTitleDraft(nodeData.title);
  }, [nodeData.title]);

  useEffect(() => {
    setSummaryDraft(editableSummary ?? '');
  }, [editableSummary]);

  useEffect(() => {
    if (!isExpanded || !nodeData.revealHighlightId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const highlightElement = nodeRef.current?.querySelector<HTMLElement>(
        `[data-highlight-id="${nodeData.revealHighlightId}"]`,
      );
      highlightElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
      setRevealedHighlightId(nodeData.revealHighlightId ?? null);
      window.setTimeout(() => setRevealedHighlightId(null), 1400);
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [isExpanded, nodeData.revealHighlightId, nodeData.revealHighlightRequestId]);

  const refreshHighlightAnchorStates = useCallback(() => {
    if (!isExpanded || !nodeRef.current || !threadRef.current) {
      setHighlightAnchorStates({});
      return;
    }

    const nodeRect = nodeRef.current.getBoundingClientRect();
    const threadRect = threadRef.current.getBoundingClientRect();
    const nextStates: Record<string, HighlightAnchorState> = {};

    nodeRef.current.querySelectorAll<HTMLElement>('[data-highlight-id]').forEach((element) => {
      const highlightId = element.dataset.highlightId;
      if (!highlightId) {
        return;
      }

      const highlightRect = element.getBoundingClientRect();
      const isVisible =
        highlightRect.bottom > threadRect.top &&
        highlightRect.top < threadRect.bottom &&
        highlightRect.right > threadRect.left &&
        highlightRect.left < threadRect.right;

      if (isVisible) {
        nextStates[highlightId] = { visibility: 'visible' };
        return;
      }

      if (highlightRect.bottom <= threadRect.top) {
        nextStates[highlightId] = {
          visibility: 'above',
          y: Math.max(24, threadRect.top - nodeRect.top + 10),
        };
        return;
      }

      nextStates[highlightId] = {
        visibility: 'below',
        y: Math.min(nodeRect.height - 24, threadRect.bottom - nodeRect.top - 10),
      };
    });

    setHighlightAnchorStates((currentStates) =>
      areHighlightAnchorStatesEqual(currentStates, nextStates) ? currentStates : nextStates,
    );
    nodeData.onVisibleBranchHighlightsChanged?.(
      id,
      Object.entries(nextStates)
        .filter(([, state]) => state.visibility === 'visible')
        .map(([highlightId]) => highlightId),
    );
  }, [id, isExpanded, nodeData]);

  useEffect(() => {
    refreshHighlightAnchorStates();
  }, [highlightHandleKey, isContextExpanded, refreshHighlightAnchorStates, sortedMessages]);

  useEffect(() => {
    const anchor = nodeData.readerSyncAnchor;
    if (!isExpanded || !anchor || anchor.nodeId !== id || anchor.source === 'canvas' || !threadRef.current) {
      return;
    }

    isApplyingReaderSyncRef.current = true;
    scrollReaderToAnchor(threadRef.current, '[data-reader-message-id]', anchor);
    const timeoutId = window.setTimeout(() => {
      isApplyingReaderSyncRef.current = false;
    }, 160);

    return () => window.clearTimeout(timeoutId);
  }, [id, isExpanded, nodeData.readerSyncAnchor]);

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
    const currentSummary = (editableSummary ?? '').trim();
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
  }, [editableSummary, id, nodeData, summaryDraft]);

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

  useEffect(() => {
    if (!selectionDraft) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (
        target.closest('.inline-branch-button') ||
        target.closest('.canvas-message__content') ||
        target.closest('.highlight-branch-menu') ||
        target.closest('.branch-point-menu')
      ) {
        return;
      }

      setSelectionDraft(null);
      window.getSelection()?.removeAllRanges();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [selectionDraft]);

  useEffect(() => {
    if (!isExpanded && selectionDraft) {
      setSelectionDraft(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [isExpanded, selectionDraft]);

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

  const onBranchFromHighlight = useCallback(
    async (highlight: Highlight) => {
      if (isBranching) {
        return;
      }

      setIsBranching(true);
      setError(null);
      try {
        const result = await createBranchFromSelection({
          childNode: {
            layout: buildChildLayout(nodeData.layout),
            title: `Branch: ${truncateText(highlight.selectedTextSnapshot, 44)}`,
          },
          context: {
            tokenEstimate: estimateTokenCount(highlight.selectedTextSnapshot),
          },
          endOffset: highlight.endOffset,
          messageId: highlight.messageId,
          selectedTextSnapshot: highlight.selectedTextSnapshot,
          sourceHighlightId: highlight.id,
          startOffset: highlight.startOffset,
        });

        setSelectionDraft(null);
        window.getSelection()?.removeAllRanges();
        await nodeData.onBranchCreated?.(result.childNode.id, id);
      } catch (branchError) {
        setError(branchError instanceof Error ? branchError.message : 'Unable to create branch');
      } finally {
        setIsBranching(false);
      }
    },
    [id, isBranching, nodeData],
  );

  const onDelete = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (isDeleting) {
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

  const onScrollableContentScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      refreshHighlightAnchorStates();
      updateNodeInternals(id);

      if (isExpanded && threadRef.current && !isApplyingReaderSyncRef.current) {
        const anchor = findReaderSyncAnchor(
          threadRef.current,
          '[data-reader-message-id]',
          id,
          'canvas',
          Date.now(),
        );
        if (anchor) {
          const syncKey = `${anchor.messageId}:${Math.round(anchor.ratio * 20)}`;
          if (syncKey !== lastReaderSyncKeyRef.current) {
            lastReaderSyncKeyRef.current = syncKey;
            nodeData.onReaderSyncAnchorChanged?.(anchor);
          }
        }
      }
    });
  }, [id, isExpanded, nodeData, refreshHighlightAnchorStates, updateNodeInternals]);

  return (
    <article
      className={[
        'conversation-node',
        isExpanded ? 'is-selected is-expanded' : '',
        selected ? 'is-flow-selected' : '',
        nodeData.accentColor ? 'has-branch-accent' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={nodeAccentStyle}
      ref={nodeRef}
      data-testid="conversation-node"
    >
      <NodeResizer
        autoScale={false}
        color="#2563eb"
        handleClassName="node-resizer-handle nodrag nopan"
        isVisible
        lineClassName="node-resizer-line nodrag nopan"
        minHeight={isExpanded ? 420 : 180}
        minWidth={isExpanded ? 520 : 300}
        onResizeEnd={onResizeEnd}
      />
      {manualHandleSides.map((side) => (
        <Handle
          className={`node-handle node-handle--branch-target node-handle--branch-target-${side}`}
          id={branchTargetHandleIdForSide(side)}
          isConnectable={false}
          key={`branch-target-${side}`}
          position={manualHandlePosition(side)}
          type="target"
        />
      ))}
      {manualHandleSides.map((side) => (
        <Handle
          className={`node-handle node-handle--manual node-handle--manual-target node-handle--manual-${side}`}
          id={manualNodeHandleId('target', side)}
          isConnectable
          key={`manual-target-${side}`}
          position={manualHandlePosition(side)}
          type="target"
        />
      ))}
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
            <section
              className={`conversation-node__context ${isContextExpanded ? 'is-expanded' : ''} nodrag nopan nowheel`}
            >
              <div className="conversation-node__context-row">
                <button
                  className="conversation-node__context-toggle"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (nodeData.branchContext?.highlightId) {
                      nodeData.onBranchSourceSelected?.(
                        nodeData.branchContext.sourceNodeId,
                        nodeData.branchContext.highlightId,
                      );
                      return;
                    }

                    setIsContextExpanded((current) => !current);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={
                    nodeData.branchContext.highlightId
                      ? 'Show the source highlight that created this branch'
                      : 'Show branch context'
                  }
                  type="button"
                >
                  <span>Branch context</span>
                  <strong>{truncateText(nodeData.branchContext.text, 88)}</strong>
                </button>
                <button
                  aria-expanded={isContextExpanded}
                  aria-label={isContextExpanded ? 'Hide branch context' : 'Show branch context'}
                  className="conversation-node__context-expand"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsContextExpanded((current) => !current);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  {isContextExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              </div>
              {isContextExpanded ? <p>{nodeData.branchContext.text}</p> : null}
            </section>
          ) : null}
          <div
            className="conversation-node__thread nodrag nopan nowheel"
            onScroll={onScrollableContentScroll}
            ref={threadRef}
          >
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
                  onBranchFromHighlight={onBranchFromHighlight}
                  onBranchTargetSelected={nodeData.onBranchTargetSelected}
                  highlightAnchorStates={highlightAnchorStates}
                  revealedHighlightId={revealedHighlightId}
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
        <CollapsedNodeBody
          nodeData={nodeData}
          onScrollableContentScroll={onScrollableContentScroll}
          sourceNodeId={id}
        />
      )}

      {manualHandleSides.map((side) => (
        <Handle
          className={`node-handle node-handle--manual node-handle--manual-source node-handle--manual-${side}`}
          id={manualNodeHandleId('source', side)}
          isConnectable
          key={`manual-source-${side}`}
          position={manualHandlePosition(side)}
          type="source"
        />
      ))}
    </article>
  );
}

function manualHandlePosition(side: ManualHandleSide) {
  switch (side) {
    case 'top':
      return Position.Top;
    case 'right':
      return Position.Right;
    case 'bottom':
      return Position.Bottom;
    case 'left':
      return Position.Left;
  }
}

function CollapsedNodeBody({
  nodeData,
  onScrollableContentScroll,
  sourceNodeId,
}: {
  nodeData: ConversationNodeData;
  onScrollableContentScroll: () => void;
  sourceNodeId: string;
}) {
  const hasBranchHighlights = nodeData.branchHighlights.length > 0;
  const editableSummary = getEditableSummary(nodeData.summary, nodeData.branchContext?.text);
  const branchListRef = useRef<HTMLDivElement>(null);
  const visibilityFrameRef = useRef<number | null>(null);
  const [openBranchPointMenu, setOpenBranchPointMenu] = useState<BranchPointMenuState | null>(null);
  const openBranchPoint = useMemo(
    () => nodeData.branchHighlights.find((highlight) => highlight.id === openBranchPointMenu?.highlightId) ?? null,
    [nodeData.branchHighlights, openBranchPointMenu?.highlightId],
  );

  const reportVisibleBranchHighlights = useCallback(() => {
    if (!hasBranchHighlights) {
      nodeData.onVisibleBranchHighlightsChanged?.(sourceNodeId, []);
      return;
    }

    if (!branchListRef.current) {
      nodeData.onVisibleBranchHighlightsChanged?.(
        sourceNodeId,
        nodeData.branchHighlights.map((highlight) => highlight.id),
      );
      return;
    }

    const listRect = branchListRef.current.getBoundingClientRect();
    const visibleHighlightIds = Array.from(
      branchListRef.current.querySelectorAll<HTMLElement>('[data-branch-highlight-id]'),
    )
      .filter((element) => {
        const itemRect = element.getBoundingClientRect();
        return itemRect.bottom > listRect.top && itemRect.top < listRect.bottom;
      })
      .map((element) => element.dataset.branchHighlightId)
      .filter((highlightId): highlightId is string => Boolean(highlightId));

    nodeData.onVisibleBranchHighlightsChanged?.(sourceNodeId, visibleHighlightIds);
  }, [hasBranchHighlights, nodeData, sourceNodeId]);

  const onBranchListScroll = useCallback(() => {
    onScrollableContentScroll();
    if (visibilityFrameRef.current !== null) {
      return;
    }

    visibilityFrameRef.current = window.requestAnimationFrame(() => {
      visibilityFrameRef.current = null;
      reportVisibleBranchHighlights();
    });
  }, [onScrollableContentScroll, reportVisibleBranchHighlights]);

  useEffect(() => {
    reportVisibleBranchHighlights();
  }, [reportVisibleBranchHighlights]);

  useEffect(() => {
    if (!openBranchPointMenu) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('.branch-point-menu') || target.closest('[data-branch-highlight-id]')) {
        return;
      }

      setOpenBranchPointMenu(null);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openBranchPointMenu]);

  useEffect(
    () => () => {
      if (visibilityFrameRef.current !== null) {
        window.cancelAnimationFrame(visibilityFrameRef.current);
      }
    },
    [],
  );

  return (
    <>
      {editableSummary ? <p className="conversation-node__summary-preview">{editableSummary}</p> : null}
      {!editableSummary && nodeData.branchContext ? (
        <p className="conversation-node__branch-context-preview">
          <span>Branch context:</span> {truncateText(nodeData.branchContext.text, 96)}
        </p>
      ) : null}
      {hasBranchHighlights ? (
        <div
          className={`conversation-node__highlights nodrag nopan nowheel ${hasBranchHighlights ? 'is-scrollable' : ''}`}
          onScroll={onBranchListScroll}
          onWheel={(event) => event.stopPropagation()}
          ref={branchListRef}
        >
          <span>Branch points</span>
          {nodeData.branchHighlights.map((highlight) => (
            <div
              className="conversation-node__highlight"
              data-branch-highlight-id={highlight.id}
              key={highlight.id}
              style={branchColorStyle(highlight.color, 'highlight')}
              title={highlight.text}
            >
              <button
                className="conversation-node__highlight-button nodrag nopan"
                onClick={(event) => {
                  event.stopPropagation();
                  if (highlight.branches.length > 0) {
                    setOpenBranchPointMenu({
                      highlightId: highlight.id,
                      ...menuPositionForRect(event.currentTarget.getBoundingClientRect()),
                    });
                  }
                }}
                disabled={highlight.branches.length === 0}
                type="button"
              >
                {truncateText(highlight.text, 80)}
                {highlight.branches.length > 1 ? (
                  <span className="conversation-node__highlight-count">{highlight.branches.length}</span>
                ) : null}
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
          {openBranchPoint && openBranchPointMenu ? (
            <BranchPointTargetMenu
              branchTargets={openBranchPoint.branches}
              color={openBranchPoint.color}
              onClose={() => setOpenBranchPointMenu(null)}
              onShowSourceHighlight={() => {
                setOpenBranchPointMenu(null);
                nodeData.onBranchSourceSelected?.(sourceNodeId, openBranchPoint.id);
              }}
              onJumpToBranch={(targetNodeId) => {
                setOpenBranchPointMenu(null);
                nodeData.onBranchTargetSelected?.(targetNodeId, sourceNodeId);
              }}
              position={openBranchPointMenu}
            />
          ) : null}
        </div>
      ) : (
        <p className="conversation-node__empty">No branch points yet</p>
      )}
    </>
  );
}

function BranchPointTargetMenu({
  branchTargets,
  color,
  onClose,
  onJumpToBranch,
  onShowSourceHighlight,
  position,
}: {
  branchTargets: BranchTargetPreview[];
  color?: BranchColor;
  onClose: () => void;
  onJumpToBranch: (targetNodeId: string) => void;
  onShowSourceHighlight: () => void;
  position: BranchPointMenuState;
}) {
  return createPortal(
    <span
      className="highlight-branch-menu branch-point-menu nodrag nopan"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      role="menu"
      style={{
        left: position.left,
        top: position.top,
        ...(color ? branchColorStyle(color, 'highlight') : {}),
      }}
    >
      <span className="highlight-branch-menu__title">Choose branch</span>
      <button onClick={onShowSourceHighlight} type="button">
        Show source highlight
      </button>
      <span className="highlight-branch-menu__targets">
        {branchTargets.map((target, index) => (
          <button key={target.edgeId} onClick={() => onJumpToBranch(target.nodeId)} type="button">
            {branchTargets.length === 1 ? 'Jump to branch node' : `${index + 1}. ${truncateText(target.title, 42)}`}
          </button>
        ))}
      </span>
      <button className="highlight-branch-menu__secondary" onClick={onClose} type="button">
        Close
      </button>
    </span>,
    document.body,
  );
}

function CanvasMessage({
  branchTargetsByHighlightId,
  highlightAnchorStates,
  highlights,
  isBranching,
  message,
  onAssistantSelection,
  onBranch,
  onBranchFromHighlight,
  onBranchTargetSelected,
  revealedHighlightId,
  selectionDraft,
  sourceNodeId,
}: {
  branchTargetsByHighlightId: Record<string, BranchTargetPreview[]>;
  highlightAnchorStates: Record<string, HighlightAnchorState>;
  highlights: Highlight[];
  isBranching: boolean;
  message: Message;
  onAssistantSelection: (message: Message, element: HTMLElement) => void;
  onBranch: () => void;
  onBranchFromHighlight: (highlight: Highlight) => void;
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  revealedHighlightId?: string | null;
  selectionDraft: InlineSelectionDraft | null;
  sourceNodeId: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isAssistant = message.role === 'ASSISTANT';
  const Icon = isAssistant ? Bot : UserRound;
  const branchBackedHighlights = useMemo(
    () => highlights.filter((highlight) => (branchTargetsByHighlightId[highlight.id]?.length ?? 0) > 0),
    [branchTargetsByHighlightId, highlights],
  );

  const captureSelection = useCallback(() => {
    if (isAssistant && contentRef.current) {
      onAssistantSelection(message, contentRef.current);
    }
  }, [isAssistant, message, onAssistantSelection]);

  return (
    <article
      className={`canvas-message ${isAssistant ? 'canvas-message--assistant' : 'canvas-message--user'}`}
      data-reader-message-id={message.id}
    >
      {isAssistant ? (
        <span className="canvas-message__avatar" aria-hidden="true">
          <Icon size={14} />
        </span>
      ) : null}
      <div className="canvas-message__body">
        <div
          className={`canvas-message__content ${isAssistant ? 'canvas-message__content--selectable' : ''}`}
          data-testid="canvas-message-content"
          onKeyUp={captureSelection}
          onMouseUp={captureSelection}
          ref={contentRef}
          tabIndex={isAssistant ? 0 : undefined}
        >
          <HighlightedContent
            branchTargetsByHighlightId={branchTargetsByHighlightId}
            content={message.content}
            draftRange={selectionDraft}
            highlightAnchorStates={highlightAnchorStates}
            highlights={isAssistant ? branchBackedHighlights : []}
            isBranching={isBranching}
            onBranchFromHighlight={onBranchFromHighlight}
            onBranchTargetSelected={onBranchTargetSelected}
            revealedHighlightId={revealedHighlightId}
            sourceNodeId={sourceNodeId}
            withHandles={isAssistant}
          />
          {selectionDraft ? (
            <button
              className="inline-branch-button"
              data-testid="inline-branch-button"
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
  highlightAnchorStates,
  highlights,
  isBranching,
  onBranchFromHighlight,
  onBranchTargetSelected,
  revealedHighlightId,
  sourceNodeId,
  withHandles,
}: {
  branchTargetsByHighlightId: Record<string, BranchTargetPreview[]>;
  content: string;
  draftRange?: InlineSelectionDraft | null;
  highlightAnchorStates: Record<string, HighlightAnchorState>;
  highlights: Highlight[];
  isBranching: boolean;
  onBranchFromHighlight: (highlight: Highlight) => void;
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  revealedHighlightId?: string | null;
  sourceNodeId: string;
  withHandles: boolean;
}) {
  const [openHighlightMenu, setOpenHighlightMenu] = useState<HighlightMenuState | null>(null);
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

    const branchTargets = branchTargetsByHighlightId[range.id] ?? [];
    const canOpenBranchMenu = !range.isDraft;
    const isMenuOpen = openHighlightMenu?.id === range.id;
    const shouldRenderInlineHandle = withHandles && !range.isDraft && highlightAnchorStates[range.id]?.visibility !== 'above' && highlightAnchorStates[range.id]?.visibility !== 'below';

    parts.push(
      <span
        className="canvas-message-highlight-wrap"
        key={range.id}
        style={range.color ? branchColorStyle(range.color, 'highlight') : undefined}
      >
        <mark
          aria-expanded={canOpenBranchMenu ? isMenuOpen : undefined}
          aria-haspopup={canOpenBranchMenu ? 'menu' : undefined}
          className={[
            'canvas-message-highlight',
            range.isDraft ? 'canvas-message-highlight--draft' : '',
            canOpenBranchMenu ? 'canvas-message-highlight--menu-trigger' : '',
            range.id === revealedHighlightId ? 'canvas-message-highlight--revealed' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={
            canOpenBranchMenu
              ? (event) => {
                  event.stopPropagation();
                  const position = menuPositionForRect(event.currentTarget.getBoundingClientRect());
                  setOpenHighlightMenu((currentMenu) =>
                    currentMenu?.id === range.id ? null : { id: range.id, ...position },
                  );
                }
              : undefined
          }
          onKeyDown={
            canOpenBranchMenu
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    const position = menuPositionForRect(event.currentTarget.getBoundingClientRect());
                    setOpenHighlightMenu((currentMenu) =>
                      currentMenu?.id === range.id ? null : { id: range.id, ...position },
                    );
                  }
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    setOpenHighlightMenu(null);
                  }
                }
              : undefined
          }
          onMouseUp={canOpenBranchMenu ? (event) => event.stopPropagation() : undefined}
          role={canOpenBranchMenu ? 'button' : undefined}
          data-highlight-id={canOpenBranchMenu ? range.id : undefined}
          data-testid={canOpenBranchMenu ? 'branch-highlight' : undefined}
          tabIndex={canOpenBranchMenu ? 0 : undefined}
          title={canOpenBranchMenu ? 'Open branch actions' : undefined}
        >
          {content.slice(range.startOffset, range.endOffset)}
          {shouldRenderInlineHandle ? (
            <Handle
              className="node-handle node-handle--inline-highlight"
              id={branchHighlightHandleId(range.id)}
              isConnectable={false}
              position={Position.Right}
              type="source"
            />
          ) : null}
        </mark>
        {isMenuOpen ? (
          <BranchHighlightMenu
            branchTargets={branchTargets}
            color={range.color}
            isBranching={isBranching}
            onBranchFromHighlight={() => {
              setOpenHighlightMenu(null);
              onBranchFromHighlight(range);
            }}
            onClose={() => setOpenHighlightMenu(null)}
            onJumpToBranch={(targetNodeId) => {
              setOpenHighlightMenu(null);
              onBranchTargetSelected?.(targetNodeId, sourceNodeId);
            }}
            position={openHighlightMenu}
          />
        ) : null}
      </span>,
    );
    cursor = range.endOffset;
  }

  if (cursor < content.length) {
    parts.push(content.slice(cursor));
  }

  return <>{parts}</>;
}

function BranchHighlightMenu({
  branchTargets,
  color,
  isBranching,
  onBranchFromHighlight,
  onClose,
  onJumpToBranch,
  position,
}: {
  branchTargets: BranchTargetPreview[];
  color?: BranchColor;
  isBranching: boolean;
  onBranchFromHighlight: () => void;
  onClose: () => void;
  onJumpToBranch: (targetNodeId: string) => void;
  position: HighlightMenuState | null;
}) {
  if (!position) {
    return null;
  }

  return createPortal(
    <span
      className="highlight-branch-menu nodrag nopan"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      role="menu"
      style={{
        left: position.left,
        top: position.top,
        ...(color ? branchColorStyle(color, 'highlight') : {}),
      }}
    >
      <span className="highlight-branch-menu__title">Branch from highlight</span>
      {branchTargets.length > 0 ? (
        <span className="highlight-branch-menu__targets">
          {branchTargets.map((target, index) => (
            <button key={target.edgeId} onClick={() => onJumpToBranch(target.nodeId)} type="button">
              {branchTargets.length === 1 ? 'Jump to existing branch' : `${index + 1}. ${truncateText(target.title, 42)}`}
            </button>
          ))}
        </span>
      ) : (
        <span className="highlight-branch-menu__empty">No existing branch</span>
      )}
      <button disabled={isBranching} onClick={onBranchFromHighlight} type="button">
        {isBranching ? <Loader2 className="spin" size={13} /> : <GitBranch size={13} />}
        New branch from this highlight
      </button>
      <button className="highlight-branch-menu__secondary" onClick={onClose} type="button">
        Close
      </button>
    </span>,
    document.body,
  );
}

type RenderedHighlightRange = Pick<
  Highlight,
  'anchorVersion' | 'endOffset' | 'id' | 'messageId' | 'selectedTextSnapshot' | 'startOffset'
> & {
  color?: BranchColor;
  isDraft: boolean;
};

function normalizeHighlights(
  content: string,
  highlights: Highlight[],
  draftRange?: InlineSelectionDraft | null,
) {
  const candidates: RenderedHighlightRange[] = [
    ...highlights.map((highlight) => ({
      ...highlight,
      color: colorForHighlightId(highlight.id),
      isDraft: false,
    })),
  ];
  if (draftRange) {
    candidates.push({
      anchorVersion: 0,
      endOffset: draftRange.endOffset,
      id: 'draft-selection',
      isDraft: true,
      messageId: draftRange.messageId,
      selectedTextSnapshot: draftRange.selectedTextSnapshot,
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

function branchColorStyle(color: BranchColor, scope: 'highlight' | 'node'): CSSProperties {
  if (scope === 'node') {
    return {
      '--node-accent': color.edge,
      '--node-accent-border': color.border,
      '--node-accent-soft': color.softBackground,
      '--node-accent-text': color.text,
    } as CSSProperties;
  }

  return {
    '--highlight-bg': color.background,
    '--highlight-border': color.border,
    '--highlight-edge': color.edge,
    '--highlight-soft-bg': color.softBackground,
    '--highlight-text': color.text,
  } as CSSProperties;
}

function areHighlightAnchorStatesEqual(
  left: Record<string, HighlightAnchorState>,
  right: Record<string, HighlightAnchorState>,
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => {
    const leftState = left[key];
    const rightState = right[key];
    return (
      Boolean(rightState) &&
      leftState.visibility === rightState.visibility &&
      Math.round(leftState.y ?? 0) === Math.round(rightState.y ?? 0)
    );
  });
}

function menuPositionForRect(rect: DOMRect) {
  const menuWidth = 244;
  const menuHeight = 190;
  const viewportPadding = 12;
  const rightSideLeft = rect.right + 8;
  const leftSideLeft = rect.left - menuWidth - 8;
  const left =
    rightSideLeft + menuWidth <= window.innerWidth - viewportPadding
      ? rightSideLeft
      : Math.max(viewportPadding, leftSideLeft);
  const top = Math.min(
    Math.max(viewportPadding, rect.bottom + 6),
    Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding),
  );

  return { left, top };
}

function getEditableSummary(summary?: string | null, branchContext?: string) {
  if (!summary) {
    return null;
  }

  const compactSummary = summary.trim();
  if (!compactSummary) {
    return null;
  }

  if (!branchContext || !compactSummary.toLowerCase().startsWith('selected context:')) {
    return compactSummary;
  }

  const generatedContext = compactSummary.replace(/^selected context:\s*/i, '').trim();
  const compactBranchContext = branchContext.trim();
  const branchContextPreview = truncateText(compactBranchContext, 96);

  if (
    generatedContext === compactBranchContext ||
    generatedContext === branchContextPreview ||
    compactBranchContext.startsWith(generatedContext.replace(/\.\.\.$/, ''))
  ) {
    return null;
  }

  return compactSummary;
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
