import { Edge, MarkerType, Node } from '@xyflow/react';
import { DomainEdge, DomainNode, GraphBundle, Highlight, Message, MessageRole, NodeLayout } from './domain';

export type NodeMessagePreview = {
  id: string;
  role: MessageRole;
  content: string;
  sequence: number;
};

export type BranchHighlightPreview = {
  id: string;
  text: string;
};

export type BranchContextPreview = {
  sourceNodeId: string;
  text: string;
};

export type ConversationNodeActions = {
  onBranchCreated?: (childNodeId: string, sourceNodeId: string) => Promise<void> | void;
  onNodeDetailsChanged?: (nodeId: string, input: { title?: string; summary?: string | null }) => Promise<void> | void;
  onNodeDeleteRequested?: (nodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
  onNodeResizeEnded?: (nodeId: string, layout: Required<NodeLayout>) => Promise<void> | void;
};

export type ConversationNodeData = Record<string, unknown> & {
  branchContext?: BranchContextPreview;
  branchHighlights: BranchHighlightPreview[];
  highlightsByMessageId: Record<string, Highlight[]>;
  isExpanded: boolean;
  layout?: NodeLayout | null;
  messages: Message[];
  messageCount: number;
  messagePreviews: NodeMessagePreview[];
  onBranchCreated?: (childNodeId: string, sourceNodeId: string) => Promise<void> | void;
  onNodeDetailsChanged?: (nodeId: string, input: { title?: string; summary?: string | null }) => Promise<void> | void;
  onNodeDeleteRequested?: (nodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
  onNodeResizeEnded?: (nodeId: string, layout: Required<NodeLayout>) => Promise<void> | void;
  summary?: string | null;
  title: string;
  type: string;
};

export type ConversationFlowNode = Node<ConversationNodeData>;

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

  return nodes.map((node, index) => {
    const isSelected = node.id === selectedNodeId;
    const width = Math.max(numberOrDefault(node.layout?.width, isSelected ? 560 : 340), isSelected ? 520 : 300);
    const height = Math.max(numberOrDefault(node.layout?.height, isSelected ? 520 : 220), isSelected ? 420 : 180);

    return {
      data: {
        branchContext: findInboundBranchContext(bundle?.edges, node.id),
        branchHighlights: branchHighlightsByNodeId[node.id] ?? [],
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
    };
  });
}

export function toReactFlowEdges(edges: DomainEdge[]): Edge[] {
  return edges.map((edge) => {
    const isBranchEdge = edge.type === 'BRANCH';

    return {
      className: isBranchEdge ? 'branch-edge' : undefined,
      id: edge.id,
      label: edge.label ?? undefined,
      markerEnd: {
        color: isBranchEdge ? '#2563eb' : undefined,
        type: MarkerType.ArrowClosed,
      },
      source: edge.sourceNodeId,
      sourceHandle: isBranchEdge && edge.sourceHighlightId ? branchHighlightHandleId(edge.sourceHighlightId) : undefined,
      style: isBranchEdge ? { stroke: '#2563eb', strokeOpacity: 0.5, strokeWidth: 1.65 } : undefined,
      target: edge.targetNodeId,
      type: 'smoothstep',
      zIndex: isBranchEdge ? 2000 : 0,
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
        text: edge.label,
      },
    ];
    return groups;
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
