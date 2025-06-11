import { RecordedDemoTab } from "./sidepanel/recordedDemoTab";
import { ChatApp } from "./sidepanel/chatTab";

// Initialize the chat app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
  new RecordedDemoTab();
});
