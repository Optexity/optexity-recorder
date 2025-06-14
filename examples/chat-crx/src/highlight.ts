import { ElementHandle, Locator, Page } from "playwright-crx";

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

// CSS for the hand-drawn animation
const handDrawnStyles = `
  .highlight-circle-path {
    stroke: #FF4081;
    stroke-width: 3;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: drawCircle 1.2s ease-in-out forwards;
    stroke-dasharray: 0;
    stroke-dashoffset: 0;
  }

  @keyframes drawCircle {
    0% {
      stroke-dasharray: 0 1000;
    }
    100% {
      stroke-dasharray: 1000 1000;
    }
  }
`;

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
  element: Locator | ElementHandle,
  message: string
) {
  await removeHighlight(page);

  const boundingBox = await element.boundingBox();
  if (!boundingBox) return;

  await page.evaluate(
    // @ts-ignore
    ({ boundingBox, message, styles, handDrawnStyles }) => {
      // Add styles if not already present
      if (!document.getElementById("hand-drawn-styles")) {
        const styleSheet = document.createElement("style");
        styleSheet.id = "hand-drawn-styles";
        styleSheet.textContent = handDrawnStyles;
        document.head.appendChild(styleSheet);
      }

      // Create SVG container
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      Object.assign(svg.style, styles.highlightCircle);
      svg.style.width = `${boundingBox.width + 40}px`;
      svg.style.height = `${boundingBox.height + 40}px`;
      svg.style.left = `${boundingBox.x - 20}px`;
      svg.style.top = `${boundingBox.y - 20}px`;
      svg.setAttribute("width", `${boundingBox.width + 40}`);
      svg.setAttribute("height", `${boundingBox.height + 40}`);
      svg.setAttribute("class", "highlight-overlay");

      // Create smooth ellipse path
      const width = boundingBox.width + 40;
      const height = boundingBox.height + 40;
      const rx = width / 2;
      const ry = height / 2;
      const cx = rx;
      const cy = ry;

      // Create a smooth path using cubic bezier curves
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const kappa = 0.5522848; // Magic number for smooth circle
      const ox = rx * kappa;   // Control point offset X
      const oy = ry * kappa;   // Control point offset Y

      // Construct smooth path with overlapping ends
      const startX = cx - rx;
      const startY = cy;
      let d = [
        `M ${startX - 5},${startY}`,  // Start 5px before
        `C ${startX - 5},${cy - oy} ${cx - ox},${cy - ry} ${cx},${cy - ry}`,     // Top curve
        `C ${cx + ox},${cy - ry} ${cx + rx},${cy - oy} ${cx + rx},${cy}`,       // Right curve
        `C ${cx + rx},${cy + oy} ${cx + ox},${cy + ry} ${cx},${cy + ry}`,       // Bottom curve
        `C ${cx - ox},${cy + ry} ${startX},${cy + oy} ${startX + 10},${startY}` // Left curve with overlap
      ].join(" ");

      path.setAttribute("d", d);
      path.setAttribute("class", "highlight-circle-path");
      svg.appendChild(path);
      document.body.appendChild(svg);

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
    { boundingBox, message, styles, handDrawnStyles }
  );
}
