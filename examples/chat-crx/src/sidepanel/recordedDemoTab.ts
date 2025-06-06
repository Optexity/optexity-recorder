import { Demonstration } from "../schemas/demonstration";
import { createDemoCard } from "../templates/demoCard";
import { emptyStateTemplate } from "../templates/emptyState";

export class RecordedDemoTab {
  private tabButtons;
  private tabContents;
  private demosList: HTMLElement;
  private messageInput: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private api_url: string =
    "http://localhost:8000/api/v1/dashboard/get_demonstrations";
  private demonstrations: Demonstration[] = [];

  constructor() {
    this.tabButtons = document.querySelectorAll(".tab-button");
    this.tabContents = document.querySelectorAll(".tab-content");
    this.demosList = document.getElementById("demos-list") as HTMLElement;
    this.messageInput = document.getElementById("messageInput") as HTMLInputElement;
    this.sendButton = document.getElementById("sendButton") as HTMLButtonElement;

    // Add click handlers to tab buttons
    this.tabButtons.forEach((button: Element) => {
      button.addEventListener("click", () => {
        const tab = (button as HTMLElement).dataset.tab as string;
        this.switchTab(tab);
        if (tab === "demos") {
          this.init();
        }
      });
    });
    this.init();
  }

  private async init() {
    if (this.demonstrations.length === 0) {
      this.demonstrations = await this.fetchDemo();
    }
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
      this.demosList.innerHTML = emptyStateTemplate;
      return;
    }

    this.demosList.innerHTML = this.demonstrations
      .map((demo) => createDemoCard(demo))
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
      // Switch to chat tab
      this.switchTab("chat");
      
      // Set the message input value
      this.messageInput.value = demo.goal;
      
      // Store the demonstration ID in a data attribute
      this.messageInput.dataset.demoId = demo.demonstration_id;
      
      // Trigger the send button click
      this.sendButton.click();
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
