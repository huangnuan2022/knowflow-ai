import { Handle, NodeProps, Position } from '@xyflow/react';
import { MessageSquareText } from 'lucide-react';
import { branchHighlightHandleId, ConversationNodeData } from '../lib/reactFlowAdapter';

export function ConversationNode({ data, selected }: NodeProps) {
  const nodeData = data as ConversationNodeData;
  const hasMessages = nodeData.messagePreviews.length > 0;
  const hasBranchHighlights = nodeData.branchHighlights.length > 0;

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
      <div className="conversation-node__messages nodrag">
        {hasMessages ? (
          nodeData.messagePreviews.map((message) => (
            <div className="conversation-node__message" key={message.id}>
              <span>{message.role.toLowerCase()}</span>
              <p>{truncateText(message.content, 110)}</p>
            </div>
          ))
        ) : (
          <p className="conversation-node__empty">No messages yet</p>
        )}
      </div>
      {hasBranchHighlights ? (
        <div className="conversation-node__highlights nodrag">
          <span>Branch points</span>
          {nodeData.branchHighlights.map((highlight) => (
            <div className="conversation-node__highlight" key={highlight.id} title={highlight.text}>
              <mark>{truncateText(highlight.text, 80)}</mark>
              <Handle
                className="node-handle node-handle--highlight"
                id={branchHighlightHandleId(highlight.id)}
                position={Position.Right}
                type="source"
              />
            </div>
          ))}
        </div>
      ) : null}
      <Handle className="node-handle" position={Position.Bottom} type="source" />
    </article>
  );
}

function truncateText(text: string, maxLength: number) {
  const compact = text.trim().replace(/\s+/g, ' ');
  return compact.length > maxLength ? `${compact.slice(0, Math.max(0, maxLength - 3))}...` : compact;
}
