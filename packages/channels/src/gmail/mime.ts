/** Builds an RFC 2822 multipart/alternative message, base64url-encoded for the Gmail API. */
import { randomUUID } from "node:crypto";

/** RFC 2047 encode a header value only when it contains non-ASCII characters. */
function encodeHeader(value: string) {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** Strip CR/LF so user-supplied values can't inject extra headers. */
function clean(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export interface MimeInput {
  from: string; fromName?: string | null;
  to: string; toName?: string | null;
  subject: string; html: string; text: string;
  inReplyTo?: string | null; references?: string | null;
  unsubscribeUrl?: string | null;
  domain: string;
}

export function buildMime(m: MimeInput) {
  const boundary = `etr_${randomUUID()}`;
  const messageId = `<${randomUUID()}@${m.domain}>`;
  const addr = (email: string, name?: string | null) => (name ? `${encodeHeader(clean(name))} <${clean(email)}>` : clean(email));

  const headers = [
    `From: ${addr(m.from, m.fromName)}`,
    `To: ${addr(m.to, m.toName)}`,
    `Subject: ${encodeHeader(clean(m.subject))}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (m.inReplyTo) headers.push(`In-Reply-To: ${clean(m.inReplyTo)}`);
  if (m.references) headers.push(`References: ${clean(m.references)}`);
  if (m.unsubscribeUrl) {
    // RFC 8058 one-click unsubscribe (required by Gmail/Yahoo bulk sender rules).
    headers.push(`List-Unsubscribe: <${clean(m.unsubscribeUrl)}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }

  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "",
      Buffer.from(body, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n")].join("\r\n");

  const raw = [...headers, "", part("text/plain", m.text), part("text/html", m.html), `--${boundary}--`, ""].join("\r\n");
  return { raw: Buffer.from(raw, "utf8").toString("base64url"), messageId };
}

/** Very small HTML -> text fallback for the plain-text part. */
export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();
}
