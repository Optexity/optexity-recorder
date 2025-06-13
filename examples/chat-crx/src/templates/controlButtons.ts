export const createControlButtons = (): string => `
  <div class="input-wrapper" style="display: flex; gap: 8px;">
    <button id="pauseButton" class="control-button pause-button" style="background: #4a5568; color: white; border: none; padding: 8px 16px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s;">
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