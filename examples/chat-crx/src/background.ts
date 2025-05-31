import { crx, CrxApplication } from "playwright-crx";
import { takeAction } from "./actions";

let currentCrxApp: CrxApplication | null = null;
let currentTabId: number | null = null;

chrome.action.onClicked.addListener(async ({ id: tabId }) => {
  // Open the side panel
  if (tabId) {
    try {
      await chrome.sidePanel.open({ tabId });
      currentTabId = tabId;
      // Initialize playwright session for this tab
      if (!currentCrxApp) {
        currentCrxApp = await crx.start({ slowMo: 500 });
      }
    } catch (error) {
      console.error(
        "Error opening side panel or initializing playwright:",
        error
      );
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "USER_MESSAGE_SENT") {
    (async () => {
      try {
        if (!currentCrxApp) {
          currentCrxApp = await crx.start({ slowMo: 500 });
        }
        if (currentTabId) {
          const page = await currentCrxApp.attach(currentTabId);
          const success = await takeAction(message.next_action, page);
          sendResponse({ success: true, done: success === "Done" });
        } else {
          sendResponse({
            success: false,
            done: false,
            error: "No active page available",
          });
        }
      } catch (error) {
        console.error("Error executing playwright action:", error);
        sendResponse({
          success: false,
          done: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return true; // ✅ Important to keep the message channel open for async response
  }

  return false;
});

// Clean up when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (currentTabId === tabId) {
    currentTabId = null;
  }
});

// Clean up when extension is disabled/unloaded
chrome.runtime.onSuspend.addListener(async () => {
  if (currentCrxApp) {
    try {
      await currentCrxApp.close();
      currentCrxApp = null;
    } catch (error) {
      console.error("Error closing playwright session:", error);
    }
  }
});
