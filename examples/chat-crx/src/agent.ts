import { crx, CrxApplication } from "playwright-crx";
import { takeAction } from "./actions";
import assert from "assert";
// @ts-ignore
import { buildDomTree } from "./buildDomTree";

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

export class Agent {
  private currentCrxApp: CrxApplication;
  private currentTabId: number;

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

  async close() {
    await this.currentCrxApp.close();
  }

  getCurrentTabId() {
    return this.currentTabId;
  }

  async getNextStep(next_action: any) {
    try {
      const page = await this.currentCrxApp.attach(this.currentTabId);
      const success = await takeAction(next_action, page);
      return { success: true, done: success === "Done" };
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
          args,
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
