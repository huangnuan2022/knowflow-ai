import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  Position,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { CSSProperties, FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BranchColor, ConversationFlowEdge, KnowFlowEdgeData } from '../lib/reactFlowAdapter';

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
  const shouldShowLabel = Boolean(label) || canEdit;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draft, setDraft] = useState(label);
  const skipNextBlurSaveRef = useRef(false);

  useEffect(() => {
    setDraft(label);
  }, [label]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });
  const edgeLabelStyle = useMemo(
    () => ({
      ...edgeColorStyle(edgeData.color),
      transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
    }),
    [edgeData.color, labelX, labelY],
  );

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

  const onDelete = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!canEdit || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await edgeData.onEdgeDeleteRequested?.(id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <BaseEdge id={id} interactionWidth={24} markerEnd={markerEnd} path={edgePath} style={style} />
      {shouldShowLabel ? (
        <EdgeLabelRenderer>
          <div
            className={`editable-edge-label nodrag nopan ${canEdit ? 'is-manual' : 'is-branch'}`}
            style={edgeLabelStyle}
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
              <div className="editable-edge-label__actions">
                <button
                  className={[
                    'editable-edge-label__button',
                    isBranchEdge ? 'is-branch' : '',
                    canEdit && !label ? 'is-placeholder' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (canEdit) {
                      setIsEditing(true);
                    }
                  }}
                  title={canEdit ? 'Edit relationship label' : 'Branch source text'}
                  type="button"
                >
                  {label || 'Add label'}
                </button>
                {canEdit ? (
                  <button
                    aria-label="Delete relationship edge"
                    className="editable-edge-label__delete"
                    disabled={isDeleting}
                    onClick={onDelete}
                    title="Delete relationship edge"
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function edgeColorStyle(color?: BranchColor): CSSProperties {
  if (!color) {
    return {};
  }

  return {
    '--edge-label-accent': color.edge,
    '--edge-label-bg': color.softBackground,
    '--edge-label-border': color.border,
    '--edge-label-text': color.text,
  } as CSSProperties;
}
