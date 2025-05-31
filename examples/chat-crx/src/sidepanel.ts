class ChatApp {
  private messages: HTMLElement;
  private messageInput: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private isProcessing: boolean = false;
  private step_number: number = 0;

  constructor() {
    this.messages = document.getElementById("messages") as HTMLElement;
    this.messageInput = document.getElementById(
      "messageInput"
    ) as HTMLInputElement;
    this.sendButton = document.getElementById(
      "sendButton"
    ) as HTMLButtonElement;

    this.init();
  }

  private init() {
    // Add event listeners
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Add welcome message
    this.addBotMessage("Hello! I'm Optexity AI. How can I help you today?");
  }

  private async getNextAction(goal: string, step_number: number) {
    const data = {
      goal: goal,
      step_number: step_number,
      demonstration_id: "2e59a56c-954e-4f8c-8043-e52fae6d83d3",
    };

    try {
      const response = await fetch(
        "http://localhost:8000/api/v1/get_next_step",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test",
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error getting next step:", error);
      throw error;
    }
  }

  private async notifyBackgroundScript(message: string) {
    try {
      while (true) {
        const next_action = await this.getNextAction(message, this.step_number);
        const response = await chrome.runtime.sendMessage({
          type: "USER_MESSAGE_SENT",
          message: message,
          next_action: next_action,
        });
        if (response && response.done) {
          break;
        } else if (response && !response.success) {
          console.warn("Playwright action failed:", response.error);
          break;
        }

        this.step_number++;
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error("Failed to communicate with background script:", error);
    }
  }

  private async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message || this.isProcessing) return;

    // Add user message
    this.addUserMessage(message);
    this.messageInput.value = "";

    // Show processing while notifying background script
    this.startProcessing();

    try {
      // Notify background script about user message
      await this.notifyBackgroundScript(message);
    } finally {
      // Hide processing when background script notification completes
      this.stopProcessing();
    }

    // Generate and show bot response
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

  private async generateResponse(userMessage: string): Promise<void> {
    // Dummy responses for now
    const responses = [
      "That's a great question! I'm currently processing your request and will provide a detailed response soon.",
      "I understand what you're asking. Let me analyze this information and get back to you with insights.",
      "Interesting perspective! Based on what you've shared, here are some thoughts to consider.",
      "Thank you for your message. I'm working on finding the best solution for your query.",
      "I appreciate your input. Let me process this and provide you with relevant information.",
      "Your question is very insightful. I'm analyzing the context to give you the most accurate response.",
      "That's a complex topic! I'm gathering the necessary information to provide you with a comprehensive answer.",
    ];

    const randomResponse =
      responses[Math.floor(Math.random() * responses.length)];

    // Add some variety by sometimes referencing the user's message
    const enhancedResponse =
      Math.random() > 0.5
        ? `Regarding "${userMessage.substring(0, 30)}${
            userMessage.length > 30 ? "..." : ""
          }", ${randomResponse.toLowerCase()}`
        : randomResponse;

    this.addBotMessage(enhancedResponse);
  }

  private scrollToBottom() {
    this.messages.scrollTop = this.messages.scrollHeight;
  }
}

// Initialize the chat app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
