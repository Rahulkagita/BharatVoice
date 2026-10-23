/**
 * BharatVoice background service worker (Manifest V3).
 *
 * Responsibilities:
 *  - Configure the Side Panel API so clicking the extension action opens
 *    the side panel alongside the current page.
 *  - Provide a message port surface for future content-script integration.
 *
 * Chat requests originate in the side panel (see src/api.ts); the service
 * worker does not hold the Gemini key or make provider calls.
 */

const EXTENSION_NAME = 'BharatVoice';

void (async () => {
  try {
    if (chrome.sidePanel?.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      console.log(`[${EXTENSION_NAME}] Side panel behavior configured: openPanelOnActionClick = true`);
    } else {
      console.warn(`[${EXTENSION_NAME}] chrome.sidePanel API is not available in this Chrome version`);
    }
  } catch (err) {
    console.warn(`[${EXTENSION_NAME}] Failed to configure side panel behavior:`, err);
  }
})();

console.log(`[${EXTENSION_NAME}] Background service worker started`);

// Placeholder port handler for Stage 3 content-script integration.
// chrome.runtime.onConnect is kept minimal so the architecture is ready for
// page-context messaging without implementing it prematurely.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'bharatvoice') return;
  console.debug(`[${EXTENSION_NAME}] Port connected:`, port.name);
  port.onDisconnect.addListener(() => {
    console.debug(`[${EXTENSION_NAME}] Port disconnected:`, port.name);
  });
});
