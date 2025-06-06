import { Demonstration } from "../schemas/demonstration";

export class RecordedDemoTab {
  private tabButtons;
  private tabContents;
  private demosList: HTMLElement;
  private emptyState: HTMLElement;
  private api_url: string =
    "http://localhost:8000/api/v1/dashboard/get_demonstrations";
  private demonstrations: Demonstration[] = [];

  constructor() {
    this.tabButtons = document.querySelectorAll(".tab-button");
    this.tabContents = document.querySelectorAll(".tab-content");
    this.demosList = document.getElementById("demos-list") as HTMLElement;
    this.emptyState = document.getElementById("empty-state") as HTMLElement;

    // Add click handlers to tab buttons
    this.tabButtons.forEach((button: Element) => {
      button.addEventListener("click", () => {
        const tab = (button as HTMLElement).dataset.tab as string;
        this.switchTab(tab);
        if (tab === "demos") {
          this.loadDemonstrations();
        }
      });
    });
    this.init();
  }

  private async init() {
    this.demonstrations = await this.fetchDemo();
    this.loadDemonstrations();
  }

  private async fetchDemo(): Promise<Demonstration[]> {
    try {
      const response = await fetch(this.api_url, {
        headers: {
          Authorization: `Bearer test`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch demonstration");
      const data: Demonstration[] = await response.json();
      return data;
    } catch (err) {
      console.error("Error fetching demo:", err);
      return [];
    }
  }

  private loadDemonstrations() {
    if (this.demonstrations.length === 0) {
      this.emptyState.style.display = "flex";
      return;
    }

    this.emptyState.style.display = "none";
    this.demosList.innerHTML = this.demonstrations
      .map(
        (demo) => `
        <div class="demo-card" data-demo-id="${demo.demonstration_id}">
          <div class="url">
            <span class="url-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
            </span>
            ${demo.url}
          </div>
          <div class="goal">${demo.goal}</div>
          <div class="demo-card-actions">
            <button class="demo-card-button replay-button" data-action="replay">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"></path>
                <path d="M12 2v4"></path>
                <path d="M12 18v4"></path>
                <path d="M4.93 4.93l2.83 2.83"></path>
                <path d="M16.24 16.24l2.83 2.83"></path>
                <path d="M2 12h4"></path>
                <path d="M18 12h4"></path>
                <path d="M4.93 19.07l2.83-2.83"></path>
                <path d="M16.24 7.76l2.83-2.83"></path>
              </svg>
              Replay
            </button>
            <button class="demo-card-button edit-button" data-action="edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              </svg>
              Edit
            </button>
          </div>
        </div>
      `
      )
      .join("");

    // Add click handlers to buttons
    const buttons = this.demosList.querySelectorAll(".demo-card-button");
    buttons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent card click
        const card = (button as HTMLElement).closest(
          ".demo-card"
        ) as HTMLElement;
        const demoId = card.dataset.demoId as string;
        const action = (button as HTMLElement).dataset.action;

        if (action === "replay") {
          this.handleReplayClick(demoId);
        } else if (action === "edit") {
          this.handleEditClick(demoId);
        }
      });
    });
  }

  private handleReplayClick(demoId: string) {
    const demo = this.demonstrations.find((d) => d.demonstration_id === demoId);
    if (demo) {
      console.log("Replaying demonstration:", demo);
      // Add replay logic here
    }
  }

  private handleEditClick(demoId: string) {
    const demo = this.demonstrations.find((d) => d.demonstration_id === demoId);
    if (demo) {
      console.log("Editing demonstration:", demo);
      // Add edit logic here
    }
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
