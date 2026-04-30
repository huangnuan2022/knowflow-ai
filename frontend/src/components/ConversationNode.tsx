import { Handle, NodeProps, Position } from '@xyflow/react';
import { MessageSquareText } from 'lucide-react';
import { ConversationNodeData } from '../lib/reactFlowAdapter';

export function ConversationNode({ data, selected }: NodeProps) {
  const nodeData = data as ConversationNodeData;

  return (
    <article className={`conversation-node ${selected ? 'is-selected' : ''}`}>
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
      {nodeData.summary ? <p className="conversation-node__summary">{nodeData.summary}</p> : null}
      <Handle className="node-handle" position={Position.Bottom} type="source" />
    </article>
  );
}
