import { Edge, MarkerType, Node } from '@xyflow/react';
import { DomainEdge, DomainNode, EdgeType, GraphBundle, Highlight, Message, MessageRole, NodeLayout } from './domain';

export type NodeMessagePreview = {
  id: string;
  role: MessageRole;
  content: string;
  sequence: number;
};

export type BranchHighlightPreview = {
  id: string;
  targetNodeId: string;
  text: string;
};

export type BranchContextPreview = {
  sourceNodeId: string;
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
  branchContext?: BranchContextPreview;
  branchHighlights: BranchHighlightPreview[];
  branchTargetsByHighlightId: Record<string, string>;
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
  edgeType: EdgeType;
  label?: string | null;
  onEdgeLabelChanged?: (edgeId: string, label: string) => Promise<void> | void;
};

export type ConversationFlowEdge = Edge<KnowFlowEdgeData>;

export type ConversationEdgeActions = {
  onEdgeLabelChanged?: (edgeId: string, label: string) => Promise<void> | void;
};

export const branchTargetHandleId = 'branch-target';
export const manualSourceHandleId = 'manual-source';
export const manualTargetHandleId = 'manual-target';

export function branchHighlightHandleId(highlightId: string) {
  return `branch-highlight-${highlightId}`;
}

export function toReactFlowNodes(
  nodes: DomainNode[],
  bundle?: Pick<GraphBundle, 'edges' | 'highlightsByMessageId' | 'messagesByNodeId'>,
  actions: ConversationNodeActions = {},
  selectedNodeId?: string | null,
): ConversationFlowNode[] {
  const branchHighlightsByNodeId = groupBranchHighlightsByNodeId(bundle?.edges ?? []);
  const branchTargetsByHighlightId = groupBranchTargetsByHighlightId(bundle?.edges ?? []);

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
): ConversationFlowEdge[] {
  return edges.map((edge) => {
    const isBranchEdge = edge.type === 'BRANCH';
    const shouldRenderAboveSourceNode = isBranchEdge && edge.sourceNodeId === selectedNodeId;

    return {
      className: isBranchEdge ? 'branch-edge' : undefined,
      data: {
        edgeType: edge.type,
        label: edge.label,
        onEdgeLabelChanged: actions.onEdgeLabelChanged,
      },
      id: edge.id,
      label: edge.label ?? undefined,
      markerEnd: isBranchEdge
        ? {
            color: '#2563eb',
            type: MarkerType.ArrowClosed,
          }
        : undefined,
      source: edge.sourceNodeId,
      sourceHandle: isBranchEdge
        ? edge.sourceHighlightId
          ? branchHighlightHandleId(edge.sourceHighlightId)
          : undefined
        : manualSourceHandleId,
      style: isBranchEdge ? { stroke: '#2563eb', strokeOpacity: 0.5, strokeWidth: 1.65 } : undefined,
      target: edge.targetNodeId,
      targetHandle: isBranchEdge ? branchTargetHandleId : manualTargetHandleId,
      type: 'editable',
      zIndex: shouldRenderAboveSourceNode ? 1200 : 10,
    };
  });
}

function groupBranchHighlightsByNodeId(edges: DomainEdge[]) {
  return edges.reduce<Record<string, BranchHighlightPreview[]>>((groups, edge) => {
    if (edge.type !== 'BRANCH' || !edge.sourceHighlightId || !edge.label) {
      return groups;
    }

    groups[edge.sourceNodeId] = [
      ...(groups[edge.sourceNodeId] ?? []),
      {
        id: edge.sourceHighlightId,
        targetNodeId: edge.targetNodeId,
        text: edge.label,
      },
    ];
    return groups;
  }, {});
}

function groupBranchTargetsByHighlightId(edges: DomainEdge[]) {
  return edges.reduce<Record<string, string>>((targets, edge) => {
    if (edge.type === 'BRANCH' && edge.sourceHighlightId) {
      targets[edge.sourceHighlightId] = edge.targetNodeId;
    }
    return targets;
  }, {});
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
    sourceNodeId: inboundBranch.sourceNodeId,
    text: inboundBranch.label,
  };
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
