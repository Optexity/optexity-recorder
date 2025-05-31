import { Locator, Page } from "playwright-crx";

export async function takeAction(action: any, page: Page) {
  if (action.next_action_name == "DoneAction") return "Done";
  if (action.next_action.locators == null) return false;
  if (action.next_action.locators.length == 0) return false;

  for (const locator of action.next_action.locators) {
    let element: Locator;
    switch (locator.locator_type) {
      case "getByText":
        element = page.getByText(locator.first_arg, locator.options);
        break;
      case "getByRole":
        element = page.getByRole(locator.first_arg, locator.options);
        break;
      case "getByLabel":
        element = page.getByLabel(locator.first_arg, locator.options);
        break;
      case "getByPlaceholder":
        element = page.getByPlaceholder(locator.first_arg, locator.options);
        break;
      case "getByAltText":
        element = page.getByAltText(locator.first_arg, locator.options);
        break;
      case "getByTitle":
        element = page.getByTitle(locator.first_arg, locator.options);
        break;
      case "getByTestId":
        element = page.getByTestId(locator.first_arg);
        break;
      case "locator":
        element = page.locator(locator.first_arg, locator.options);
        break;
      default:
        throw new Error(`Unknown locator type: ${locator.locator_type}`);
    }

    switch (action.next_action_name) {
      case "ClickElementAction":
        if (action.next_action.double_click) {
          await element.dblclick();
        } else {
          await element.click();
        }
        break;
      case "InputTextAction":
        await element.fill(action.next_action.text);
        break;
    }
  }
  return true;
}
