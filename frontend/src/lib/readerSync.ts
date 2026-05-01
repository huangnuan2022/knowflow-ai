export type ReaderSyncSource = 'canvas' | 'inspector';

export type ReaderSyncAnchor = {
  messageId: string;
  nodeId: string;
  ratio: number;
  requestId: number;
  source: ReaderSyncSource;
};

export function findReaderSyncAnchor(
  container: HTMLElement,
  messageSelector: string,
  nodeId: string,
  source: ReaderSyncSource,
  requestId: number,
): ReaderSyncAnchor | null {
  const containerRect = container.getBoundingClientRect();
  const messages = Array.from(container.querySelectorAll<HTMLElement>(messageSelector));
  let best: { distance: number; element: HTMLElement } | null = null;

  for (const element of messages) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom < containerRect.top || rect.top > containerRect.bottom) {
      continue;
    }

    const distance = Math.abs(rect.top - containerRect.top);
    if (!best || distance < best.distance) {
      best = { distance, element };
    }
  }

  const messageId = best?.element.dataset.readerMessageId;
  if (!best || !messageId) {
    return null;
  }

  const rect = best.element.getBoundingClientRect();
  const visibleOffset = Math.max(0, containerRect.top - rect.top);
  const ratio = rect.height > 0 ? Math.min(1, visibleOffset / rect.height) : 0;

  return {
    messageId,
    nodeId,
    ratio,
    requestId,
    source,
  };
}

export function scrollReaderToAnchor(
  container: HTMLElement,
  messageSelector: string,
  anchor: Pick<ReaderSyncAnchor, 'messageId' | 'ratio'>,
) {
  const target = container.querySelector<HTMLElement>(
    `${messageSelector}[data-reader-message-id="${cssEscape(anchor.messageId)}"]`,
  );
  if (!target) {
    return false;
  }

  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const targetOffset = targetRect.top - containerRect.top + targetRect.height * anchor.ratio;
  container.scrollTop += targetOffset;
  return true;
}

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, '\\$&');
}
