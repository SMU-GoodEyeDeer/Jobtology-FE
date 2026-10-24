import { describe, expect, it } from "vitest";
import { edgeIdentity, emptyGraph, goalScopedHref, mergeWorkspace, readChatEvents, safeLocalHref, type WorkspaceGraph } from "./chatWorkspace";

const graph: WorkspaceGraph = { nodes: [{ id: "sql", kind: "technology", label: "SQL", basis: "REFERENCE" }], edges: [], truncated: false };
const evidence = { goal_id: "goal", occupation_id: "role", graph, sources: [], warnings: [] };
const answer = { ...evidence, reply: "자료를 확인했어요", explanation: "참고 연결", actions: [], suggestions: [] };
function stream(...chunks: string[]) { return new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk))); controller.close(); } }); }

describe("chat evidence stream", () => {
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
