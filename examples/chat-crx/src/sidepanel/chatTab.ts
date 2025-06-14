import { NextStepResponse } from "../schemas/demonstration";
import {
  createUserMessage,
  createBotMessage,
  processingTemplate,
} from "../templates/chatMessage";
import { createControlButtons } from "../templates/controlButtons";
import { compressToEncodedURIComponent } from "lz-string";

export class ChatApp {
  private messages!: HTMLElement;
  private messageInput!: HTMLInputElement;
  private sendButton!: HTMLButtonElement;
  private modeToggle!: HTMLInputElement;
  private attachButton!: HTMLButtonElement;
  private highlightButton!: HTMLButtonElement;
  private inputContainer!: HTMLElement;
  private userGoal: string | null = null;

  // State management
  private step_number: number = 0;
  private isManualMode: boolean = false;
  private shouldStop: boolean = false;
  private isPaused: boolean = false;
  private isHighlightEnabled: boolean = false;
  private originalInputContent: string = "";

  // Configuration
  private readonly api_url: string = "http://localhost:8000/api/v1";

  constructor() {
    this.initializeElements();
    this.attachEventListeners();
    this.addBotMessage("Hello! I'm Optexity AI. How can I help you today?");
  }

  private initializeElements(): void {
    this.messages = document.getElementById("messages") as HTMLElement;
    this.messageInput = document.getElementById(
      "messageInput"
    ) as HTMLInputElement;
    this.sendButton = document.getElementById(
      "sendButton"
    ) as HTMLButtonElement;
    this.modeToggle = document.getElementById("modeToggle") as HTMLInputElement;
    this.attachButton = document.getElementById(
      "attachButton"
    ) as HTMLButtonElement;
    this.highlightButton = document.getElementById(
      "highlightButton"
    ) as HTMLButtonElement;
    this.inputContainer = document.getElementById(
      "input-container"
    ) as HTMLElement;

    this.originalInputContent = this.inputContainer.innerHTML;
  }

  private attachEventListeners(): void {
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.modeToggle.addEventListener("change", () => {
      this.isManualMode = this.modeToggle.checked;
      this.addBotMessage(
        `Switched to ${this.isManualMode ? "Manual" : "Autonomous"} mode`
      );
    });

    this.attachButton.addEventListener("click", () => this.attachCurrentTab());

    this.highlightButton.addEventListener("click", () =>
      this.toggleHighlight()
    );
  }

  private async getEvalPage(): Promise<{
    eval_page: Record<string, any> | null;
    url: string | null;
    page_title: string | null;
  }> {
    const response = await chrome.runtime.sendMessage({
      type: "GET_EVAL_PAGE",
    });
    if (response?.eval_page) {
      return response;
    }
    console.error("Error getting eval page:", response.error);
    return {
      eval_page: null,
      url: null,
      page_title: null,
    };
  }

  private async getNextStepResponse(
    goal: string,
    step_number: number,
    eval_page: Record<string, any> | null,
    url: string | null,
    page_title: string | null,
    demoId: string | null
  ): Promise<NextStepResponse> {
    const params: Record<string, string> = {
      goal,
      step_number: step_number.toString(),
      current_try: "0",
    };
    if (demoId !== null) {
      params.demonstration_id = demoId;
    }
    let body: Record<string, string> = {};
    if (eval_page !== null) {
      body.eval_page = compressToEncodedURIComponent(JSON.stringify(eval_page));
      body.url = url || "";
      body.page_title = page_title || "";
    }

    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${this.api_url}/get_next_step?${query}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  private async takeAction(goal: string, demoId: string | null) {
    const { eval_page, url, page_title } = await this.getEvalPage();
    const next_step_response = await this.getNextStepResponse(
      goal,
      this.step_number,
      eval_page,
      url,
      page_title,
      demoId
    );
    const response = await chrome.runtime.sendMessage({
      type: "TAKE_ACTION",
      goal: goal,
      next_step_response: next_step_response,
      manual_mode: this.isManualMode,
      is_replay: demoId !== null,
    });
    this.step_number++;
    return response;
  }

  private async takeActions() {
    const goal = this.userGoal;
    if (goal === null) return;

    const demoId = this.messageInput.dataset.demoId || null;
    try {
      while (!this.shouldStop && !this.isPaused) {
        const response = await this.takeAction(goal, demoId);

        if (response.done || !response.success) {
          if (!response.success) {
            console.warn("Playwright action failed:", response.error);
          }
          break;
        }

        if (this.isManualMode || response.autonomous_mode_ask_user_to_fill)
          await this.onPauseButtonClick();
        if (response.autonomous_mode_ask_user_to_fill) {
          this.addBotMessage(
            "Fill the field which is highlighted in the page and then resume the process."
          );
        }

        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error("Failed to communicate with background script:", error);
    } finally {
      if (!this.isPaused) this.cleanup();
    }
  }

  private cleanup(): void {
    this.step_number = 0;
    this.removeProcessingElement();
    this.shouldStop = false;
    this.isPaused = false;
    this.inputContainer.innerHTML = this.originalInputContent;

    if (this.messageInput.dataset.demoId) {
      delete this.messageInput.dataset.demoId;
    }

    // Reinitialize elements after resetting the input container
    this.initializeElements();
    this.attachEventListeners();
  }

  private async sendMessage(): Promise<void> {
    const message = this.messageInput.value.trim();
    if (!message) return;

    this.addUserMessage(message);
    this.messageInput.value = "";
    this.addBotMessage(`Taking action for goal: ${message}`);
    this.userGoal = message;

    this.inputContainer.innerHTML = createControlButtons();
    this.setupControlButtons();
    this.addProcessingElement();

    await this.takeActions();
  }

  private addUserMessage(message: string): void {
    const messageElement = document.createElement("div");
    messageElement.innerHTML = createUserMessage(message);
    this.messages.appendChild(messageElement.firstElementChild!);
    this.scrollToBottom();
  }

  private addBotMessage(message: string): void {
    const messageElement = document.createElement("div");
    messageElement.innerHTML = createBotMessage(message);
    this.messages.appendChild(messageElement.firstElementChild!);
    this.scrollToBottom();
  }

  private addProcessingElement(): void {
    const element = document.createElement("div");
    element.innerHTML = processingTemplate;
    this.messages.appendChild(element.firstElementChild!);
    this.scrollToBottom();
  }

  private removeProcessingElement(): void {
    const processingElement = this.messages.querySelector(".processing");
    if (processingElement) {
      this.messages.removeChild(processingElement);
    }
  }

  private async onPauseButtonClick(): Promise<void> {
    this.removeProcessingElement();
    const pauseButton = document.getElementById(
      "pauseButton"
    ) as HTMLButtonElement;
    if (!pauseButton) return;
    this.isPaused = !this.isPaused;
    this.updatePauseButtonState(pauseButton, this.isPaused);
    if (!this.isPaused) {
      this.addProcessingElement();
      await this.takeActions();
    }
  }

  private setupControlButtons(): void {
    const pauseButton = document.getElementById(
      "pauseButton"
    ) as HTMLButtonElement;
    const stopButton = document.getElementById("stopButton");

    if (pauseButton) {
      pauseButton.addEventListener("click", async () =>
        this.onPauseButtonClick()
      );
    }

    if (stopButton) {
      stopButton.addEventListener("click", () => {
        this.cleanup();
        this.shouldStop = true;
        chrome.runtime.sendMessage({
          type: "STOP_PROCESSING",
        });
      });
    }
  }

  private scrollToBottom(): void {
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  private toggleHighlight(): void {
    this.isHighlightEnabled = !this.isHighlightEnabled;
    this.highlightButton.classList.toggle("active");
    this.highlightButton.textContent = this.isHighlightEnabled
      ? "Hide Highlight"
      : "Show Highlight";
    chrome.runtime.sendMessage({
      type: "TOGGLE_HIGHLIGHT",
      is_highlight_enabled: this.isHighlightEnabled,
    });
  }

  private async attachCurrentTab(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ATTACH_TAB",
      });
      if (response?.success) {
        this.addBotMessage("Successfully attached to the current tab!");
      } else {
        this.addBotMessage(
          "Failed to attach to the current tab: " + response.error
        );
      }
    } catch (error) {
      console.error("Error attaching to tab:", error);
      this.addBotMessage(
        "Failed to attach to the current tab. Please try again."
      );
    }
  }

  private updatePauseButtonState(
    pauseButton: HTMLButtonElement,
    isPaused: boolean
  ): void {
    const pauseIcon = document.getElementById("pauseIcon");
    if (pauseIcon) {
      if (isPaused) {
        pauseIcon.innerHTML = `<path d="M5 3l14 9-14 9V3z" fill="currentColor"/>`;
        pauseButton.querySelector("span")!.textContent = "Resume";
        pauseButton.style.background = "#48bb78";
      } else {
        pauseIcon.innerHTML = `
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        `;
        pauseButton.querySelector("span")!.textContent = "Pause";
        pauseButton.style.background = "#4a5568";
      }
    }

    // Ensure button remains interactive
    pauseButton.style.cursor = "pointer";
    pauseButton.disabled = false;
  }
}
