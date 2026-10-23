/**
 * BharatVoice background service worker (Manifest V3).
 *
 * Stage 1 responsibilities:
 *  - Configure the Side Panel API so clicking the extension action opens
 *    the side panel alongside the current page.
 *  - Provide a message port surface for future content-script (Stage 3)
 *    and backend (Stage 2) integration.
 *
 * No AI, no backend, no government data access happens here.
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
