import { NextStepResponse } from "../schemas/demonstration";
import {
  createUserMessage,
  createBotMessage,
  processingTemplate,
} from "../templates/chatMessage";
import { createControlButtons } from "../templates/controlButtons";

interface StoppedState {
  demoId: string | null;
  goal: string | null;
  step_number: number | null;
}

export class ChatApp {
  private messages!: HTMLElement;
  private messageInput!: HTMLInputElement;
  private sendButton!: HTMLButtonElement;
  private modeToggle!: HTMLInputElement;
  private attachButton!: HTMLButtonElement;
  private inputContainer!: HTMLElement;

  // State management
  private isProcessing: boolean = false;
  private step_number: number = 0;
  private isManualMode: boolean = false;
  private shouldStop: boolean = false;
  private isPaused: boolean = false;
  private originalInputContent: string = "";
  private stoppedState: StoppedState = {
    demoId: null,
    goal: null,
    step_number: null,
  };

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
    this.inputContainer = document.getElementById(
      "input-container"
    ) as HTMLElement;
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

  private async getEvalPage(): Promise<any> {
    const response = await chrome.runtime.sendMessage({
      type: "GET_EVAL_PAGE",
    });
    if (response?.eval_page) {
      return response.eval_page;
    }
    console.error("Error getting eval page:", response.error);
    return null;
  }

  private async getNextStepResponse(
    goal: string,
    step_number: number,
    demoId: string | null
  ): Promise<NextStepResponse> {
    const params: Record<string, string> = {
      goal,
      step_number: step_number.toString(),
    };
    if (demoId) {
      params.demonstration_id = demoId;
    }

    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${this.api_url}/get_next_step?${query}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  private async takeAction(goal: string, demoId: string | null) {
    const eval_page = await this.getEvalPage();
    console.log("Eval page: ", eval_page);
    const next_step_response = await this.getNextStepResponse(
      goal,
      this.step_number,
      demoId
    );
    const response = await chrome.runtime.sendMessage({
      type: "TAKE_ACTION",
      goal: goal,
      next_step_response: next_step_response,
      manual_mode: this.isManualMode,
    });
    this.step_number++;
    return response;
  }

  private async takeActions(goal: string) {
    const demoId = this.messageInput.dataset.demoId || null;
    try {
      while (!this.shouldStop) {
        if (this.isPaused) {
          this.stoppedState = { demoId, goal, step_number: this.step_number };
          return;
        }
        const response = await this.takeAction(goal, demoId);

        if (response?.done || !response?.success) {
          if (!response?.success) {
            console.warn("Playwright action failed:", response.error);
          }
          break;
        }

        if (this.isManualMode) break;

        if (response?.autonomous_mode_ask_user_to_fill) {
          const pauseButton = document.getElementById(
            "pauseButton"
          ) as HTMLButtonElement;
          if (pauseButton) {
            pauseButton.click();
          }
          this.addBotMessage(
            "Fill the field which is highlighted in the page and then resume the process."
          );
        }

        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error("Failed to communicate with background script:", error);
    } finally {
      if (this.shouldStop || !this.isPaused) {
        this.cleanup(demoId);
      }
    }
  }

  private cleanup(demoId: string | null): void {
    if (demoId) {
      delete this.messageInput.dataset.demoId;
    }
    this.stoppedState = {
      demoId: null,
      goal: null,
      step_number: null,
    };
    this.removeProcessingElement();
    this.restoreInputContainer();
  }

  private restoreInputContainer(): void {
    if (this.shouldStop || !this.isPaused) {
      this.isProcessing = false;
      this.inputContainer.innerHTML = this.originalInputContent;
      this.messageInput = document.getElementById(
        "messageInput"
      ) as HTMLInputElement;
      this.sendButton = document.getElementById(
        "sendButton"
      ) as HTMLButtonElement;
      this.sendButton.disabled = false;
      this.attachEventListeners();
      if (!this.isManualMode) {
        this.step_number = 0;
      }
    }
  }

  private async resumeActions(): Promise<void> {
    if (this.stoppedState.goal) {
      this.messageInput.dataset.demoId = this.stoppedState.demoId!;
      this.step_number = this.stoppedState.step_number!;
      const goal = this.stoppedState.goal;
      this.stoppedState = {
        demoId: null,
        goal: null,
        step_number: null,
      };
      await this.takeActions(goal);
    }
  }

  private async sendMessage(): Promise<void> {
    const message = this.messageInput.value.trim();
    if (!message || this.isProcessing) return;

    this.addUserMessage(message);
    this.messageInput.value = "";
    await this.generateResponse(message);
    this.startProcessing();

    try {
      await this.takeActions(message);
    } finally {
      this.stopProcessing();
    }
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
  }

  private startProcessing(): void {
    this.isProcessing = true;
    this.shouldStop = false;
    this.isPaused = false;
    this.stoppedState = {
      demoId: null,
      goal: null,
      step_number: null,
    };
    this.sendButton.disabled = true;
    this.originalInputContent = this.inputContainer.innerHTML;
    this.inputContainer.innerHTML = createControlButtons(this.isManualMode);
    this.setupControlButtons();
    this.addProcessingElement();
  }

  private setupControlButtons(): void {
    const pauseButton = document.getElementById(
      "pauseButton"
    ) as HTMLButtonElement;
    const stopButton = document.getElementById("stopButton");

    if (pauseButton) {
      pauseButton.addEventListener("click", async () => {
        if (this.isManualMode) return;
        this.isPaused = !this.isPaused;
        this.updatePauseButtonState(pauseButton, this.isPaused);
        if (!this.isPaused) {
          await this.resumeActions();
        }
      });
    }

    if (stopButton) {
      stopButton.addEventListener("click", () => {
        this.shouldStop = true;
        this.isPaused = false;
        this.removeProcessingElement();
        this.restoreInputContainer();
        chrome.runtime.sendMessage({
          type: "STOP_PROCESSING",
        });
      });
    }
  }

  private stopProcessing(): void {
    this.removeProcessingElement();
    this.restoreInputContainer();
  }

  private async generateResponse(goal: string): Promise<void> {
    this.addBotMessage(`Taking action for goal: ${goal}`);
  }

  private scrollToBottom(): void {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}
