import { Agent } from "./agent";

let currentAgent: Agent | null = null;
chrome.action.onClicked.addListener(async ({ id: tabId }) => {
  // Open the side panel
  if (tabId) {
    try {
      await chrome.sidePanel.open({ tabId });
      if (currentAgent == null) {
        currentAgent = await Agent.init(tabId);
      } else {
        currentAgent.attach_new_tab(tabId);
      }
    } catch (error) {
      console.error(
        "Error opening side panel or initializing playwright:",
        error
      );
    }
  }
});

async function updateCurrentTabId() {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs.length > 0) {
      const newTabId = tabs[0].id;
      if (newTabId == null) {
        return;
      }
      if (currentAgent == null) {
        currentAgent = await Agent.init(newTabId);
      } else {
        currentAgent.attach_new_tab(newTabId);
      }
    }
  });
}

// Fired when the user switches tabs
chrome.tabs.onActivated.addListener(updateCurrentTabId);

// Fired when the user switches browser windows
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    updateCurrentTabId();
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

  if (message.type === "ATTACH_TAB") {
    (async () => {
      try {
        if (currentAgent == null) {
          currentAgent = await Agent.init(message.tabId);
        } else {
          currentAgent.attach_new_tab(message.tabId);
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error attaching to tab:", error);
        sendResponse({ success: false, error: "Failed to attach to tab" });
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

  if (message.type === "STOP_PROCESSING") {
    (async () => {
      if (currentAgent) {
        await currentAgent.stopProcessing();
        sendResponse({ success: true });
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
