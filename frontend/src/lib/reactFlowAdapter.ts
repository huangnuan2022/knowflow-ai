import { Edge, MarkerType, Node } from '@xyflow/react';
import { DomainEdge, DomainNode } from './domain';

export type ConversationNodeData = Record<string, unknown> & {
  summary?: string | null;
  title: string;
  type: string;
};

export type ConversationFlowNode = Node<ConversationNodeData>;

export function toReactFlowNodes(nodes: DomainNode[]): ConversationFlowNode[] {
  return nodes.map((node, index) => ({
    data: {
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
    target: edge.targetNodeId,
    type: 'smoothstep',
  }));
}

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
