import {
  crx,
  CrxApplication,
  Locator,
  Page,
  FrameLocator,
} from "playwright-crx";
import assert from "assert";
import { highlightDone, highlightElement, removeHighlight } from "../highlight";
// @ts-ignore
import { buildDomTree } from "../buildDomTree";
import { BuildDomTreeResult } from "./dom/raw_types";
import {
  ClickElementAction,
  InputTextAction,
  NextStepResponse,
} from "../schemas/demonstration";
import { _constructDomTree } from "./dom/service";
import { DOMState } from "./dom/views";
import { clickElement, inputElement } from "./actions/action";

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
  private shouldStop = false;
  private eval_page: BuildDomTreeResult | null = null;
  private dom_state: DOMState | null = null;

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

  toggleHighlight(is_highlight_enabled: boolean) {
    this.args.doHighlightElements = is_highlight_enabled;
  }

  async close() {
    await this.currentCrxApp.close();
  }

  getCurrentTabId() {
    return this.currentTabId;
  }

  private get_element(
    action: ClickElementAction | InputTextAction,
    page: Page
  ) {
    let element: Locator | Page | FrameLocator = page;
    let is_locator_fixed = true;

    console.log("action ", action);
    for (const locator of action.locators) {
      is_locator_fixed = is_locator_fixed && locator.fixed;
      switch (locator.locator_type) {
        case "getByText":
          element = element.getByText(
            locator.first_arg as string,
            locator.options
          );
          break;
        case "getByRole":
          // @ts-ignore
          element = element.getByRole(locator.first_arg, locator.options);
          break;
        case "getByLabel":
          element = element.getByLabel(
            locator.first_arg as string,
            locator.options
          );
          break;
        case "getByPlaceholder":
          element = element.getByPlaceholder(
            locator.first_arg as string,
            locator.options
          );
          break;
        case "getByAltText":
          element = element.getByAltText(
            locator.first_arg as string,
            locator.options
          );
          break;
        case "getByTitle":
          element = element.getByTitle(
            locator.first_arg as string,
            locator.options
          );
          break;
        case "getByTestId":
          element = element.getByTestId(locator.first_arg as string);
          break;
        case "locator":
          element = element.locator(
            locator.first_arg as string,
            locator.options
          );
          break;
        case "contentFrame":
          element = (element as Locator).contentFrame();
          break;
        case "first":
          element = (element as Locator).first();
          break;
        case "last":
          element = (element as Locator).last();
          break;
        case "nth":
          element = (element as Locator).nth(locator.first_arg as number);
          break;
        default:
          throw new Error(`Unknown locator type: ${locator.locator_type}`);
      }
    }
    return { element: element as Locator, is_locator_fixed };
  }

  async takeActionIndex(page: Page, next_step_response: NextStepResponse) {
    let autonomous_mode_ask_user_to_fill = false;
    if (this.dom_state == null) return autonomous_mode_ask_user_to_fill;
    const next_action_name = next_step_response.next_action_name;
    if (next_action_name == this.ClickElementAction) {
      const next_action = next_step_response.next_action as ClickElementAction;

      await clickElement(page, this.dom_state, next_action);
    } else if (next_action_name == this.InputTextAction) {
      const input_action = next_step_response.next_action as InputTextAction;
      if (input_action.text == null || input_action.text.trim() == "")
        autonomous_mode_ask_user_to_fill = true;
      else await inputElement(page, this.dom_state, input_action);
    } else {
      throw new Error(`Unknown action name: ${next_action_name}`);
    }
    return autonomous_mode_ask_user_to_fill;
  }

  async takeAction(
    next_step_response: NextStepResponse,
    manual_mode: boolean,
    is_replay: boolean
  ) {
    this.shouldStop = false;
    try {
      const page = await this.currentCrxApp.attach(this.currentTabId);
      await removeHighlight(page);

      const next_action_name = next_step_response.next_action_name;

      if (next_action_name == this.DoneAction) {
        await highlightDone(page);
        return { success: true, done: true, ask_user_to_take_action: false };
      }

      let next_action = next_step_response.next_action as
        | ClickElementAction
        | InputTextAction;

      let autonomous_mode_ask_user_to_fill = false;
      if (next_action.index != null && next_action.index >= 0) {
        // TODO: add highlight here
        autonomous_mode_ask_user_to_fill = await this.takeActionIndex(
          page,
          next_step_response
        );
        return {
          success: true,
          done: false,
          ask_user_to_take_action: false,
          autonomous_mode_ask_user_to_fill: autonomous_mode_ask_user_to_fill,
        };
      }

      if (next_action.locators == null || next_action.locators.length == 0)
        return { success: false, done: false, ask_user_to_take_action: false };

      const { element, is_locator_fixed } = this.get_element(next_action, page);
      if (element == null)
        return { success: false, done: false, ask_user_to_take_action: false };

      if (is_locator_fixed || is_replay) {
        const prefix =
          next_action_name == this.ClickElementAction
            ? "Clicking on"
            : "Typing on";
        let action_description = next_action.action_description;
        if (action_description == null)
          action_description = `${prefix} ${await element.innerText()}`;

        await highlightElement(page, element, action_description);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!manual_mode && !this.shouldStop) {
          await removeHighlight(page);
          console.log("next_action_name ", next_action_name, next_action);
          console.log("element ", element);
          switch (next_action_name) {
            case this.ClickElementAction:
              const click_action = next_action as ClickElementAction;
              if (click_action.double_click) {
                await element.dblclick();
              } else {
                await element.click();
              }
              break;
            case this.InputTextAction:
              const input_action = next_action as InputTextAction;
              if (input_action.text == null || input_action.text.trim() == "")
                autonomous_mode_ask_user_to_fill = true;
              else await element.fill(input_action.text.trim());

              break;
          }
        }
      }

      const ask_user_to_take_action =
        manual_mode || !(is_locator_fixed || is_replay);

      return {
        success: true,
        done: false,
        ask_user_to_take_action: ask_user_to_take_action,
        autonomous_mode_ask_user_to_fill: autonomous_mode_ask_user_to_fill,
      };
    } catch (error) {
      console.error("Error executing playwright action:", error);
      return { success: false, done: false };
    }
  }

  async removeHighlights(page: Page) {
    try {
      await page.evaluate(() => {
        // Remove the highlight container
        const container = document.getElementById(
          "playwright-highlight-container"
        );
        if (container) container.remove();

        // Remove highlight attributes
        const highlightedElements = document.querySelectorAll(
          '[browser-user-highlight-id^="playwright-highlight-"]'
        );
        for (const el of highlightedElements) {
          el.removeAttribute("browser-user-highlight-id");
        }
      });
    } catch (error) {
      console.error("Error removing highlights:", error);
    }
  }

  async getEvalPage() {
    try {
      const page = await this.currentCrxApp.attach(this.currentTabId);
      await this.removeHighlights(page);
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
      this.eval_page = await page.evaluate(
        ({ args, fn }: { args: BuildDomTreeArgs; fn: string }) => {
          const func = eval(`(${fn})`);
          return func(args);
        },
        {
          args: this.args,
          fn: buildDomTree.toString(),
        }
      );
      if (this.eval_page == null) {
        throw new Error("Failed to evaluate page");
      }
      const [elementTree, selectorMap] = _constructDomTree(this.eval_page);
      this.dom_state = {
        elementTree: elementTree,
        selectorMap: selectorMap,
      };
      return this.eval_page;
    } catch (error) {
      console.error("Error evaluating page:", error);
      return null;
    }
  }

  async getUrl() {
    try {
      const page = await this.currentCrxApp.attach(this.currentTabId);
      return page.url();
    } catch (error) {
      console.error("Error getting url:", error);
      return null;
    }
  }

  async getPageTitle() {
    try {
      const page = await this.currentCrxApp.attach(this.currentTabId);
      return page.title();
    } catch (error) {
      console.error("Error getting page title:", error);
      return null;
    }
  }

  async stopProcessing() {
    try {
      this.shouldStop = true;
      const page = await this.currentCrxApp.attach(this.currentTabId);
      await removeHighlight(page);
    } catch (error) {
      console.error("Error stopping processing:", error);
    }
  }
}
