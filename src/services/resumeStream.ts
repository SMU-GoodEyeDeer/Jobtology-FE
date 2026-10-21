import type { ResumeAnalysisEvent } from "./types";

export async function readResumeEvents(
  body: ReadableStream<Uint8Array>, onEvent: (event: ResumeAnalysisEvent) => void, signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffered = "", finished = false;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ResumeAnalysisEvent;
    if (!["scan", "paragraph", "done", "error"].includes(event.type)) throw new Error("Unknown résumé event");
    if (event.type === "error") throw Object.assign(new Error("Résumé analysis failed"), { detail: { error: event.error } });
    onEvent(event);
    if (event.type === "done") finished = true;
  };
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const { value, done } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      if (buffered.length > 2_000_000) throw new Error("Résumé event is too large");
      let end: number;
      while ((end = buffered.indexOf("\n")) >= 0) { consume(buffered.slice(0, end)); buffered = buffered.slice(end + 1); }
      if (done) { consume(buffered); break; }
    }
    if (!finished) throw Object.assign(new Error("Résumé stream interrupted"), { detail: { error: { code: "AI_STREAM_INTERRUPTED" } } });
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
