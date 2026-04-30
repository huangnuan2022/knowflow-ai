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

export type BranchContextPreview = {
  color?: BranchColor;
  sourceNodeId: string;
  text: string;
};

export type BranchColor = {
  background: string;
  border: string;
  edge: string;
  softBackground: string;
  text: string;
};

export type ConversationNodeActions = {
  onBranchCreated?: (childNodeId: string, sourceNodeId: string) => Promise<void> | void;
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  onNodeDetailsChanged?: (nodeId: string, input: { title?: string; summary?: string | null }) => Promise<void> | void;
  onNodeDeleteRequested?: (nodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
  onNodeResizeEnded?: (nodeId: string, layout: Required<NodeLayout>) => Promise<void> | void;
};

export type ConversationNodeData = Record<string, unknown> & {
  accentColor?: BranchColor;
  branchContext?: BranchContextPreview;
  branchHighlights: BranchHighlightPreview[];
  branchTargetsByHighlightId: Record<string, BranchTargetPreview[]>;
  highlightsByMessageId: Record<string, Highlight[]>;
  isExpanded: boolean;
  layout?: NodeLayout | null;
  messages: Message[];
  messageCount: number;
  messagePreviews: NodeMessagePreview[];
  onBranchCreated?: (childNodeId: string, sourceNodeId: string) => Promise<void> | void;
  onBranchTargetSelected?: (targetNodeId: string, sourceNodeId: string) => void;
  onNodeDetailsChanged?: (nodeId: string, input: { title?: string; summary?: string | null }) => Promise<void> | void;
  onNodeDeleteRequested?: (nodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
  onNodeResizeEnded?: (nodeId: string, layout: Required<NodeLayout>) => Promise<void> | void;
  summary?: string | null;
  title: string;
  type: string;
};

export type ConversationFlowNode = Node<ConversationNodeData>;

export type KnowFlowEdgeData = Record<string, unknown> & {
  color?: BranchColor;
  edgeType: EdgeType;
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

export function manualNodeHandleId(kind: 'source' | 'target', side: ManualHandleSide) {
  return `manual-${kind}-${side}`;
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
): ConversationFlowNode[] {
  const branchTargetsByHighlightId = groupBranchTargetsByHighlightId(bundle?.edges ?? [], nodes);
  const branchHighlightsByNodeId = groupBranchHighlightsByNodeId(bundle?.edges ?? [], branchTargetsByHighlightId);

  return nodes.map((node, index) => {
    const isSelected = node.id === selectedNodeId;
    const width = Math.max(numberOrDefault(node.layout?.width, isSelected ? 560 : 340), isSelected ? 520 : 300);
    const height = Math.max(numberOrDefault(node.layout?.height, isSelected ? 520 : 220), isSelected ? 420 : 180);

    return {
      data: {
        branchContext: findInboundBranchContext(bundle?.edges, node.id),
        branchHighlights: branchHighlightsByNodeId[node.id] ?? [],
        branchTargetsByHighlightId,
        highlightsByMessageId: bundle?.highlightsByMessageId ?? {},
        isExpanded: isSelected,
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
        onBranchTargetSelected: actions.onBranchTargetSelected,
        onNodeDetailsChanged: actions.onNodeDetailsChanged,
        onNodeDeleteRequested: actions.onNodeDeleteRequested,
        onNodeMessagesChanged: actions.onNodeMessagesChanged,
        onNodeResizeEnded: actions.onNodeResizeEnded,
        accentColor: findInboundBranchColor(bundle?.edges, node.id),
        summary: node.summary,
        title: node.title,
        type: node.type,
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
      zIndex: isSelected ? 1000 : 100,
    };
  });
}

export function toReactFlowEdges(
  edges: DomainEdge[],
  actions: ConversationEdgeActions = {},
  selectedNodeId?: string | null,
  nodes: DomainNode[] = [],
): ConversationFlowEdge[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  return edges.map((edge) => {
    const isBranchEdge = edge.type === 'BRANCH';
    const shouldRenderAboveSourceNode = isBranchEdge && edge.sourceNodeId === selectedNodeId;
    const manualSides = isBranchEdge ? undefined : getManualEdgeHandleSides(edge, nodesById);
    const branchColor = isBranchEdge ? colorForHighlightId(edge.sourceHighlightId ?? edge.id) : undefined;

    return {
      className: isBranchEdge ? 'branch-edge' : undefined,
      data: {
        color: branchColor,
        edgeType: edge.type,
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
        : manualNodeHandleId('source', manualSides?.source ?? 'right'),
      style: isBranchEdge ? { stroke: branchColor?.edge ?? '#2563eb', strokeOpacity: 0.54, strokeWidth: 1.75 } : undefined,
      target: edge.targetNodeId,
      targetHandle: isBranchEdge ? branchTargetHandleId : manualNodeHandleId('target', manualSides?.target ?? 'left'),
      type: 'editable',
      zIndex: shouldRenderAboveSourceNode ? 1200 : 10,
    };
  });
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

function findInboundBranchContext(edges: DomainEdge[] | undefined, nodeId: string) {
  const inboundBranch = edges?.find((edge) => edge.targetNodeId === nodeId && edge.type === 'BRANCH');
  if (!inboundBranch?.label) {
    return undefined;
  }

  return {
    color: inboundBranch.sourceHighlightId ? colorForHighlightId(inboundBranch.sourceHighlightId) : undefined,
    sourceNodeId: inboundBranch.sourceNodeId,
    text: inboundBranch.label,
  };
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
