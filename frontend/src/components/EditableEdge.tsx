import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  Position,
} from '@xyflow/react';
import { Trash2 } from 'lucide-react';
import { CSSProperties, FormEvent, KeyboardEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { BranchColor, ConversationFlowEdge, EdgeAvoidRect, KnowFlowEdgeData } from '../lib/reactFlowAdapter';

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
  const labelTitle = canEdit
    ? label
      ? `Edit relationship label: ${label}`
      : 'Add relationship label'
    : label || 'Branch source text';
  const shouldShowLabel = edgeData.isDimmed
    ? false
    : isBranchEdge
      ? Boolean(label)
      : Boolean(label) || canEdit || selected;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draft, setDraft] = useState(label);
  const skipNextBlurSaveRef = useRef(false);

  useEffect(() => {
    setDraft(label);
  }, [label]);

  const { labelX, labelY, path: edgePath } = useMemo(
    () =>
      getReadableEdgePath({
        avoidRects: edgeData.avoidRects ?? [],
        shouldAvoidObstacles: isBranchEdge && Boolean(edgeData.isFocused),
        sourcePosition,
        sourceX,
        sourceY,
        targetPosition,
        targetX,
        targetY,
      }),
    [
      edgeData.avoidRects,
      edgeData.isFocused,
      isBranchEdge,
      sourcePosition,
      sourceX,
      sourceY,
      targetPosition,
      targetX,
      targetY,
    ],
  );
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
            className={[
              'editable-edge-label nodrag nopan',
              canEdit ? 'is-manual' : 'is-branch',
              edgeData.isDimmed ? 'is-dimmed' : '',
              edgeData.isFocused ? 'is-focused' : '',
              edgeData.isRelatedToSelected ? 'is-related-to-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')}
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
                  title={labelTitle}
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

type Point = {
  x: number;
  y: number;
};

function getReadableEdgePath({
  avoidRects,
  shouldAvoidObstacles,
  sourcePosition,
  sourceX,
  sourceY,
  targetPosition,
  targetX,
  targetY,
}: {
  avoidRects: EdgeAvoidRect[];
  shouldAvoidObstacles: boolean;
  sourcePosition: Position;
  sourceX: number;
  sourceY: number;
  targetPosition: Position;
  targetX: number;
  targetY: number;
}) {
  const source = { x: sourceX, y: sourceY };
  const target = { x: targetX, y: targetY };
  const blockingRects = shouldAvoidObstacles
    ? avoidRects.filter((rect) => segmentIntersectsRect(source, target, expandRect(rect, 24)))
    : [];

  if (blockingRects.length === 0) {
    const [path, labelX, labelY] = getBezierPath({
      sourcePosition,
      sourceX,
      sourceY,
      targetPosition,
      targetX,
      targetY,
    });

    return { labelX, labelY, path };
  }

  const route = chooseRoute(source, target, avoidRects);
  return {
    labelX: route.label.x,
    labelY: route.label.y,
    path: roundedPath(route.points),
  };
}

function chooseRoute(source: Point, target: Point, avoidRects: EdgeAvoidRect[]) {
  const padding = 34;
  const expandedRects = avoidRects.map((rect) => expandRect(rect, padding));
  const blockingRects = expandedRects.filter((rect) => segmentIntersectsRect(source, target, rect));
  const relevantRects = blockingRects.length > 0 ? blockingRects : expandedRects;
  const horizontalLines = new Set<number>([(source.y + target.y) / 2]);
  const verticalLines = new Set<number>([(source.x + target.x) / 2]);

  for (const rect of relevantRects) {
    horizontalLines.add(rect.y - padding);
    horizontalLines.add(rect.y + rect.height + padding);
    verticalLines.add(rect.x - padding);
    verticalLines.add(rect.x + rect.width + padding);
  }

  const candidates: Point[][] = [[source, target]];
  for (const y of horizontalLines) {
    candidates.push(dedupePoints([source, { x: source.x, y }, { x: target.x, y }, target]));
  }
  for (const x of verticalLines) {
    candidates.push(dedupePoints([source, { x, y: source.y }, { x, y: target.y }, target]));
  }

  const best = candidates
    .map((points) => ({
      intersections: countIntersections(points, expandedRects),
      length: polylineLength(points),
      points,
    }))
    .sort((left, right) => left.intersections - right.intersections || left.length - right.length)[0];

  return {
    label: pointAtLength(best.points, polylineLength(best.points) / 2),
    points: best.points,
  };
}

function countIntersections(points: Point[], rects: EdgeAvoidRect[]) {
  let count = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    for (const rect of rects) {
      if (segmentIntersectsRect(points[index], points[index + 1], rect)) {
        count += 1;
      }
    }
  }

  return count;
}

function roundedPath(points: Point[]) {
  if (points.length <= 2) {
    return `M ${points[0].x},${points[0].y} L ${points[points.length - 1].x},${points[points.length - 1].y}`;
  }

  const radius = 18;
  let path = `M ${points[0].x},${points[0].y}`;

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const before = moveToward(current, previous, radius);
    const after = moveToward(current, next, radius);
    path += ` L ${before.x},${before.y} Q ${current.x},${current.y} ${after.x},${after.y}`;
  }

  const lastPoint = points[points.length - 1];
  return `${path} L ${lastPoint.x},${lastPoint.y}`;
}

function moveToward(from: Point, to: Point, distance: number) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length === 0) {
    return from;
  }

  const step = Math.min(distance, length / 2);
  return {
    x: from.x + ((to.x - from.x) / length) * step,
    y: from.y + ((to.y - from.y) / length) * step,
  };
}

function dedupePoints(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  });
}

function polylineLength(points: Point[]) {
  return points.slice(1).reduce((length, point, index) => {
    const previous = points[index];
    return length + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function pointAtLength(points: Point[], targetLength: number) {
  let traversed = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segmentLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (traversed + segmentLength >= targetLength) {
      const ratio = segmentLength === 0 ? 0 : (targetLength - traversed) / segmentLength;
      return {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      };
    }
    traversed += segmentLength;
  }

  return points[points.length - 1];
}

function expandRect(rect: EdgeAvoidRect, padding: number): EdgeAvoidRect {
  return {
    ...rect,
    height: rect.height + padding * 2,
    width: rect.width + padding * 2,
    x: rect.x - padding,
    y: rect.y - padding,
  };
}

function segmentIntersectsRect(start: Point, end: Point, rect: EdgeAvoidRect) {
  if (pointInRect(start, rect) || pointInRect(end, rect)) {
    return true;
  }

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };

  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

function pointInRect(point: Point, rect: EdgeAvoidRect) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function segmentsIntersect(firstStart: Point, firstEnd: Point, secondStart: Point, secondEnd: Point) {
  const directionOne = orientation(firstStart, firstEnd, secondStart);
  const directionTwo = orientation(firstStart, firstEnd, secondEnd);
  const directionThree = orientation(secondStart, secondEnd, firstStart);
  const directionFour = orientation(secondStart, secondEnd, firstEnd);

  return directionOne !== directionTwo && directionThree !== directionFour;
}

function orientation(start: Point, end: Point, point: Point) {
  return Math.sign((end.y - start.y) * (point.x - end.x) - (end.x - start.x) * (point.y - end.y));
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
