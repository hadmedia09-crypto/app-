import { gmailAdapter } from "./gmail/adapter";
import type { Channel, ChannelAdapter } from "./types";

export * from "./types";
export { gmailAdapter } from "./gmail/adapter";
export { buildGmailAuthUrl, exchangeCode, GMAIL_SCOPES, type GoogleTokens } from "./gmail/oauth";
export { htmlToText } from "./gmail/mime";

/** Registry: add whatsapp/linkedin/outlook adapters here in later phases. */
const adapters: Partial<Record<Channel, ChannelAdapter>> = { gmail: gmailAdapter };

export function getAdapter(channel: Channel): ChannelAdapter {
  const a = adapters[channel];
  if (!a) throw new Error(`Channel "${channel}" is not available yet`);
  return a;
}
