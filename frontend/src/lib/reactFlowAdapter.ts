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
  onBranchCreated?: (childNodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
};

export type ConversationNodeData = Record<string, unknown> & {
  branchContext?: BranchContextPreview;
  branchHighlights: BranchHighlightPreview[];
  highlightsByMessageId: Record<string, Highlight[]>;
  layout?: NodeLayout | null;
  messages: Message[];
  messageCount: number;
  messagePreviews: NodeMessagePreview[];
  onBranchCreated?: (childNodeId: string) => Promise<void> | void;
  onNodeMessagesChanged?: () => Promise<void> | void;
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
): ConversationFlowNode[] {
  const branchHighlightsByNodeId = groupBranchHighlightsByNodeId(bundle?.edges ?? []);

  return nodes.map((node, index) => ({
    data: {
      branchContext: findInboundBranchContext(bundle?.edges, node.id),
      branchHighlights: branchHighlightsByNodeId[node.id] ?? [],
      highlightsByMessageId: bundle?.highlightsByMessageId ?? {},
      layout: node.layout,
      messages: bundle?.messagesByNodeId[node.id] ?? [],
      messageCount: bundle?.messagesByNodeId[node.id]?.length ?? 0,
      messagePreviews: previewMessages(bundle?.messagesByNodeId[node.id] ?? []),
      onBranchCreated: actions.onBranchCreated,
      onNodeMessagesChanged: actions.onNodeMessagesChanged,
      summary: node.summary,
      title: node.title,
      type: node.type,
    },
    id: node.id,
    position: {
      x: numberOrDefault(node.layout?.x, 80 + index * 80),
      y: numberOrDefault(node.layout?.y, 80 + index * 40),
    },
    type: 'conversation',
  }));
}

export function toReactFlowEdges(edges: DomainEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id,
    label: edge.label ?? undefined,
    markerEnd: { type: MarkerType.ArrowClosed },
    source: edge.sourceNodeId,
    sourceHandle:
      edge.type === 'BRANCH' && edge.sourceHighlightId ? branchHighlightHandleId(edge.sourceHighlightId) : undefined,
    target: edge.targetNodeId,
    type: 'smoothstep',
  }));
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
