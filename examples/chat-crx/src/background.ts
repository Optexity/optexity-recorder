import { Agent } from "./agent";

let currentAgent: Agent | null = null;
chrome.action.onClicked.addListener(async ({ id: tabId }) => {
  // Open the side panel
  if (tabId) {
    try {
      await chrome.sidePanel.open({ tabId });
      currentAgent = await Agent.init(tabId);
    } catch (error) {
      console.error(
        "Error opening side panel or initializing playwright:",
        error
      );
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TAKE_ACTION") {
    (async () => {
      if (currentAgent) {
        const success = await currentAgent.takeAction(
          message.next_action,
          message.manual_mode
        );
        sendResponse(success);
      } else {
        sendResponse({
          success: false,
          done: false,
          error: "No active agent available",
        });
      }
    })();

    return true; // ✅ Important to keep the message channel open for async response
  }

  if (message.type === "GET_EVAL_PAGE") {
    (async () => {
      if (currentAgent) {
        const eval_page = await currentAgent.getEvalPage();
        sendResponse({ eval_page: eval_page });
      } else {
        sendResponse({
          error: "No active agent available",
        });
      }
    })();

    return true; // ✅ Important to keep the message channel open for async response
  }

  return false;
});

// Clean up when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (currentAgent && currentAgent.getCurrentTabId() === tabId) {
    currentAgent.close();
    currentAgent = null;
  }
});

// Clean up when extension is disabled/unloaded
chrome.runtime.onSuspend.addListener(async () => {
  if (currentAgent) {
    try {
      await currentAgent.close();
      currentAgent = null;
    } catch (error) {
      console.error("Error closing playwright session:", error);
    }
  }
});
