import { ClickElementAction } from "../../schemas/demonstration";
import { DOMElementNode, DOMState } from "../dom/views";
import { ElementHandle, FrameLocator, Page } from "playwright-crx";

async function locateElement(
  page: Page,
  element: DOMElementNode
): Promise<ElementHandle | null> {
  let currentFrame: Page | FrameLocator = page;

  // Start with the target element and collect all parents
  const parents: DOMElementNode[] = [];
  let current = element;
  while (current.parent) {
    parents.push(current.parent);
    current = current.parent;
  }

  // Process all iframe parents in sequence (in reverse order - top to bottom)
  const iframes = parents.reverse().filter((item) => item.tagName === "iframe");
  for (const parent of iframes) {
    // this._config.includeDynamicAttributes defaults to true
    const cssSelector = parent.enhancedCssSelectorForElement(true);
    currentFrame = currentFrame.frameLocator(cssSelector);
  }

  const cssSelector = element.enhancedCssSelectorForElement(true);

  try {
    const elementHandle: ElementHandle | null = await currentFrame
      .locator(cssSelector)
      .elementHandle();

    if (elementHandle) {
      // Scroll element into view if needed
      //   const isHidden = await elementHandle.isHidden();
      //   if (!isHidden) {
      //     await this._scrollIntoViewIfNeeded(elementHandle);
      //   }
      return elementHandle;
    }
  } catch (error) {
    console.error("Failed to locate element:", error);
  }

  return null;
}

async function clickElementNode(
  page: Page,
  elementNode: DOMElementNode,
  doubleClick: boolean
): Promise<void> {
  //   try {
  // Highlight before clicking
  // if (elementNode.highlightIndex !== null) {
  //   await this._updateState(useVision, elementNode.highlightIndex);
  // }

  const element = await locateElement(page, elementNode);
  if (!element) {
    throw new Error(`Element: ${elementNode} not found`);
  }

  // // Scroll element into view if needed
  // await this._scrollIntoViewIfNeeded(element);

  try {
    // First attempt: Use Puppeteer's click method with timeout
    //   await Promise.race([
    //     element.click(),
    //     new Promise((_, reject) =>
    //       setTimeout(() => reject(new Error("Click timeout")), 2000)
    //     ),
    //   ]);
    if (doubleClick) {
      await element.dblclick({ timeout: 1500 });
    } else {
      await element.click({ timeout: 1500 });
    }
    //   await this._checkAndHandleNavigation();
  } catch (error) {
    // if URLNotAllowedError, throw it
    //   if (error instanceof URLNotAllowedError) {
    //     throw error;
    //   }
    //   // Second attempt: Use evaluate to perform a direct click
    //   logger.info("Failed to click element, trying again", error);
    //   try {
    //     await element.evaluate((el) => (el as HTMLElement).click());
    //   } catch (secondError) {
    //     // if URLNotAllowedError, throw it
    //     if (secondError instanceof URLNotAllowedError) {
    //       throw secondError;
    //     }
    //     throw new Error(
    //       `Failed to click element: ${
    //         secondError instanceof Error
    //           ? secondError.message
    //           : String(secondError)
    //       }`
    //     );
    //   }
    // }
    //   } catch (error) {
    //     throw new Error(
    //       `Failed to click element: ${elementNode}. Error: ${
    //         error instanceof Error ? error.message : String(error)
    //       }`
    //     );
  }
}

export async function clickElement(
  page: Page,
  state: DOMState,
  action: ClickElementAction
) {
  const elementNode = state?.selectorMap.get(action.index);
  if (!elementNode) {
    throw new Error(
      `Element with index ${action.index} does not exist - retry or use alternative actions`
    );
  }

  await clickElementNode(page, elementNode, action.double_click);

  //  BORROWED FROM chrome-extension/src/background/agent/actions/builder.ts
  //TODO: implement file uploader check
  //   // Check if element is a file uploader
  //   if (page.isFileUploader(elementNode)) {
  //     const msg = `Index ${input.index} - has an element which opens file upload dialog. To upload files please use a specific function to upload files`;
  //     logger.info(msg);
  //     return new ActionResult({
  //       extractedContent: msg,
  //       includeInMemory: true,
  //     });
  //   }

  // TODO: implement tab switching
  //   try {
  //     const initialTabIds = await this.context.browserContext.getAllTabIds();
  //     await page.clickElementNode(this.context.options.useVision, elementNode);
  //     let msg = `Clicked button with index ${input.index}: ${elementNode.getAllTextTillNextClickableElement(2)}`;
  //     logger.info(msg);

  //     // TODO: could be optimized by chrome extension tab api
  //     const currentTabIds = await this.context.browserContext.getAllTabIds();
  //     if (currentTabIds.size > initialTabIds.size) {
  //       const newTabMsg = 'New tab opened - switching to it';
  //       msg += ` - ${newTabMsg}`;
  //       logger.info(newTabMsg);
  //       // find the tab id that is not in the initial tab ids
  //       const newTabId = Array.from(currentTabIds).find(id => !initialTabIds.has(id));
  //       if (newTabId) {
  //         await this.context.browserContext.switchTab(newTabId);
  //       }
  //     }
  //     this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_OK, msg);
  //     return new ActionResult({ extractedContent: msg, includeInMemory: true });
  //   } catch (error) {
  //     const msg = `Element no longer available with index ${input.index} - most likely the page changed`;
  //     this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.ACT_FAIL, msg);
  //     return new ActionResult({
  //       error: error instanceof Error ? error.message : String(error),
  //     });
  //   }
}
