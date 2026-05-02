import { Edge, MarkerType, Node } from '@xyflow/react';
import { DomainEdge, DomainNode, EdgeType, GraphBundle, Highlight, Message, MessageRole, NodeLayout } from './domain';

export type NodeMessagePreview = {
  id: string;
  role: MessageRole;
  content: string;
  sequence: number;
};

export type BranchHighlightPreview = {
  color: BranchColor;
  branches: BranchTargetPreview[];
  id: string;
  text: string;
};

export type BranchTargetPreview = {
  edgeId: string;
  nodeId: string;
  title: string;
};

export type BranchLearningPathItem = {
  label: string;
  nodeId: string;
};

export type BranchContextPreview = {
  color?: BranchColor;
  highlightId?: string;
  learningPath: BranchLearningPathItem[];
  sourceNodeId: string;
  sourceText: string;
  text: string;
};

export type BranchColor = {
  background: string;
  border: string;
  edge: string;
  softBackground: string;
  text: string;
};

export type EdgeAvoidRect = {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
};

export type ConversationNodeActions = {
  onBranchCreated?: (childNodeId: string, sourceNodeId: string, sourceHighlightId?: string) => Promise<void> | void;
  onBranchSourceSelected?: (sourceNodeId: string, highlightId: string) => void;
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  onNodeDetailsChanged?: (nodeId: string, input: { title?: string; summary?: string | null }) => Promise<void> | void;
  onNodeDeleteRequested?: (nodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
  onNodeMaximizeToggled?: (nodeId: string) => void;
  onNodeResizeEnded?: (nodeId: string, layout: Required<NodeLayout>) => Promise<void> | void;
  onVisibleBranchHighlightsChanged?: (nodeId: string, visibleHighlightIds: string[]) => void;
};

export type ConversationNodeData = Record<string, unknown> & {
  accentColor?: BranchColor;
  branchContext?: BranchContextPreview;
  branchHighlights: BranchHighlightPreview[];
  branchTargetsByHighlightId: Record<string, BranchTargetPreview[]>;
  highlightsByMessageId: Record<string, Highlight[]>;
  isExpanded: boolean;
  isMaximized?: boolean;
  layout?: NodeLayout | null;
  messages: Message[];
  messageCount: number;
  messagePreviews: NodeMessagePreview[];
  onBranchCreated?: (childNodeId: string, sourceNodeId: string, sourceHighlightId?: string) => Promise<void> | void;
  onBranchSourceSelected?: (sourceNodeId: string, highlightId: string) => void;
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  onNodeDetailsChanged?: (nodeId: string, input: { title?: string; summary?: string | null }) => Promise<void> | void;
  onNodeDeleteRequested?: (nodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
  onNodeMaximizeToggled?: (nodeId: string) => void;
  onNodeResizeEnded?: (nodeId: string, layout: Required<NodeLayout>) => Promise<void> | void;
  onVisibleBranchHighlightsChanged?: (nodeId: string, visibleHighlightIds: string[]) => void;
  summary?: string | null;
  title: string;
  type: string;
  revealHighlightId?: string | null;
  revealHighlightRequestId?: number | null;
};

export type ConversationFlowNode = Node<ConversationNodeData>;

export type KnowFlowEdgeData = Record<string, unknown> & {
  avoidRects?: EdgeAvoidRect[];
  color?: BranchColor;
  edgeType: EdgeType;
  isDimmed?: boolean;
  isFocused?: boolean;
  isRelatedToSelected?: boolean;
  label?: string | null;
  onEdgeDeleteRequested?: (edgeId: string) => Promise<void> | void;
  onEdgeLabelChanged?: (edgeId: string, label: string) => Promise<void> | void;
};

export type ConversationFlowEdge = Edge<KnowFlowEdgeData>;

export type ConversationEdgeActions = {
  onEdgeDeleteRequested?: (edgeId: string) => Promise<void> | void;
  onEdgeLabelChanged?: (edgeId: string, label: string) => Promise<void> | void;
};

export const manualHandleSides = ['top', 'right', 'bottom', 'left'] as const;
export type ManualHandleSide = (typeof manualHandleSides)[number];

export const branchTargetHandleId = 'branch-target';
export const manualSourceHandleId = manualNodeHandleId('source', 'right');
export const manualTargetHandleId = manualNodeHandleId('target', 'left');

export function branchHighlightHandleId(highlightId: string) {
  return `branch-highlight-${highlightId}`;
}

export function branchTargetHandleIdForSide(side: ManualHandleSide) {
  return `${branchTargetHandleId}-${side}`;
}

export function manualNodeHandleId(kind: 'source' | 'target', side: ManualHandleSide) {
  return `manual-${kind}-${side}`;
}

export function isManualHandleId(handleId?: string | null) {
  return isManualSourceHandleId(handleId) || isManualTargetHandleId(handleId);
}

export function isManualSourceHandleId(handleId?: string | null) {
  return manualHandleSides.some((side) => handleId === manualNodeHandleId('source', side));
}

export function isManualTargetHandleId(handleId?: string | null) {
  return manualHandleSides.some((side) => handleId === manualNodeHandleId('target', side));
}

export function toReactFlowNodes(
  nodes: DomainNode[],
  bundle?: Pick<GraphBundle, 'edges' | 'highlightsByMessageId' | 'messagesByNodeId'>,
  actions: ConversationNodeActions = {},
  selectedNodeId?: string | null,
  expandedNodeIds: ReadonlySet<string> = new Set(),
  revealHighlightRequest?: { highlightId: string; nodeId: string; requestId: number } | null,
  maximizedNodeId?: string | null,
  canvasViewportSize: { height: number; width: number } = { height: 0, width: 0 },
  visibleBranchHighlightIdsByNodeId: Record<string, string[]> = {},
): ConversationFlowNode[] {
  const branchTargetsByHighlightId = groupBranchTargetsByHighlightId(bundle?.edges ?? [], nodes);
  const branchHighlightsByNodeId = groupBranchHighlightsByNodeId(bundle?.edges ?? [], branchTargetsByHighlightId);
  const activeBranchTargetNodeIds = findActiveBranchTargetNodeIds(
    bundle?.edges ?? [],
    selectedNodeId,
    visibleBranchHighlightIdsByNodeId,
  );

  return nodes.map((node, index) => {
    const isSelected = node.id === selectedNodeId;
    const isPinnedExpanded = expandedNodeIds.has(node.id);
    const isExpanded = isSelected || isPinnedExpanded;
    const isMaximized = isSelected && node.id === maximizedNodeId;
    const isActiveBranchTarget = activeBranchTargetNodeIds.has(node.id);
    const branchHighlights = branchHighlightsByNodeId[node.id] ?? [];
    const collapsedHeight = collapsedNodeAutoHeight(node, branchHighlights.length);
    const maximizedSize = maximizedNodeSize(canvasViewportSize);
    const expandedMinWidth = isMaximized ? maximizedSize.width : 760;
    const expandedMinHeight = isMaximized ? maximizedSize.height : 640;
    const width = Math.max(
      numberOrDefault(node.layout?.width, isExpanded ? expandedMinWidth : 340),
      isExpanded ? expandedMinWidth : 300,
    );
    const height = Math.max(
      numberOrDefault(node.layout?.height, isExpanded ? expandedMinHeight : collapsedHeight),
      isExpanded ? expandedMinHeight : collapsedHeight,
    );

    return {
      data: {
        branchContext: findInboundBranchContext(bundle?.edges, nodes, node.id),
        branchHighlights,
        branchTargetsByHighlightId,
        highlightsByMessageId: bundle?.highlightsByMessageId ?? {},
        isExpanded,
        isMaximized,
        layout: {
          height,
          width,
          x: numberOrDefault(node.layout?.x, 80 + index * 80),
          y: numberOrDefault(node.layout?.y, 80 + index * 40),
        },
        messages: bundle?.messagesByNodeId[node.id] ?? [],
        messageCount: bundle?.messagesByNodeId[node.id]?.length ?? 0,
        messagePreviews: previewMessages(bundle?.messagesByNodeId[node.id] ?? []),
        onBranchCreated: actions.onBranchCreated,
        onBranchSourceSelected: actions.onBranchSourceSelected,
        onBranchTargetSelected: actions.onBranchTargetSelected,
        onNodeDetailsChanged: actions.onNodeDetailsChanged,
        onNodeDeleteRequested: actions.onNodeDeleteRequested,
        onNodeMaximizeToggled: actions.onNodeMaximizeToggled,
        onNodeMessagesChanged: actions.onNodeMessagesChanged,
        onNodeResizeEnded: actions.onNodeResizeEnded,
        onVisibleBranchHighlightsChanged: actions.onVisibleBranchHighlightsChanged,
        accentColor: findInboundBranchColor(bundle?.edges, node.id),
        summary: node.summary,
        title: node.title,
        type: node.type,
        revealHighlightId: revealHighlightRequest?.nodeId === node.id ? revealHighlightRequest.highlightId : null,
        revealHighlightRequestId: revealHighlightRequest?.nodeId === node.id ? revealHighlightRequest.requestId : null,
      },
      id: node.id,
      position: {
        x: numberOrDefault(node.layout?.x, 80 + index * 80),
        y: numberOrDefault(node.layout?.y, 80 + index * 40),
      },
      selected: isSelected,
      style: {
        height,
        width,
      },
      type: 'conversation',
      zIndex: isActiveBranchTarget ? 1500 : isMaximized ? 1400 : isSelected ? 1000 : isPinnedExpanded ? 850 : 100,
    };
  });
}

export function toReactFlowEdges(
  edges: DomainEdge[],
  actions: ConversationEdgeActions = {},
  selectedNodeId?: string | null,
  nodes: DomainNode[] = [],
  visibleBranchHighlightIdsByNodeId: Record<string, string[]> = {},
): ConversationFlowEdge[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return edges.filter((edge) => shouldRenderEdge(edge, visibleBranchHighlightIdsByNodeId)).map((edge) => {
    const isBranchEdge = edge.type === 'BRANCH';
    const hasSelectedNode = Boolean(selectedNodeId);
    const isRelatedToSelected =
      hasSelectedNode && (edge.sourceNodeId === selectedNodeId || edge.targetNodeId === selectedNodeId);
    const isDimmed = hasSelectedNode && !isRelatedToSelected;
    const isFocused = hasSelectedNode && isRelatedToSelected;
    const isFocusedSourceBranch = isBranchEdge && selectedNodeId === edge.sourceNodeId;
    const edgeSides = getManualEdgeHandleSides(edge, nodesById);
    const branchColor = isBranchEdge ? colorForHighlightId(edge.sourceHighlightId ?? edge.id) : undefined;

    return {
      className: [
        isBranchEdge ? 'branch-edge' : 'manual-edge',
        isFocused ? 'is-focused' : '',
        isDimmed ? 'is-dimmed' : '',
      ]
        .filter(Boolean)
        .join(' '),
      data: {
        color: branchColor,
        edgeType: edge.type,
        avoidRects: isBranchEdge && isFocused ? getEdgeAvoidRects(edge, nodesById) : undefined,
        isDimmed,
        isFocused,
        isRelatedToSelected,
        label: edge.label,
        onEdgeDeleteRequested: actions.onEdgeDeleteRequested,
        onEdgeLabelChanged: actions.onEdgeLabelChanged,
      },
      id: edge.id,
      label: edge.label ?? undefined,
      markerEnd: isBranchEdge
        ? {
            color: branchColor?.edge ?? '#2563eb',
            type: MarkerType.ArrowClosed,
          }
        : undefined,
      source: edge.sourceNodeId,
      sourceHandle: isBranchEdge
        ? edge.sourceHighlightId
          ? branchHighlightHandleId(edge.sourceHighlightId)
          : undefined
        : manualNodeHandleId('source', edgeSides.source),
      style: isBranchEdge ? { stroke: branchColor?.edge ?? '#2563eb', strokeOpacity: 0.54, strokeWidth: 1.75 } : undefined,
      target: edge.targetNodeId,
      targetHandle: isBranchEdge ? branchTargetHandleIdForSide(edgeSides.target) : manualNodeHandleId('target', edgeSides.target),
      type: 'editable',
      zIndex: edgeZIndex(edge.type, isDimmed, isFocused, isFocusedSourceBranch),
    };
  });
}

function getEdgeAvoidRects(edge: DomainEdge, nodesById: Map<string, DomainNode>): EdgeAvoidRect[] {
  return Array.from(nodesById.values())
    .filter((node) => node.id !== edge.sourceNodeId && node.id !== edge.targetNodeId)
    .map((node) => ({
      height: numberOrDefault(node.layout?.height, 220),
      id: node.id,
      width: numberOrDefault(node.layout?.width, 340),
      x: numberOrDefault(node.layout?.x, 0),
      y: numberOrDefault(node.layout?.y, 0),
    }));
}

function edgeZIndex(edgeType: EdgeType, isDimmed: boolean, isFocused: boolean, isFocusedSourceBranch: boolean) {
  if (isDimmed) {
    return 1;
  }

  if (isFocusedSourceBranch) {
    return 1600;
  }

  if (isFocused && edgeType === 'BRANCH') {
    return 1200;
  }

  if (isFocused) {
    return 70;
  }

  return edgeType === 'BRANCH' ? 40 : 10;
}

function shouldRenderEdge(edge: DomainEdge, visibleBranchHighlightIdsByNodeId: Record<string, string[]>) {
  if (edge.type !== 'BRANCH' || !edge.sourceHighlightId) {
    return true;
  }

  const visibleHighlightIds = visibleBranchHighlightIdsByNodeId[edge.sourceNodeId];
  return !visibleHighlightIds || visibleHighlightIds.includes(edge.sourceHighlightId);
}

function findActiveBranchTargetNodeIds(
  edges: DomainEdge[],
  selectedNodeId?: string | null,
  visibleBranchHighlightIdsByNodeId: Record<string, string[]> = {},
) {
  const activeHighlightIds = selectedNodeId ? visibleBranchHighlightIdsByNodeId[selectedNodeId] : undefined;
  if (!selectedNodeId || !activeHighlightIds?.length) {
    return new Set<string>();
  }

  const activeHighlightIdSet = new Set(activeHighlightIds);
  return edges.reduce<Set<string>>((targetNodeIds, edge) => {
    if (
      edge.type === 'BRANCH' &&
      edge.sourceNodeId === selectedNodeId &&
      edge.sourceHighlightId &&
      activeHighlightIdSet.has(edge.sourceHighlightId)
    ) {
      targetNodeIds.add(edge.targetNodeId);
    }

    return targetNodeIds;
  }, new Set<string>());
}

function groupBranchHighlightsByNodeId(
  edges: DomainEdge[],
  branchTargetsByHighlightId: Record<string, BranchTargetPreview[]>,
) {
  return edges.reduce<Record<string, BranchHighlightPreview[]>>((groups, edge) => {
    if (edge.type !== 'BRANCH' || !edge.sourceHighlightId || !edge.label) {
      return groups;
    }

    const existingHighlight = groups[edge.sourceNodeId]?.some((highlight) => highlight.id === edge.sourceHighlightId);
    if (existingHighlight) {
      return groups;
    }

    groups[edge.sourceNodeId] = [
      ...(groups[edge.sourceNodeId] ?? []),
      {
        branches: branchTargetsByHighlightId[edge.sourceHighlightId] ?? [],
        color: colorForHighlightId(edge.sourceHighlightId),
        id: edge.sourceHighlightId,
        text: edge.label,
      },
    ];
    return groups;
  }, {});
}

function groupBranchTargetsByHighlightId(edges: DomainEdge[], nodes: DomainNode[]) {
  const nodeTitlesById = Object.fromEntries(nodes.map((node) => [node.id, node.title]));

  return edges.reduce<Record<string, BranchTargetPreview[]>>((targets, edge) => {
    if (edge.type === 'BRANCH' && edge.sourceHighlightId) {
      targets[edge.sourceHighlightId] = [
        ...(targets[edge.sourceHighlightId] ?? []),
        {
          edgeId: edge.id,
          nodeId: edge.targetNodeId,
          title: nodeTitlesById[edge.targetNodeId] ?? (edge.label ? `Branch: ${truncateText(edge.label, 32)}` : 'Branch'),
        },
      ];
    }
    return targets;
  }, {});
}

function findInboundBranchColor(edges: DomainEdge[] | undefined, nodeId: string) {
  const inboundBranch = edges?.find((edge) => edge.targetNodeId === nodeId && edge.type === 'BRANCH');
  return inboundBranch?.sourceHighlightId ? colorForHighlightId(inboundBranch.sourceHighlightId) : undefined;
}

function getManualEdgeHandleSides(edge: DomainEdge, nodesById: Map<string, DomainNode>) {
  const sourceNode = nodesById.get(edge.sourceNodeId);
  const targetNode = nodesById.get(edge.targetNodeId);

  if (!sourceNode || !targetNode) {
    return {
      source: 'right' as const,
      target: 'left' as const,
    };
  }

  const sourceCenter = getNodeCenter(sourceNode);
  const targetCenter = getNodeCenter(targetNode);
  const deltaX = targetCenter.x - sourceCenter.x;
  const deltaY = targetCenter.y - sourceCenter.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0
      ? {
          source: 'right' as const,
          target: 'left' as const,
        }
      : {
          source: 'left' as const,
          target: 'right' as const,
        };
  }

  return deltaY >= 0
    ? {
        source: 'bottom' as const,
        target: 'top' as const,
      }
    : {
        source: 'top' as const,
        target: 'bottom' as const,
      };
}

function getNodeCenter(node: DomainNode) {
  const x = numberOrDefault(node.layout?.x, 0);
  const y = numberOrDefault(node.layout?.y, 0);
  const width = numberOrDefault(node.layout?.width, 340);
  const height = numberOrDefault(node.layout?.height, 220);

  return {
    x: x + width / 2,
    y: y + height / 2,
  };
}

function previewMessages(messages: NodeMessagePreview[]) {
  return [...messages].sort((left, right) => left.sequence - right.sequence).slice(-3);
}

function collapsedNodeAutoHeight(node: DomainNode, branchHighlightCount: number) {
  const visibleBranchCount = Math.min(branchHighlightCount, 5);
  const summaryHeight = node.summary ? 46 : 0;
  const branchListHeight = branchHighlightCount > 0 ? 24 + visibleBranchCount * 39 : 24;

  return Math.max(180, 78 + summaryHeight + branchListHeight);
}

function maximizedNodeSize(canvasViewportSize: { height: number; width: number }) {
  const focusZoom = 0.86;
  return {
    height: Math.max(760, Math.round((canvasViewportSize.height * 0.88) / focusZoom)),
    width: Math.max(1040, Math.round((canvasViewportSize.width * 0.88) / focusZoom)),
  };
}

function findInboundBranchContext(edges: DomainEdge[] | undefined, nodes: DomainNode[], nodeId: string) {
  const inboundBranch = edges?.find((edge) => edge.targetNodeId === nodeId && edge.type === 'BRANCH');
  if (!inboundBranch?.label) {
    return undefined;
  }

  const sourceText = inboundBranch.label;

  return {
    color: inboundBranch.sourceHighlightId ? colorForHighlightId(inboundBranch.sourceHighlightId) : undefined,
    highlightId: inboundBranch.sourceHighlightId ?? undefined,
    learningPath: buildBranchLearningPath(edges ?? [], nodes, nodeId),
    sourceNodeId: inboundBranch.sourceNodeId,
    sourceText,
    text: sourceText,
  };
}

function buildBranchLearningPath(edges: DomainEdge[], nodes: DomainNode[], nodeId: string) {
  const nodeTitlesById = new Map(nodes.map((node) => [node.id, node.title]));
  const inboundBranchesByTargetId = new Map(
    edges
      .filter((edge) => edge.type === 'BRANCH' && edge.label)
      .map((edge) => [edge.targetNodeId, edge]),
  );
  const branchPathItems: BranchLearningPathItem[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNodeId = nodeId;

  while (!visitedNodeIds.has(currentNodeId)) {
    visitedNodeIds.add(currentNodeId);
    const inboundBranch = inboundBranchesByTargetId.get(currentNodeId);
    if (!inboundBranch?.label) {
      break;
    }

    branchPathItems.unshift({
      label: inboundBranch.label,
      nodeId: currentNodeId,
    });
    currentNodeId = inboundBranch.sourceNodeId;
  }

  const rootTitle = nodeTitlesById.get(currentNodeId);
  return rootTitle ? [{ label: rootTitle, nodeId: currentNodeId }, ...branchPathItems] : branchPathItems;
}

export function colorForHighlightId(highlightId: string): BranchColor {
  return BRANCH_COLORS[hashString(highlightId) % BRANCH_COLORS.length];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function truncateText(text: string, maxLength: number) {
  const compact = text.trim().replace(/\s+/g, ' ');
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 3))}...` : compact;
}

const BRANCH_COLORS: BranchColor[] = [
  {
    background: '#fef3c7',
    border: '#f59e0b',
    edge: '#d97706',
    softBackground: '#fffbeb',
    text: '#78350f',
  },
  {
    background: '#dbeafe',
    border: '#60a5fa',
    edge: '#2563eb',
    softBackground: '#eff6ff',
    text: '#1e3a8a',
  },
  {
    background: '#dcfce7',
    border: '#22c55e',
    edge: '#16a34a',
    softBackground: '#f0fdf4',
    text: '#14532d',
  },
  {
    background: '#fce7f3',
    border: '#f472b6',
    edge: '#db2777',
    softBackground: '#fdf2f8',
    text: '#831843',
  },
  {
    background: '#ede9fe',
    border: '#a78bfa',
    edge: '#7c3aed',
    softBackground: '#f5f3ff',
    text: '#3b0764',
  },
  {
    background: '#ccfbf1',
    border: '#2dd4bf',
    edge: '#0f766e',
    softBackground: '#f0fdfa',
    text: '#134e4a',
  },
];

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
