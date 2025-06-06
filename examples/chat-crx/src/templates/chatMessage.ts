export const createUserMessage = (message: string): string => `
  <div class="message user">${message}</div>
`;

export const createBotMessage = (message: string): string => `
  <div class="message bot">${message}</div>
`;

export const processingTemplate = `
  <div class="processing">
    <div>Processing your message...</div>
    <div class="loading-bar">
      <div class="loading-progress"></div>
    </div>
  </div>
`; 