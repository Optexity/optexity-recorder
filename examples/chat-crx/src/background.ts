/**
 * Copyright (c) Rui Figueira.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { crx, CrxApplication } from "playwright-crx";

let currentCrxApp: CrxApplication | null = null;
let currentTabId: number | null = null;

chrome.action.onClicked.addListener(async ({ id: tabId }) => {
  // Open the side panel
  if (tabId) {
    await chrome.sidePanel.open({ tabId });
    currentTabId = tabId;
    // Initialize playwright session for this tab
    if (!currentCrxApp) {
      currentCrxApp = await crx.start({ slowMo: 500 });
    }
  }
});

// Listen for messages from the sidepanel
chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  if (message.type === "USER_MESSAGE_SENT") {
    try {
      if (!currentCrxApp) {
        currentCrxApp = await crx.start({ slowMo: 500 });
      }
      // Execute the playwright action after user message
      if (currentTabId) {
        const page = await currentCrxApp.attach(currentTabId);
        await page.getByRole("link", { name: "Sign in" }).click();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "No active page available" });
      }
    } catch (error) {
      console.error("Error executing playwright action:", error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Return true to indicate we'll send a response asynchronously
  return true;
});
