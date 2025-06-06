import { NextStepResponse } from "../schemas/demonstration";
export class ChatApp {
  private messages: HTMLElement;
  private messageInput: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private modeToggle: HTMLInputElement;
  private attachButton: HTMLButtonElement;
  private isProcessing: boolean = false;
  private step_number: number = 0;
  private isManualMode: boolean = false;
  private api_url: string = "http://localhost:8000/api/v1";
  private shouldStop: boolean = false;
  private isPaused: boolean = false;
  private inputContainer: HTMLElement;
  private stoppedState: Record<string, any> = {
    demoId: null,
    goal: null,
    step_number: null,
  };
  private originalInputContent: string = "";

  constructor() {
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

    // Add event listeners
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Add mode toggle listener
    this.modeToggle.addEventListener("change", () => {
      this.isManualMode = this.modeToggle.checked;
      this.addBotMessage(
        `Switched to ${this.isManualMode ? "Manual" : "Autonomous"} mode`
      );
    });

    // Add attach button listener
    this.attachButton.addEventListener("click", () => this.attachCurrentTab());

    // Add welcome message
    this.addBotMessage("Hello! I'm Optexity AI. How can I help you today?");
  }

  private async attachCurrentTab() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ATTACH_TAB",
      });
      if (response && response.success) {
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

  private async getEvalPage() {
    const response = await chrome.runtime.sendMessage({
      type: "GET_EVAL_PAGE",
    });
    if (response && response.eval_page) {
      return response.eval_page;
    } else {
      console.error("Error getting eval page:", response.error);
      return null;
    }
  }

  private async getNextStepResponse(
    goal: string,
    step_number: number,
    demoId: string | null
  ) {
    const params: Record<string, string> = {
      goal: goal,
      step_number: step_number.toString(),
    };
    if (demoId !== null && demoId !== "") {
      params.demonstration_id = demoId;
    }

    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`${this.api_url}/get_next_step?${query}`, {
        method: "GET",
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const next_step_response: NextStepResponse = await response.json();
      return next_step_response;
    } catch (error) {
      console.error("Error getting next step:", error);
      throw error;
    }
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
    // Check if there's a demonstration ID in the input field
    const demoId = this.messageInput.dataset.demoId || null;
    try {
      while (!this.shouldStop) {
        if (this.isPaused) {
          // Save state before breaking the loop
          this.stoppedState = {
            demoId,
            goal,
            step_number: this.step_number,
          };
          return; // Return instead of break to prevent finally block execution
        }
        const response = await this.takeAction(goal, demoId);

        if (response && response.done) {
          break;
        } else if (response && !response.success) {
          console.warn("Playwright action failed:", response.error);
          break;
        }
        if (this.isManualMode) {
          break;
        }
        if (response && response.autonomous_mode_ask_user_to_fill) {
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
      // Only execute if we're actually stopping (not pausing)
      if (!this.isPaused) {
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
    }
  }

  private restoreInputContainer() {
    // Only restore if we're not paused
    if (!this.isPaused) {
      this.isProcessing = false;
      this.inputContainer.innerHTML = this.originalInputContent;

      // Re-acquire references to the new DOM elements
      this.messageInput = document.getElementById(
        "messageInput"
      ) as HTMLInputElement;
      this.sendButton = document.getElementById(
        "sendButton"
      ) as HTMLButtonElement;

      // Make sure the button is enabled
      this.sendButton.disabled = false;

      // Re-attach event listeners
      this.addEventListeners();

      if (!this.isManualMode) {
        this.step_number = 0;
      }
    }
  }

  private async sendMessage() {
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

  private addUserMessage(message: string) {
    const messageElement = document.createElement("div");
    messageElement.className = "message user";
    messageElement.textContent = message;
    this.messages.appendChild(messageElement);
    this.scrollToBottom();
  }

  private addBotMessage(message: string) {
    const messageElement = document.createElement("div");
    messageElement.className = "message bot";
    messageElement.textContent = message;
    this.messages.appendChild(messageElement);
    this.scrollToBottom();
  }

  private addProcessingElement() {
    const processingElement = document.createElement("div");
    processingElement.className = "processing";
    processingElement.innerHTML = `
        <div>Processing your message...</div>
        <div class="loading-bar">
          <div class="loading-progress"></div>
        </div>
      `;
    this.messages.appendChild(processingElement);
    this.scrollToBottom();
  }

  private removeProcessingElement() {
    const processingElement = this.messages.querySelector(".processing");
    if (processingElement) {
      this.messages.removeChild(processingElement);
    }
  }

  private updatePauseButtonState(
    pauseButton: HTMLButtonElement,
    isPaused: boolean
  ) {
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

  private async resumeActions() {
    if (this.stoppedState.goal) {
      this.messageInput.dataset.demoId = this.stoppedState.demoId;
      this.step_number = this.stoppedState.step_number;
      const goal = this.stoppedState.goal;
      this.stoppedState = {
        demoId: null,
        goal: null,
        step_number: null,
      };
      await this.takeActions(goal);
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

    // Store original content
    this.originalInputContent = this.inputContainer.innerHTML;

    // Replace input container with pause and stop buttons
    this.inputContainer.innerHTML = `
        <div class="input-wrapper" style="display: flex; gap: 8px;">
          <button id="pauseButton" class="control-button pause-button" style="background: #4a5568; color: white; border: none; padding: 8px 16px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; ${
            this.isManualMode ? "opacity: 0.5; pointer-events: none;" : ""
          }">
            <svg id="pauseIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
            <span>Pause</span>
          </button>
          <button id="stopButton" class="control-button stop-button" style="background: #e53e3e; color: white; border: none; padding: 8px 16px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 0.2s;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
            <span>Stop</span>
          </button>
        </div>
      `;

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
        this.stoppedState = {
          demoId: null,
          goal: null,
          step_number: null,
        };
        chrome.runtime.sendMessage({
          type: "STOP_PROCESSING",
        });
      });
    }

    this.addProcessingElement();
  }

  private stopProcessing(): void {
    this.removeProcessingElement();
    this.restoreInputContainer();
  }

  private addEventListeners(): void {
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  private async generateResponse(goal: string): Promise<void> {
    this.addBotMessage(`Taking action for goal: ${goal}`);
  }

  private scrollToBottom() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}
