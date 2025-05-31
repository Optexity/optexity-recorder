import { Locator, Page } from "@playwright/test";

// Styles for highlights
const styles = {
  successBox: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    padding: "20px 40px",
    backgroundColor: "#4CAF50",
    color: "white",
    borderRadius: "8px",
    fontSize: "24px",
    zIndex: 10000,
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  highlightCircle: {
    position: "absolute",
    border: "2px solid #FF4081",
    borderRadius: "50%",
    pointerEvents: "none",
    zIndex: 9999,
  },
  tooltip: {
    position: "absolute",
    backgroundColor: "#333",
    color: "white",
    padding: "8px 12px",
    borderRadius: "4px",
    fontSize: "14px",
    zIndex: 10000,
    maxWidth: "200px",
  },
};

// Remove all existing highlights
export async function removeHighlight(page: Page) {
  await page.evaluate(() => {
    const existingElements = document.querySelectorAll(".highlight-overlay");
    existingElements.forEach((element) => element.remove());
  });
}

// Show success message with confetti
export async function highlightDone(page: Page) {
  await removeHighlight(page);

  await page.evaluate(() => {
    // Create success box
    const successBox = document.createElement("div");
    Object.assign(successBox.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      padding: "20px 40px",
      backgroundColor: "#4CAF50",
      color: "white",
      borderRadius: "8px",
      fontSize: "24px",
      zIndex: 10000,
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    });
    successBox.textContent = "Done";
    successBox.className = "highlight-overlay";
    document.body.appendChild(successBox);

    // Add confetti script if not already present
    if (!window.confetti) {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/canvas-confetti@1.7.0/dist/confetti.browser.min.js";
      document.head.appendChild(script);
      script.onload = () => {
        window.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      };
    } else {
      window.confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    // Remove after 2 seconds
    setTimeout(() => {
      successBox.remove();
    }, 2000);
  });
}

// Highlight an element with a circle and tooltip
export async function highlightElement(
  page: Page,
  element: Locator,
  message: string
) {
  await removeHighlight(page);

  const boundingBox = await element.boundingBox();
  if (!boundingBox) return;

  await page.evaluate(
    ({ boundingBox, message, styles }) => {
      // Create circle highlight
      const circle = document.createElement("div");
      Object.assign(circle.style, styles.highlightCircle);
      circle.style.width = `${boundingBox.width + 20}px`;
      circle.style.height = `${boundingBox.height + 20}px`;
      circle.style.left = `${boundingBox.x - 10}px`;
      circle.style.top = `${boundingBox.y - 10}px`;
      circle.className = "highlight-overlay";
      document.body.appendChild(circle);

      // Create tooltip
      const tooltip = document.createElement("div");
      Object.assign(tooltip.style, styles.tooltip);
      tooltip.textContent = message;
      tooltip.className = "highlight-overlay";

      // Position tooltip above the element
      tooltip.style.left = `${boundingBox.x}px`;
      tooltip.style.top = `${boundingBox.y - 40}px`;
      document.body.appendChild(tooltip);
    },
    { boundingBox, message, styles }
  );
}
