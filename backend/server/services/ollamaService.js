import ollama from "ollama";

const MODEL = process.env.OLLAMA_MODEL || "llama3.1";

/**
 * Streams a chat completion from Ollama, invoking onChunk for every token/chunk
 * as it arrives. Returns the full assembled text once the stream ends.
 *
 * @param {{role: "user"|"assistant", content: string}[]} messages
 * @param {(chunk: string) => void} onChunk
 * @returns {Promise<string>}
 */
export async function streamChat(messages, onChunk) {
  const stream = await ollama.chat({
    model: MODEL,
    messages,
    stream: true,
  });

  let fullText = "";

  for await (const part of stream) {
    const chunk = part.message?.content ?? "";
    if (chunk) {
      fullText += chunk;
      onChunk(chunk);
    }
  }

  return fullText;
}
