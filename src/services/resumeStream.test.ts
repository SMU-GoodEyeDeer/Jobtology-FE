import { expect, it } from "vitest";
import { readResumeEvents } from "./resumeStream";
import type { ResumeAnalysisEvent } from "./types";

const done = { type: "done", completed: 1, total: 2, failed: 1, rejected_count: 0, omitted_count: 0, timed_out: false };
function chunks(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
}
it("preserves Korean and emoji split across chunks and final lines without newline", async () => {
  const events: ResumeAnalysisEvent[] = [];
  const paragraph = { type: "paragraph", block_id: "한국어😀", completed: 1, total: 2, suggestions: [], rejected_count: 0, error_code: null };
  await readResumeEvents(chunks(`${JSON.stringify(paragraph)}\n${JSON.stringify(done)}`), event => events.push(event));
  expect(events).toEqual([paragraph, done]);
});
it("distinguishes interrupted streams and server error events", async () => {
  await expect(readResumeEvents(chunks(""), () => {})).rejects.toMatchObject({ detail: { error: { code: "AI_STREAM_INTERRUPTED" } } });
  await expect(readResumeEvents(chunks(JSON.stringify({ type: "error", error: { code: "SCANNER_BUSY", request_id: "reference" } })), () => {})).rejects.toMatchObject({ detail: { error: { code: "SCANNER_BUSY", request_id: "reference" } } });
});
