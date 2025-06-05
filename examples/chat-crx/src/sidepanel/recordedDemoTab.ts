export class RecordedDemoTab {
  private tabButtons;
  private tabContents;

  constructor() {
    this.tabButtons = document.querySelectorAll(".tab-button");
    this.tabContents = document.querySelectorAll(".tab-content");
    // Add click handlers to tab buttons
    this.tabButtons.forEach((button: Element) => {
      button.addEventListener("click", () => {
        this.switchTab((button as HTMLElement).dataset.tab as string);
      });
    });
  }

  private switchTab(tabId: string) {
    // Update button states
    this.tabButtons.forEach((button: Element) => {
      button.classList.toggle(
        "active",
        (button as HTMLElement).dataset.tab === tabId
      );
    });

    // Update content visibility
    this.tabContents.forEach((content: Element) => {
      content.classList.toggle("active", content.id === `${tabId}-tab`);
    });
  }
}

