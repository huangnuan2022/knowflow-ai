export type TextSelectionRange = {
  startOffset: number;
  endOffset: number;
  selectedTextSnapshot: string;
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
    selectedTextSnapshot,
    startOffset: start,
  };
}

function getOffsetWithin(root: HTMLElement, container: Node, offset: number) {
  const prefixRange = document.createRange();
  prefixRange.selectNodeContents(root);
  prefixRange.setEnd(container, offset);
  return prefixRange.toString().length;
}
