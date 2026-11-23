/**
 * Network switches. The extension leaves both on. The web demo turns them off
 * so that no request leaves the page (no Google suggestions, no remote icons).
 */
export const capabilities: { remoteSuggestions: boolean; remoteIcons: boolean } = {
  remoteSuggestions: true,
  remoteIcons: true,
};
