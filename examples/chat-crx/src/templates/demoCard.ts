import { Demonstration } from "../schemas/demonstration";

export const createDemoCard = (demo: Demonstration): string => `
  <div class="demo-card" data-demo-id="${demo.demonstration_id}">
    <div class="url">
      <span class="url-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      </span>
      ${demo.url}
    </div>
    <div class="goal">${demo.goal}</div>
    <div class="demo-card-actions">
      <button class="demo-card-button replay-button" data-action="replay">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z"></path>
          <path d="M12 2v4"></path>
          <path d="M12 18v4"></path>
          <path d="M4.93 4.93l2.83 2.83"></path>
          <path d="M16.24 16.24l2.83 2.83"></path>
          <path d="M2 12h4"></path>
          <path d="M18 12h4"></path>
          <path d="M4.93 19.07l2.83-2.83"></path>
          <path d="M16.24 7.76l2.83-2.83"></path>
        </svg>
        Replay
      </button>
      <button class="demo-card-button edit-button" data-action="edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
        </svg>
        Edit
      </button>
    </div>
  </div>
`; 