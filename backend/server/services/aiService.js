import Anthropic from "@anthropic-ai/sdk";

// reads ANTHROPIC_API_KEY from the environment automatically
const client = new Anthropic();

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const MAX_TOKENS = 1024;

/**
 * Streams a chat completion from the Claude API, invoking onChunk for every
 * text delta as it arrives. Returns the full assembled text once the stream
 * ends. 
 *
 * @param {{role: "user"|"assistant", content: string}[]} messages
 * @param {(chunk: string) => void} onChunk
 * @returns {Promise<string>}
 */
export async function streamChat(messages, onChunk) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages,
  });

  let fullText = "";

  stream.on("text", (chunk) => {
    fullText += chunk;
    onChunk(chunk);
  });

  await stream.finalMessage();

  return fullText;
}
