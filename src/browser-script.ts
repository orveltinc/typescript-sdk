import { orveltEmbed } from './browser.js';

declare global {
  var OrveltEmbed: typeof orveltEmbed | undefined;
}

// Loading the script twice must not replace an existing integration.
globalThis.OrveltEmbed ??= orveltEmbed;
