import { Locator, Page } from "playwright-crx";
import { highlightDone, highlightElement, removeHighlight } from "./highlight";

export async function takeAction(action: any, page: Page) {
  console.log("takeAction", action);
  if (action.next_action_name == "DoneAction") {
    await highlightDone(page);
    return "Done";
  }
  if (action.next_action.locators == null) return false;
  if (action.next_action.locators.length == 0) return false;

  let element: Locator | null = null;
  for (const locator of action.next_action.locators) {
    switch (locator.locator_type) {
      case "getByText":
        if (element != null) {
          element = element.getByText(locator.first_arg, locator.options);
        } else {
          element = page.getByText(locator.first_arg, locator.options);
        }
        break;
      case "getByRole":
        if (element != null) {
          element = element.getByRole(locator.first_arg, locator.options);
        } else {
          element = page.getByRole(locator.first_arg, locator.options);
        }
        break;
      case "getByLabel":
        if (element != null) {
          element = element.getByLabel(locator.first_arg, locator.options);
        } else {
          element = page.getByLabel(locator.first_arg, locator.options);
        }
        break;
      case "getByPlaceholder":
        if (element != null) {
          element = element.getByPlaceholder(
            locator.first_arg,
            locator.options
          );
        } else {
          element = page.getByPlaceholder(locator.first_arg, locator.options);
        }
        break;
      case "getByAltText":
        if (element != null) {
          element = element.getByAltText(locator.first_arg, locator.options);
        } else {
          element = page.getByAltText(locator.first_arg, locator.options);
        }
        break;
      case "getByTitle":
        if (element != null) {
          element = element.getByTitle(locator.first_arg, locator.options);
        } else {
          element = page.getByTitle(locator.first_arg, locator.options);
        }
        break;
      case "getByTestId":
        if (element != null) {
          element = element.getByTestId(locator.first_arg);
        } else {
          element = page.getByTestId(locator.first_arg);
        }
        break;
      case "locator":
        if (element != null) {
          element = element.locator(locator.first_arg, locator.options);
        } else {
          element = page.locator(locator.first_arg, locator.options);
        }
        break;
      default:
        throw new Error(`Unknown locator type: ${locator.locator_type}`);
    }
  }
  if (element == null) return false;

  switch (action.next_action_name) {
    case "ClickElementAction":
      await highlightElement(page, element, `Clicking on ${await element.innerText()}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (action.next_action.double_click) {
        await element.dblclick();
      } else {
        await element.click();
      }
      await removeHighlight(page);
      break;
    case "InputTextAction":
      await highlightElement(page, element, `Typing on ${await element.innerText()}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await element.fill(action.next_action.text);
      await removeHighlight(page);
      break;
  }
  return true;
}
