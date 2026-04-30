import { Edge, MarkerType, Node } from '@xyflow/react';
import { DomainEdge, DomainNode, GraphBundle, MessageRole } from './domain';

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

export type ConversationNodeData = Record<string, unknown> & {
  branchHighlights: BranchHighlightPreview[];
  messageCount: number;
  messagePreviews: NodeMessagePreview[];
  summary?: string | null;
  title: string;
  type: string;
};

export type ConversationFlowNode = Node<ConversationNodeData>;

export function branchHighlightHandleId(highlightId: string) {
  return `branch-highlight-${highlightId}`;
}

export function toReactFlowNodes(nodes: DomainNode[], bundle?: Pick<GraphBundle, 'edges' | 'messagesByNodeId'>): ConversationFlowNode[] {
  const branchHighlightsByNodeId = groupBranchHighlightsByNodeId(bundle?.edges ?? []);

  return nodes.map((node, index) => ({
    data: {
      branchHighlights: branchHighlightsByNodeId[node.id] ?? [],
      messageCount: bundle?.messagesByNodeId[node.id]?.length ?? 0,
      messagePreviews: previewMessages(bundle?.messagesByNodeId[node.id] ?? []),
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

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
