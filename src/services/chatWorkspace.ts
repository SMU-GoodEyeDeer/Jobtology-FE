import { getCsrfToken, request } from "./api";
import type { ChatMessagePayload, EvidenceEdge, EvidenceNode } from "./types";

export const nodeLabels = {
  role: "목표 직무", ncs_occupation: "NCS 직무", ncs_competency: "NCS 능력단위",
  onet_occupation: "O*NET 직업", onet_skill: "O*NET 역량", technology: "기술",
  qualification: "자격", exam_session: "시험 일정", posting: "채용공고", posting_evidence: "공고 연결",
  publication: "자료", profile: "내 프로필", goal: "내 목표", capability: "내 스펙",
  analysis: "역량 분석", activity: "학습 활동", preferences: "계획 선호",
} as const;
export type WorkspaceKind = keyof typeof nodeLabels;
export type EvidenceBasis = "REFERENCE" | "METADATA_INFERRED" | "APPLICATION_CONTEXT_SELECTION"
  | "USER_REPORTED" | "APPLICATION_RECORD" | "REVIEWED_REQUIREMENT" | "PROPOSED";
export const basisLabels: Record<EvidenceBasis, string> = {
  REFERENCE: "참고 자료", METADATA_INFERRED: "공고 기반 추정", APPLICATION_CONTEXT_SELECTION: "직무 탐색 참고",
  USER_REPORTED: "본인 입력", APPLICATION_RECORD: "저장된 계획·평가", REVIEWED_REQUIREMENT: "검토된 요구 역량", PROPOSED: "제안 연결",
};
export interface WorkspaceNode {
  id: string; kind: WorkspaceKind; label: string; detail?: string | null; basis: EvidenceBasis;
  href?: string | null; ncs_base_code?: string | null; requirement_key?: string | null;
  occupation_code?: string | null; qualification_code?: string | null;
  source_id?: string | null; source_pin?: string | null;
  sourceMetadata?: EvidenceNode;
}
export interface WorkspaceEdge {
  id: string; source: string; target: string; kind: string; basis: EvidenceBasis; explanation?: string;
  sourceMetadata?: EvidenceEdge;
  association_id?: string | null; source_freshness?: "CURRENT" | "STALE" | "UNKNOWN" | null;
  catalog_freshness?: "CURRENT" | "STALE" | "UNKNOWN" | null; review_status?: string | null;
  source_run_id?: string | null; catalog_pin?: string | null;
}
export interface WorkspaceGraph { nodes: WorkspaceNode[]; edges: WorkspaceEdge[]; truncated: boolean; warnings?: string[] }
export interface ChatSource {
  id: string; title: string; text: string; node_ids: string[]; edge_ids: string[];
  basis: EvidenceBasis; href?: string | null; source_pin?: string | null;
}
export interface WorkspaceEvidence {
  goal_id: string | null; occupation_id: string | null; graph: WorkspaceGraph; sources: ChatSource[]; warnings: string[];
}
export interface WorkspaceAction {
  type: "add" | "highlight" | "focus" | "filter" | "expand";
  node_ids: string[]; edge_ids: string[]; kinds: WorkspaceKind[];
}
export interface WorkspaceAnswer extends WorkspaceEvidence {
  reply: string; explanation: string; actions: WorkspaceAction[]; suggestions: string[];
}
export interface ToolEvent { type: "tool"; call_id: string; name: string; label: string; status: "started" | "completed" | "failed"; node_count?: number }
export type ChatEvent = { type: "progress"; stage: string; message: string } | ToolEvent | { type: "answer_delta"; delta: string }
  | { type: "evidence"; data: WorkspaceEvidence } | { type: "answer"; data: WorkspaceAnswer }
  | { type: "done" } | { type: "error"; code: string };
export const emptyGraph = (): WorkspaceGraph => ({ nodes: [], edges: [], truncated: false });
export const edgeIdentity = (source: string, kind: string, target: string) => `edge:${source}|${kind}|${target}`;
export function mergeWorkspace(...graphs: WorkspaceGraph[]): WorkspaceGraph {
  const all = new Map<string, WorkspaceNode>();
  for (const graph of graphs) for (const node of graph.nodes) { const previous = all.get(node.id); all.delete(node.id); all.set(node.id, { ...previous, ...node }); }
  const protectedNodes = [...all.values()].filter(n => ["profile", "goal", "role", "preferences"].includes(n.kind)).slice(0, 16);
  const protectedIds = new Set(protectedNodes.map(n => n.id));
  const nodes = [...protectedNodes, ...[...all.values()].filter(n => !protectedIds.has(n.id)).slice(-(160 - protectedNodes.length))], kept = new Set(nodes.map(n => n.id));
  const allEdges = new Map<string, WorkspaceEdge>();
  for (const graph of graphs) for (const edge of graph.edges) { allEdges.delete(edge.id); allEdges.set(edge.id, edge); }
  const edges = [...allEdges.values()]
    .filter(e => kept.has(e.source) && kept.has(e.target));
  return { nodes, edges: edges.slice(-320), truncated: graphs.some(g => g.truncated) || all.size > 160 || edges.length > 320,
    warnings: [...new Set(graphs.flatMap(g => g.warnings ?? []))] };
}
export function safeLocalHref(href?: string | null) { return href?.startsWith("/") && !href.startsWith("//") && !/[\\\u0000-\u0020]/.test(href) ? href : null; }
export function goalScopedHref(href: string, goalId?: string | null) {
  const url = new URL(href, "https://jobtology.local");
  if (goalId && ["/analysis", "/roadmap"].includes(url.pathname)) url.searchParams.set("goal_id", goalId);
  return url.pathname + url.search + url.hash;
}

function isWorkspaceAction(value: unknown): value is WorkspaceAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  return typeof action.type === "string" && ["add", "highlight", "focus", "filter", "expand"].includes(action.type)
    && Array.isArray(action.node_ids) && action.node_ids.every(id => typeof id === "string")
    && Array.isArray(action.edge_ids) && action.edge_ids.every(id => typeof id === "string")
    && Array.isArray(action.kinds) && action.kinds.every(kind => typeof kind === "string" && Object.hasOwn(nodeLabels, kind));
}

export async function readChatEvents(body: ReadableStream<Uint8Array>, onEvent: (event: ChatEvent) => void, signal?: AbortSignal, format: "ndjson" | "sse" = "ndjson") {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = "", doneEvent = false, answer = false, textSize = 0, eventName = "";
  let eventData: string[] = [], eventSize = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", abort, { once: true });
  function consumeEvent(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ChatEvent;
    if (!event || !["evidence", "progress", "tool", "answer_delta", "answer", "done", "error"].includes(event.type)) throw new Error("알 수 없는 응답이에요.");
    if (eventName && eventName !== event.type) throw new Error("응답 종류가 일치하지 않아요.");
    if (doneEvent) throw new Error("완료 후 응답이 도착했어요.");
    if (event.type === "error") throw new Error(event.code === "CHAT_BUSY" ? "요청이 많아요. 잠시 후 다시 시도해 주세요." : "답변을 완료하지 못했어요. 다시 시도해 주세요.");
    if (event.type === "answer_delta") {
      if (answer || typeof event.delta !== "string" || (textSize += event.delta.length) > 6000) throw new Error("답변 조각을 읽지 못했어요.");
    }
    if (event.type === "tool" && (typeof event.call_id !== "string" || !event.call_id || event.call_id.length > 160
      || !["read_personal_records", "search_catalog", "search_postings", "get_posting", "expand_connections", "unknown"].includes(event.name)
      || typeof event.label !== "string" || event.label.length > 100 || !["started", "completed", "failed"].includes(event.status)
      || event.node_count != null && (!Number.isInteger(event.node_count) || event.node_count < 0 || event.node_count > 160))) throw new Error("도구 응답을 읽지 못했어요.");
    if (event.type === "evidence" || event.type === "answer") {
      const graph = event.data?.graph;
      if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length > 160 || !Array.isArray(graph.edges) || graph.edges.length > 320
        || graph.nodes.some(n => !n || typeof n.id !== "string" || typeof n.label !== "string" || !Object.hasOwn(nodeLabels, n.kind) || !Object.hasOwn(basisLabels, n.basis))
        || graph.edges.some(e => !e || typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string" || !Object.hasOwn(basisLabels, e.basis))
        || graph.edges.some(e => [e.source_freshness, e.catalog_freshness].some(value => value != null && !["CURRENT", "STALE", "UNKNOWN"].includes(value)))
        || !Array.isArray(event.data.sources) || !Array.isArray(event.data.warnings)) throw new Error("자료 응답을 읽지 못했어요.");
      if (event.type === "answer" && (typeof event.data.reply !== "string" || typeof event.data.explanation !== "string" || !Array.isArray(event.data.actions) || event.data.actions.some(action => !isWorkspaceAction(action)) || !Array.isArray(event.data.suggestions))) throw new Error("답변 응답을 읽지 못했어요.");
    }
    if (event.type === "answer") answer = true;
    if (event.type === "done") { if (!answer) throw new Error("답변이 누락됐어요."); doneEvent = true; }
    onEvent(event);
  }
  function consume(line: string) {
    if (format === "ndjson") { consumeEvent(line); return; }
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (!line) {
      if (eventData.length) consumeEvent(eventData.join("\n"));
      eventData = []; eventName = ""; eventSize = 0; return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":"), key = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1); if (value.startsWith(" ")) value = value.slice(1);
    if (key === "event") eventName = value;
    if (key === "data") { eventSize += value.length; if (eventSize > 700_000) throw new Error("응답이 너무 커요."); eventData.push(value); }
  }
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 700_000) throw new Error("응답이 너무 커요.");
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
      if (done) { if (format === "ndjson") consume(buffer); break; }
    }
    if (!doneEvent || format === "sse" && (buffer.trim() || eventData.length)) throw new Error("연결이 끊겼어요. 받은 자료는 그래프에서 확인할 수 있어요.");
  } finally { signal?.removeEventListener("abort", abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
export const chatWorkspaceApi = {
  context: (goalId: string | null, signal?: AbortSignal) => request<WorkspaceEvidence>("GET", `/v1/chat/context${goalId ? `?goal_id=${encodeURIComponent(goalId)}` : ""}`, undefined, undefined, signal),
  search: (q: string, offset = 0, signal?: AbortSignal) => request<WorkspaceGraph>("POST", "/v1/chat/catalog", { q, offset }, undefined, signal),
  expand: (nodeId: string, offset = 0, signal?: AbortSignal) => request<WorkspaceGraph>("POST", "/v1/chat/catalog", { node_id: nodeId, offset }, undefined, signal),
  async stream(messages: ChatMessagePayload[], goalId: string | null, focusIds: string[], onEvent: (event: ChatEvent) => void, signal: AbortSignal) {
    const csrf = getCsrfToken();
    const response = await fetch(`${base}/v1/chat/stream`, {
      method: "POST", credentials: "include", signal,
      headers: { "Content-Type": "application/json", "Accept": "text/event-stream", ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
      body: JSON.stringify({ messages, goal_id: goalId, focus_node_ids: focusIds.slice(0, 8) }),
    });
    if (!response.ok) throw Object.assign(new Error(response.status === 429 ? "요청이 많아요. 잠시 후 다시 시도해 주세요." : "AI 연결을 확인해 주세요."), { status: response.status });
    if (!response.body) throw new Error("답변을 읽지 못했어요.");
    await readChatEvents(response.body, onEvent, signal, response.headers.get("Content-Type")?.includes("text/event-stream") ? "sse" : "ndjson");
  },
};
