import { Demonstration } from "../schemas/demonstration";

export class RecordedDemoTab {
  private tabButtons;
  private tabContents;
  private api_url: string =
    "http://localhost:8000/api/v1/dashboard/get_demonstrations";
  private demonstrations: Demonstration[] = [];

  constructor() {
    this.tabButtons = document.querySelectorAll(".tab-button");
    this.tabContents = document.querySelectorAll(".tab-content");
    // Add click handlers to tab buttons
    this.tabButtons.forEach((button: Element) => {
      button.addEventListener("click", () => {
        this.switchTab((button as HTMLElement).dataset.tab as string);
      });
    });

    this.fetchDemo()
      .then((demonstrations) => {
        this.demonstrations = demonstrations;
      })
      .catch((err) => {
        console.error("Error fetching demo:", err);
      });

    console.log("Got demonstrations of length:", this.demonstrations.length);
    console.log("Got demonstrations:", this.demonstrations);
  }

  private async fetchDemo(): Promise<Demonstration[]> {
    const response = await fetch(this.api_url, {
      headers: {
        Authorization: `Bearer test`,
      },
    });
    if (!response.ok) throw new Error("Failed to fetch demonstration");
    const data: Demonstration[] = await response.json();
    return data;
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
