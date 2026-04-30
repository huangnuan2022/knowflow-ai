export type TextSelectionRange = {
  startOffset: number;
  endOffset: number;
  selectedTextSnapshot: string;
  rect: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
};

export function readTextSelectionWithin(root: HTMLElement, sourceText: string): TextSelectionRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    return null;
  }

  const startOffset = getOffsetWithin(root, range.startContainer, range.startOffset);
  const endOffset = getOffsetWithin(root, range.endContainer, range.endOffset);
  const start = Math.max(0, Math.min(startOffset, endOffset));
  const end = Math.min(sourceText.length, Math.max(startOffset, endOffset));
  const selectedTextSnapshot = sourceText.slice(start, end);

  if (!selectedTextSnapshot.trim()) {
    return null;
  }

  return {
    endOffset: end,
    rect: rectFromRange(range),
    selectedTextSnapshot,
    startOffset: start,
  };
}

function rectFromRange(range: Range) {
  const rect = range.getBoundingClientRect();
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function getOffsetWithin(root: HTMLElement, container: Node, offset: number) {
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(root);
  prefixRange.setEnd(container, offset);
  return prefixRange.toString().length;
}
