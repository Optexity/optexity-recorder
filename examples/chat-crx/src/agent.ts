import { crx, CrxApplication } from "playwright-crx";
import assert from "assert";
import { Locator, Page } from "playwright-crx";
import { highlightDone, highlightElement, removeHighlight } from "./highlight";
// @ts-ignore
import { buildDomTree } from "./buildDomTree";

type BuildDomTreeArgs = {
  doHighlightElements: boolean;
  focusHighlightIndex: number;
  viewportExpansion: number;
  debugMode: boolean;
};

export class Agent {
  private currentCrxApp: CrxApplication;
  private currentTabId: number;

  private ClickElementAction = "ClickElementAction";
  private InputTextAction = "InputTextAction";
  private DoneAction = "DoneAction";

  private args = {
    doHighlightElements: false,
    focusHighlightIndex: -1,
    viewportExpansion: -1,
    debugMode: false,
  };

  constructor(tabId: number, crxApp: CrxApplication) {
    this.currentTabId = tabId;
    this.currentCrxApp = crxApp;
    assert(this.currentCrxApp != null, "CrxApp is null");
    assert(this.currentTabId != null, "TabId is null");
  }

  static async init(tabId: number): Promise<Agent> {
    const crxApp = await crx.start({ slowMo: 500 });
    return new Agent(tabId, crxApp);
  }

  attach_new_tab(tabId: number) {
    this.currentTabId = tabId;
  }

  async close() {
    await this.currentCrxApp.close();
  }

  getCurrentTabId() {
    return this.currentTabId;
  }

  private get_element(action: any, page: Page) {
    let element: Locator | Page = page;
    let is_locator_fixed = true;
    for (const locator of action.next_action.locators) {
      is_locator_fixed = is_locator_fixed && locator.fixed;
      switch (locator.locator_type) {
        case "getByText":
          element = element.getByText(locator.first_arg, locator.options);
          break;
        case "getByRole":
          element = element.getByRole(locator.first_arg, locator.options);
          break;
        case "getByLabel":
          element = element.getByLabel(locator.first_arg, locator.options);
          break;
        case "getByPlaceholder":
          element = element.getByPlaceholder(
            locator.first_arg,
            locator.options
          );
          break;
        case "getByAltText":
          element = element.getByAltText(locator.first_arg, locator.options);
          break;
        case "getByTitle":
          element = element.getByTitle(locator.first_arg, locator.options);
          break;
        case "getByTestId":
          element = element.getByTestId(locator.first_arg);
          break;
        case "locator":
          element = element.locator(locator.first_arg, locator.options);
          break;
        default:
          throw new Error(`Unknown locator type: ${locator.locator_type}`);
      }
    }
    return { element: element as Locator, is_locator_fixed };
  }

  async takeAction(action: any, manual_mode: boolean) {
    try {
      const page = await this.currentCrxApp.attach(this.currentTabId);
      await removeHighlight(page);
      if (action.next_action_name == this.DoneAction) {
        await highlightDone(page);
        return { success: true, done: true, ask_user_to_take_action: false };
      }
      if (
        action.next_action.locators == null ||
        action.next_action.locators.length == 0
      )
        return { success: false, done: false, ask_user_to_take_action: false };

      const { element, is_locator_fixed } = this.get_element(action, page);
      if (element == null)
        return { success: false, done: false, ask_user_to_take_action: false };

      if (is_locator_fixed) {
        const prefix =
          action.next_action_name == this.ClickElementAction
            ? "Clicking on"
            : "Typing on";

        await highlightElement(
          page,
          element,
          `${prefix} ${await element.innerText()}`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!manual_mode) {
          switch (action.next_action_name) {
            case this.ClickElementAction:
              if (action.next_action.double_click) {
                await element.dblclick();
              } else {
                await element.click();
              }
              break;
            case this.InputTextAction:
              await element.fill(action.next_action.text);
              break;
          }
          await removeHighlight(page);
        }
      }

      const ask_user_to_take_action = manual_mode || !is_locator_fixed;

      return {
        success: true,
        done: false,
        ask_user_to_take_action: ask_user_to_take_action,
      };
    } catch (error) {
      console.error("Error executing playwright action:", error);
      return { success: false, done: false };
    }
  }

  async getEvalPage() {
    try {
      const page = await this.currentCrxApp.attach(this.currentTabId);
      const eval_page = await page.evaluate(
        ({ args, fn }: { args: BuildDomTreeArgs; fn: string }) => {
          const func = eval(`(${fn})`);
          return func(args);
        },
        {
          args: this.args,
          fn: buildDomTree.toString(),
        }
      );
      return eval_page;
    } catch (error) {
      console.error("Error evaluating page:", error);
      return null;
    }
  }
}
