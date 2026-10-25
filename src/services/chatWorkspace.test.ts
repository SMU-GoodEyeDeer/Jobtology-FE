import { describe, expect, it, vi } from "vitest";
import { edgeIdentity, emptyGraph, goalScopedHref, mergeWorkspace, readChatEvents, safeLocalHref, type WorkspaceGraph } from "./chatWorkspace";

const graph: WorkspaceGraph = { nodes: [{ id: "sql", kind: "technology", label: "SQL", basis: "REFERENCE" }], edges: [], truncated: false };
const evidence = { goal_id: "goal", occupation_id: "role", graph, sources: [], warnings: [] };
const answer = { ...evidence, reply: "자료를 확인했어요", explanation: "참고 연결", actions: [], suggestions: [] };
function stream(...chunks: string[]) { return new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk))); controller.close(); } }); }

describe("chat evidence stream", () => {
  it.each(["\n", "\r", "\r\n"])("accepts SSE line endings %j across every byte boundary", async separator => {
    const text = [": heartbeat", "", "event: answer", 'data: {"type":"answer",',
      `data: "data":${JSON.stringify(answer)}}`, "", "event: done", 'data: {"type":"done"}', "", ""].join(separator);
    const bytes = new TextEncoder().encode(text), received: string[] = [];
    const split = new ReadableStream<Uint8Array>({ start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    }});
    await readChatEvents(split, event => received.push(event.type), undefined, "sse");
    expect(received).toEqual(["answer", "done"]);
  });
  it.each(["ndjson", "sse"] as const)("accepts a large %s chunk containing several bounded events", async format => {
    const events = [{ type: "progress", stage: "searching", message: "x".repeat(360_000) },
      { type: "progress", stage: "answering", message: "x".repeat(360_000) }, { type: "answer", data: answer }, { type: "done" }];
    const text = events.map(event => format === "sse" ? `data: ${JSON.stringify(event)}\n\n` : `${JSON.stringify(event)}\n`).join("");
    const received: string[] = [];
    expect(text.length).toBeGreaterThan(700_000);
    await readChatEvents(stream(text), event => received.push(event.type), undefined, format);
    expect(received).toEqual(["progress", "progress", "answer", "done"]);
  });
  it.each(["ndjson", "sse"] as const)("keeps the %s unfinished-line and individual-event bounds", async format => {
    await expect(readChatEvents(stream("x".repeat(700_001)), () => {}, undefined, format)).rejects.toThrow("응답이 너무 커요.");
    const line = JSON.stringify({ type: "progress", stage: "searching", message: "x".repeat(700_001) });
    await expect(readChatEvents(stream(format === "sse" ? `data: ${line}\n\n` : `${line}\n`), () => {}, undefined, format)).rejects.toThrow("응답이 너무 커요.");
  });
  it("decodes SSE frames, heartbeat comments, CRLF and incremental tool/text events", async () => {
    const events = [{type:"tool",call_id:"one",name:"search_postings",label:"채용공고 검색",status:"started"},
      {type:"tool",call_id:"one",name:"search_postings",label:"채용공고 검색",status:"completed",node_count:6},
      {type:"answer_delta",delta:"한글 😀"}, {type:"answer",data:answer},{type:"done"}];
    const text = ': heartbeat\r\n\r\n' + events.map(e => `event: ${e.type}\r\ndata: ${JSON.stringify(e)}\r\n\r\n`).join('');
    const received: string[] = [];
    const bytes = new TextEncoder().encode(text);
    const splitBytes = new ReadableStream<Uint8Array>({ start(controller) {
      for (let i = 0; i < bytes.length; i += 2) controller.enqueue(bytes.slice(i, i + 2));
      controller.close();
    }});
    await readChatEvents(splitBytes,e=>received.push(e.type),undefined,"sse");
    expect(received).toEqual(["tool","tool","answer_delta","answer","done"]);
  });
  it.each([
    {type:"tool",call_id:"one",name:"shell",label:"실행",status:"started"},
    {type:"tool",call_id:"one",name:"search_catalog",label:"검색",status:"unknown"},
    {type:"answer_delta",delta:4},
  ])("rejects malformed tool/text events: %j",async event=>{
    await expect(readChatEvents(stream(`data: ${JSON.stringify(event)}\n\n`),()=>{},undefined,"sse")).rejects.toThrow();
  });
  it("requires a final validated answer after text deltas and rejects unfinished SSE frames",async()=>{
    await expect(readChatEvents(stream('data: {"type":"answer_delta","delta":"partial"}\n\ndata: {"type":"done"}\n\n'),()=>{},undefined,"sse")).rejects.toThrow("답변이 누락");
    await expect(readChatEvents(stream(`data: ${JSON.stringify({type:"answer",data:answer})}`),()=>{},undefined,"sse")).rejects.toThrow("연결이 끊겼어요");
    await expect(readChatEvents(stream(`data: ${JSON.stringify({type:"answer",data:answer})}\n\ndata: {"type":"done"}\n\ndata: {"type":`),()=>{},undefined,"sse")).rejects.toThrow("연결이 끊겼어요");
  });
  it("cancels an outstanding read immediately when aborted", async()=>{
    const controller=new AbortController(), cancelled=vi.fn();
    const pending=new ReadableStream<Uint8Array>({cancel:cancelled});
    const result=readChatEvents(pending,()=>{},controller.signal,"sse");
    controller.abort();
    await expect(result).rejects.toMatchObject({name:"AbortError"}); expect(cancelled).toHaveBeenCalled();
  });
  it("decodes split Unicode JSON and requires a terminal answer and done event", async () => {
    const text = [{ type: "evidence", data: evidence }, { type: "answer", data: answer }, { type: "done" }].map(e => JSON.stringify(e)).join("\n");
    const events: string[] = [];
    await readChatEvents(stream(text.slice(0, 37), text.slice(37, 137), text.slice(137)), e => events.push(e.type));
    expect(events).toEqual(["evidence", "answer", "done"]);
  });
  it("retains received evidence but reports an interrupted stream", async () => {
    const events: string[] = [];
    await expect(readChatEvents(stream(JSON.stringify({ type: "evidence", data: evidence })), e => events.push(e.type))).rejects.toThrow("연결이 끊겼어요");
    expect(events).toEqual(["evidence"]);
  });
  it.each(["error", "done", "unknown"])("rejects incomplete or error terminal events: %s", async type => {
    await expect(readChatEvents(stream(JSON.stringify({ type, code: "CHAT_BUSY" })), () => {})).rejects.toThrow();
  });
  it("rejects malformed and prototype-inherited node kinds", async () => {
    const bad = { ...evidence, graph: { ...graph, nodes: [{ ...graph.nodes[0], kind: "__proto__" }] } };
    await expect(readChatEvents(stream(JSON.stringify({ type: "evidence", data: bad })), () => {})).rejects.toThrow("자료 응답");
  });
  it.each([null, "highlight", [], {},
    { type: "execute", node_ids: [], edge_ids: [], kinds: [] },
    { type: "highlight", node_ids: "sql", edge_ids: [], kinds: [] },
    { type: "highlight", node_ids: [1], edge_ids: [], kinds: [] },
    { type: "highlight", node_ids: [], edge_ids: [null], kinds: [] },
    { type: "filter", node_ids: [], edge_ids: [], kinds: "technology" },
    { type: "filter", node_ids: [], edge_ids: [], kinds: ["unknown"] },
    { type: "filter", node_ids: [], edge_ids: [], kinds: ["__proto__"] },
    { type: "filter", node_ids: [], edge_ids: [], kinds: [null] },
  ])("rejects malformed graph actions: %j", async action => {
    const events: string[] = [];
    await expect(readChatEvents(stream(JSON.stringify({ type: "answer", data: { ...answer, actions: [action] } })), event => events.push(event.type))).rejects.toThrow("답변 응답");
    expect(events).toEqual([]);
  });
  it("accepts every supported graph action with validated identifier and kind arrays", async () => {
    const actions = ["add", "highlight", "focus", "filter", "expand"].map(type => ({ type, node_ids: ["sql"], edge_ids: [], kinds: ["technology"] }));
    const events: string[] = [];
    await readChatEvents(stream(JSON.stringify({ type: "answer", data: { ...answer, actions } }), '\n{"type":"done"}'), e => events.push(e.type));
    expect(events).toEqual(["answer", "done"]);
  });
  it("honors cancellation", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(readChatEvents(stream(""), () => {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("bounded graph state", () => {
  it("keeps existing catalog provenance when posting classifications connect to it while refreshing the posting", () => {
    const occupation = { id: "ncs:occupation:20010202", kind: "ncs_occupation" as const, label: "현재 카탈로그", detail: "카탈로그 설명", basis: "REFERENCE" as const, source_pin: "current-catalog" };
    const posting = { id: "posting:one", kind: "posting" as const, label: "개발자", detail: "모집 중", basis: "REFERENCE" as const };
    const merged = mergeWorkspace({ ...emptyGraph(), nodes: [occupation, posting] }, {
      ...emptyGraph(), nodes: [{ ...occupation, label: "과거 추론 이름", detail: "추론 분류", source_pin: null }, { ...posting, detail: "모집 종료" }],
      edges: [{ id: "classification", source: posting.id, target: occupation.id, kind: "INFERRED_POSTING_OCCUPATION", basis: "METADATA_INFERRED", catalog_pin: "old-catalog", catalog_freshness: "STALE" }],
    });
    expect(merged.nodes.find(node => node.id === occupation.id)).toEqual(occupation);
    expect(merged.nodes.find(node => node.id === posting.id)?.detail).toBe("모집 종료");
    expect(merged.edges[0].catalog_pin).toBe("old-catalog");
  });
  it("preserves stable identities, merges updates and discards dangling relationships", () => {
    const merged = mergeWorkspace(graph, { nodes: [{ ...graph.nodes[0], label: "SQL 최신" }],
      edges: [{ id: edgeIdentity("sql", "LINK", "missing"), source: "sql", target: "missing", kind: "LINK", basis: "REFERENCE" }], truncated: false });
    expect(merged.nodes).toHaveLength(1); expect(merged.nodes[0].label).toBe("SQL 최신"); expect(merged.edges).toHaveLength(0);
  });
  it("caps the cumulative view even across repeated expansions", () => {
    let result = emptyGraph();
    for (let i = 0; i < 200; i++) result = mergeWorkspace(result, { ...emptyGraph(), nodes: [{ ...graph.nodes[0], id: String(i) }] });
    expect(result.nodes).toHaveLength(160); expect(result.truncated).toBe(true);
  });
  it("retains new and refreshed relationships after the edge cap is reached", () => {
    const nodes = [graph.nodes[0], { ...graph.nodes[0], id: "project" }];
    const edge = { id: "old-0", source: "sql", target: "project", kind: "LINK", basis: "REFERENCE" as const };
    const old = { nodes, edges: Array.from({ length: 320 }, (_, i) => ({ ...edge, id: `old-${i}` })), truncated: false };
    const merged = mergeWorkspace(old, { ...emptyGraph(), edges: [{ ...edge, explanation: "refreshed" }, { ...edge, id: "new" }] });
    expect(merged.edges).toHaveLength(320); expect(merged.truncated).toBe(true);
    expect(merged.edges.some(e => e.id === "old-1")).toBe(false);
    expect(merged.edges.slice(-2)).toEqual([{ ...edge, explanation: "refreshed" }, { ...edge, id: "new" }]);
  });
  it("accepts only local navigation targets", () => {
    expect(safeLocalHref("/postings?posting=abc")).toBe("/postings?posting=abc");
    expect(safeLocalHref("//other.example")).toBeNull(); expect(safeLocalHref("javascript:alert(1)")).toBeNull();
    expect(safeLocalHref("/\\other.example")).toBeNull();
    expect(goalScopedHref("/roadmap?step=abc#card", "goal-b")).toBe("/roadmap?step=abc&goal_id=goal-b#card");
    expect(goalScopedHref("/analysis?requirement=unit", "goal-b")).toContain("goal_id=goal-b");
  });
});
