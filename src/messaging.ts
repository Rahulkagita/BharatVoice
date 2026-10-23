/**
 * Message contract between extension pieces.
 *
 * Stage 1 defines the shape here but does not implement content-script or
 * backend integration yet (Stages 2 and 3). This keeps the architecture ready
 * for page-context queries, field highlighting, and secure LLM messaging.
 */
export type BharatVoiceMessageType =
  | 'PING'
  | 'GET_SIDEPANEL_STATE'
  | 'HIGHLIGHT_FIELD'
  | 'CLEAR_HIGHLIGHTS'
  | 'QUERY_PAGE_CONTEXT';

export interface BharatVoiceMessage<T extends BharatVoiceMessageType = BharatVoiceMessageType> {
  type: T;
  payload: unknown;
  source: 'sidepanel' | 'content-script' | 'background';
  timestamp: number;
}

export function createMessage<T extends BharatVoiceMessageType>(
  type: T,
  payload: unknown,
  source: BharatVoiceMessage<T>['source']
): BharatVoiceMessage<T> {
  return { type, payload, source, timestamp: Date.now() };
}

export const PORT_NAME = 'bharatvoice';

/**
 * Send a typed message from the background worker to a content script.
 * Guarded so Stage 1 does not crash on tabs where content scripts are absent.
 */
export async function sendToTab(tabId: number, message: BharatVoiceMessage): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}
