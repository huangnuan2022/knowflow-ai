import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  Position,
} from '@xyflow/react';
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ConversationFlowEdge, KnowFlowEdgeData } from '../lib/reactFlowAdapter';

export function EditableEdge({
  data,
  id,
  markerEnd,
  selected,
  sourcePosition = Position.Bottom,
  sourceX,
  sourceY,
  style,
  targetPosition = Position.Top,
  targetX,
  targetY,
}: EdgeProps<ConversationFlowEdge>) {
  const edgeData = (data ?? {}) as KnowFlowEdgeData;
  const isBranchEdge = edgeData.edgeType === 'BRANCH';
  const label = edgeData.label?.trim() ?? '';
  const canEdit = edgeData.edgeType === 'MANUAL';
  const shouldShowLabel = Boolean(label) || (canEdit && selected);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState(label);
  const skipNextBlurSaveRef = useRef(false);

  useEffect(() => {
    setDraft(label);
  }, [label]);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });

  const saveLabel = async () => {
    if (!canEdit || isSaving) {
      return;
    }

    const nextLabel = draft.trim();
    if (nextLabel === label) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await edgeData.onEdgeLabelChanged?.(id, nextLabel);
      setIsEditing(false);
    } catch {
      setDraft(label);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveLabel();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      skipNextBlurSaveRef.current = true;
      setDraft(label);
      setIsEditing(false);
    }
  };

  return (
    <>
      <BaseEdge id={id} interactionWidth={24} markerEnd={markerEnd} path={edgePath} style={style} />
      {shouldShowLabel ? (
        <EdgeLabelRenderer>
          <div
            className="editable-edge-label nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {isEditing ? (
              <form className="editable-edge-label__form" onSubmit={onSubmit}>
                <input
                  aria-label="Edge label"
                  autoFocus
                  disabled={isSaving}
                  onBlur={() => {
                    if (skipNextBlurSaveRef.current) {
                      skipNextBlurSaveRef.current = false;
                      return;
                    }
                    void saveLabel();
                  }}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Relationship"
                  value={draft}
                />
              </form>
            ) : (
              <button
                className={`editable-edge-label__button ${isBranchEdge ? 'is-branch' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  if (canEdit) {
                    setIsEditing(true);
                  }
                }}
                title={canEdit ? 'Edit relationship label' : 'Branch source text'}
                type="button"
              >
                {label || 'Label'}
              </button>
            )}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
