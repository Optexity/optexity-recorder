class ChatApp {
  private messages: HTMLElement;
  private messageInput: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private isProcessing: boolean = false;

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

  private async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message || this.isProcessing) return;

    // Add user message
    this.addUserMessage(message);
    this.messageInput.value = "";

    // Notify background script about user message
    try {
      const response = await chrome.runtime.sendMessage({
        type: "USER_MESSAGE_SENT",
        message: message,
      });

      if (response && !response.success) {
        console.warn("Playwright action failed:", response.error);
      }
    } catch (error) {
      console.error("Failed to communicate with background script:", error);
    }

    // Show processing
    await this.showProcessing();

    // Generate and show bot response after 5 seconds
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

  private async showProcessing(): Promise<void> {
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

    // Wait for 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Remove processing indicator
    this.messages.removeChild(processingElement);

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
