import { crx, CrxApplication } from "playwright-crx";
import { takeAction } from "./actions";
// @ts-ignore
import { buildDomTree } from "./buildDomTree";

let currentCrxApp: CrxApplication | null = null;
let currentTabId: number | null = null;
type BuildDomTreeArgs = {
  doHighlightElements: boolean;
  focusHighlightIndex: number;
  viewportExpansion: number;
  debugMode: boolean;
};
const args = {
  doHighlightElements: false,
  focusHighlightIndex: -1,
  viewportExpansion: -1,
  debugMode: false,
};
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
  if (message.type === "GET_EVAL_PAGE") {
    (async () => {
      try {
        if (!currentCrxApp) {
          currentCrxApp = await crx.start({ slowMo: 500 });
        }
        if (currentTabId) {
          const page = await currentCrxApp.attach(currentTabId);
          const eval_page = await page.evaluate(
            ({ args, fn }: { args: BuildDomTreeArgs; fn: string }) => {
              const func = eval(`(${fn})`);
              return func(args);
            },
            {
              args,
              fn: buildDomTree.toString(),
            }
          );
          sendResponse({ eval_page: eval_page });
        } else {
          sendResponse({
            error: "No active page available",
          });
        }
      } catch (error) {
        console.error("Error executing playwright action:", error);
        sendResponse({
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
