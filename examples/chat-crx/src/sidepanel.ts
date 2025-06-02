class ChatApp {
  private messages: HTMLElement;
  private messageInput: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private modeToggle: HTMLInputElement;
  private attachButton: HTMLButtonElement;
  private isProcessing: boolean = false;
  private step_number: number = 0;
  private isManualMode: boolean = true;
  private api_url: string = "http://localhost:8000/api/v1";

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
      this.isManualMode = !this.modeToggle.checked;
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

  private async post_request(end_point: string, data: any) {
    const response = await fetch(`${this.api_url}/${end_point}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test",
      },
      body: JSON.stringify(data),
    });
    // ## TODO: convert to object
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }

  private async getNextAction(goal: string, step_number: number) {
    const data = {
      goal: goal,
      step_number: step_number,
      demonstration_id: "b9e38a4b-794a-49f5-8ddf-19c1e6a07763",
    };

    try {
      const response = await this.post_request("get_next_step", data);
      return response;
    } catch (error) {
      console.error("Error getting next step:", error);
      throw error;
    }
  }

  private async takeAction(goal: string) {
    const eval_page = await this.getEvalPage();
    console.log("Eval page: ", eval_page);
    const next_action = await this.getNextAction(goal, this.step_number);
    const response = await chrome.runtime.sendMessage({
      type: "TAKE_ACTION",
      goal: goal,
      next_action: next_action,
      manual_mode: this.isManualMode,
    });
    this.step_number++;
    return response;
  }

  private async takeActions(goal: string) {
    try {
      while (true) {
        const response = await this.takeAction(goal);
        if (response && response.done) {
          break;
        } else if (response && !response.success) {
          console.warn("Playwright action failed:", response.error);
          break;
        }
        if (this.isManualMode) {
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error("Failed to communicate with background script:", error);
    }
  }

  private async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message || this.isProcessing) return;

    this.addUserMessage(message);
    this.messageInput.value = "";

    this.startProcessing();

    try {
      await this.takeActions(message);
    } finally {
      this.stopProcessing();
    }

    await this.generateResponse(message);
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

  private startProcessing(): void {
    this.isProcessing = true;
    this.sendButton.disabled = true;

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

  private stopProcessing(): void {
    const processingElement = this.messages.querySelector(".processing");
    if (processingElement) {
      this.messages.removeChild(processingElement);
    }

    this.isProcessing = false;
    this.sendButton.disabled = false;
  }

  private async generateResponse(goal: string): Promise<void> {
    this.addBotMessage(`Taking action for goal: ${goal}`);
  }

  private scrollToBottom() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}

// Initialize the chat app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
