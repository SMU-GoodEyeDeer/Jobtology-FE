// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatWorkspaceApi, readChatEvents, type ChatEvent, type WorkspaceAnswer, type WorkspaceEvidence } from "../../services/chatWorkspace";
import { roleEvidenceGraphApi } from "../../services/api";
import { resetWorkspaceCache } from "../../services/workspaceCache";
import { resourcesApi } from "../../services/resourcesApi";
import { clearPostingsCache } from "../../services/postingsCache";
import { Chat } from "./Chat";

const state = vi.hoisted(() => ({ goal: "second", account: "account-a", goalsLoading: false, select: vi.fn() }));
vi.mock("../../components/AppSidebar", () => ({ AppSidebar: () => null }));
vi.mock("../../context/SessionContext", () => ({ useSession: () => ({ session: { user_id: state.account, profile_version: 1 } }) }));
vi.mock("../../hooks/useGoals", () => ({ useGoals: () => {
  const goals = [{ goal_id: "first", occupation_id: "ROLE_A", status: "ACTIVE" }, { goal_id: "second", occupation_id: "ROLE_B", status: "ACTIVE" }];
  return { goals, selectedGoalId: state.goal, selectedGoal: goals.find(g => g.goal_id === state.goal), selectedGoalName: state.goal,
    setSelectedGoalId: state.select, getGoalName: (g: { goal_id: string }) => g.goal_id, loading: state.goalsLoading, error: null };
} }));
vi.mock("../../services/api", () => ({ chatApi: { status: async () => ({ available: true }) },
  roleEvidenceGraphApi: { get: async () => ({ nodes: [], edges: [] }) }, getCsrfToken: () => "csrf", request: vi.fn() }));
vi.mock("./WorkspaceGraph", () => ({ WorkspaceGraph: ({ graph, onSelect, highlighted, kinds, focus }: {
  graph: WorkspaceEvidence["graph"]; onSelect: (id: string) => void; highlighted: Set<string>; kinds: string[]; focus: { ids: string[] };
}) => createElement("div", { "data-testid": "graph", "data-highlighted": [...highlighted].join(","), "data-focus": focus.ids.join(","), "data-edges": graph.edges.map(edge => edge.id).join(",") },
  graph.nodes.filter(n => !kinds.length || kinds.includes(n.kind)).map(n => createElement("button", { key: n.id, onClick: () => onSelect(n.id) }, n.label))) }));
const graph = { nodes: [{ id: "personal", label: "내 경험", kind: "capability" as const, basis: "USER_REPORTED" as const }], edges: [], truncated: false };
const evidence: WorkspaceEvidence = { goal_id: "second", occupation_id: "ROLE_B", graph, sources: [], warnings: [] };
const answer: WorkspaceAnswer = { ...evidence, reply: "저장된 경험을 확인했어요.", explanation: "본인 입력 근거예요.", sources: [{ id: "personal", title: "경험 근거", text: "경험", node_ids: ["personal"], edge_ids: [], basis: "USER_REPORTED" }],
  actions: [{ type: "highlight", node_ids: ["personal"], edge_ids: [], kinds: [] }], suggestions: [] };
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  state.goal = "second"; state.account = "account-a"; state.goalsLoading = false; state.select.mockReset(); localStorage.clear(); resetWorkspaceCache(); clearPostingsCache();
  vi.spyOn(chatWorkspaceApi, "context").mockResolvedValue(evidence);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() { await act(async () => { root.render(createElement(MemoryRouter, null, createElement(Chat))); await new Promise(r => setTimeout(r, 0)); }); }
async function question() {
  await act(async () => host.querySelector<HTMLButtonElement>(".chat-suggestions button")!.click());
  await act(async () => host.querySelector(".workspace-chat-input")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}
async function preparePostingQuestion() {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const posting = { id: "posting:jobkorea:one", kind: "posting" as const, label: "백엔드 채용", basis: "REFERENCE" as const };
  vi.mocked(chatWorkspaceApi.context).mockResolvedValue({ ...evidence, graph: { ...graph, nodes: [...graph.nodes, posting] } });
  await render();
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[data-testid="graph"] button')].find(button => button.textContent === posting.label)!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".workspace-inspector button")].find(button => button.textContent === "이 항목 질문하기")!.click());
  return posting;
}

describe("graph-centered chat workspace", () => {
  it("keeps the posting ID for mobile questions and follow-ups after closing its inspector", async () => {
    const send = vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_messages, _goal, _focus, event) => {
      event({ type: "answer", data: answer }); event({ type: "done" });
    });
    const posting = await preparePostingQuestion();
    expect(host.querySelector(".workspace-question-target")?.textContent).toContain(posting.label);
    await act(async () => host.querySelector(".workspace-chat-input")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(send.mock.calls[0][2]).toEqual([posting.id]);
    await question();
    expect(send.mock.calls[1][2]).toEqual([posting.id]);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="대화 초기화"]')!.click());
    expect(host.querySelector(".workspace-question-target")).toBeNull();
    await question();
    expect(send.mock.calls[2][2]).toEqual([]);
  });
  it("lets the user clear a question target before sending", async () => {
    const send = vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_messages, _goal, _focus, event) => {
      event({ type: "answer", data: answer }); event({ type: "done" });
    });
    await preparePostingQuestion();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="참고 항목 해제"]')!.click());
    await question();
    expect(send.mock.calls[0][2]).toEqual([]);
    expect(host.querySelector(".workspace-question-target")).toBeNull();
  });
  it("drops the previous account's question target when the session changes", async () => {
    const send = vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_messages, _goal, _focus, event) => {
      event({ type: "answer", data: answer }); event({ type: "done" });
    });
    await preparePostingQuestion();
    state.account = "account-b";
    await render();
    expect(host.querySelector(".workspace-question-target")).toBeNull();
    await question();
    expect(send.mock.calls[0][2]).toEqual([]);
  });
  it("shows a graph-shaped loading state while initial data is pending", async () => {
    let resolve!: (value: WorkspaceEvidence) => void;
    vi.mocked(chatWorkspaceApi.context).mockReturnValue(new Promise(done => { resolve = done; }));
    await render();
    expect(host.querySelector('.workspace-loading[role="status"]')?.textContent).toContain("연결 지도를 준비하고 있어요");
    expect(host.querySelectorAll(".workspace-loading-map circle").length).toBeGreaterThan(1);
    await act(async () => resolve(evidence));
    expect(host.querySelector(".workspace-loading")).toBeNull();
  });
  it("draws mappings between initial NCS and O*NET categories without opening an inspector", async () => {
    vi.spyOn(roleEvidenceGraphApi, "get").mockResolvedValue({ occupation_id: "ROLE_B", name: "role", nodes: [
      { id: "ncs:occupation:20010202", kind: "ncs_occupation", label: "NCS 직무", detail: null, weight: null },
      { id: "urn:jobtology:onet:occupation:15-1252.00", kind: "onet_occupation", label: "O*NET 직무", detail: null, weight: null },
    ], edges: [] });
    const source = "ncs:occupation:20010202", target = "urn:jobtology:onet:occupation:15-1252.00";
    vi.spyOn(resourcesApi, "crosswalk").mockResolvedValue({ contract_version: "jobtology-ncs-onet-crosswalk-v1", basis: "CATALOG_CROSSWALK", competency_evidence: false,
      limit: 100, offset: 0, total: 0, items: [], graph: { nodes: [], edges: [
        { id: "visible-crosswalk", source, target, kind: "CROSSWALK_RELATED", basis: "PROPOSED" },
      ], truncated: false } });
    await render();
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-edges")).toContain("visible-crosswalk");
    expect(host.querySelector(".workspace-inspector")).toBeNull();
  });
  it("ignores a previous account's delayed automatic mappings", async () => {
    vi.spyOn(roleEvidenceGraphApi, "get").mockResolvedValue({ occupation_id: "ROLE_B", name: "role", nodes: [
      { id: "onet", kind: "onet_occupation", label: "O*NET 직무", detail: null, weight: null },
    ], edges: [] });
    let resolve!: (value: Awaited<ReturnType<typeof resourcesApi.crosswalk>>) => void;
    vi.spyOn(resourcesApi, "crosswalk").mockReturnValue(new Promise(done => { resolve = done; }));
    await render();
    state.account = "account-b";
    vi.mocked(roleEvidenceGraphApi.get).mockResolvedValue({ occupation_id: "ROLE_B", name: "role", nodes: [], edges: [] });
    await render();
    await act(async () => resolve({ contract_version: "jobtology-ncs-onet-crosswalk-v1", basis: "CATALOG_CROSSWALK", competency_evidence: false,
      limit: 100, offset: 0, total: 0, items: [], graph: { nodes: [], edges: [{ id: "old-mapping", source: "personal", target: "onet", kind: "CROSSWALK_RELATED", basis: "PROPOSED" }], truncated: false } }));
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-edges")).not.toContain("old-mapping");
  });
  it("restores a recently loaded graph immediately on page return, including while goals reload", async () => {
    await render();
    await act(async () => root.unmount()); root = createRoot(host);
    state.goalsLoading = true; await render();
    expect(host.querySelector('[data-testid="graph"]')?.textContent).toContain("내 경험");
    expect(host.querySelector(".workspace-loading")).toBeNull();
    state.goalsLoading = false; await render();
    expect(chatWorkspaceApi.context).toHaveBeenCalledTimes(1);
  });
  it("does not restore another account's cached graph", async () => {
    await render();
    vi.mocked(chatWorkspaceApi.context).mockResolvedValue({ ...evidence, graph: { ...graph, nodes: [] } });
    state.account = "account-b"; await render();
    expect(chatWorkspaceApi.context).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="graph"]')?.textContent).not.toContain("내 경험");
  });
  it("allows a manual refresh to replace a cached initial graph", async () => {
    await render();
    vi.mocked(chatWorkspaceApi.context).mockResolvedValue({ ...evidence, graph: { ...graph, nodes: [] } });
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="연결 지도 새로고침"]')!.click());
    expect(chatWorkspaceApi.context).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="graph"]')?.textContent).not.toContain("내 경험");
  });
  it("sends the selected goal, adds evidence and restores citation focus", async () => {
    const send = vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_messages, _goal, _focus, event) => {
      event({ type: "answer", data: answer }); event({ type: "done" });
    });
    await render(); await question();
    expect(send.mock.calls[0][1]).toBe("second");
    expect(host.textContent).toContain(answer.reply);
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "경험 근거")!.click());
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("personal");
    expect(host.querySelector(".workspace-inspector")?.textContent).toContain("내 경험");
  });
  it("minimizes and reopens chat without losing its draft", async () => {
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>(".chat-suggestions button")!.click());
    const value = host.querySelector<HTMLTextAreaElement>("textarea")!.value;
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="대화창 최소화"]')!.click());
    expect(host.querySelector<HTMLElement>(".workspace-chat-float")!.hidden).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="AI 대화 열기"]')!.click());
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe(value);
  });
  it("keeps a selected inspector visible when resizing to a narrow screen", async () => {
    const listeners = new Set<() => void>();
    const media = { matches: false, addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener) };
    vi.stubGlobal("matchMedia", () => media);
    await render();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[data-testid="graph"] button')][0].click());
    expect(host.querySelector<HTMLElement>(".workspace-chat-float")!.hidden).toBe(false);
    await act(async () => { media.matches = true; listeners.forEach(listener => listener()); });
    expect(host.querySelector<HTMLElement>(".workspace-chat-float")!.hidden).toBe(true);
    expect(host.querySelector(".workspace-inspector")?.textContent).toContain("내 경험");
  });
  it("resets conversation, suggestions, emphasis, filters and focus while keeping the explored graph", async () => {
    const send = vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_m, _g, _f, event) => {
      event({ type: "answer", data: { ...answer,
        graph: { ...graph, nodes: [...graph.nodes, { id: "explored", kind: "technology", label: "탐색한 SQL", basis: "REFERENCE" }] },
        actions: [{ type: "highlight", node_ids: ["explored"], edge_ids: [], kinds: [] },
          { type: "filter", node_ids: [], edge_ids: [], kinds: ["technology"] }],
        suggestions: ["프로젝트를 보완하세요.", "어떤 프로젝트가 좋을까?"] } });
      event({ type: "done" });
    });
    await render(); await question();
    expect(host.querySelector(".chat-suggestions")?.textContent).toBe("어떤 프로젝트가 좋을까?");
    expect(host.querySelector('[data-testid="graph"]')?.textContent).not.toContain("내 경험");
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-focus")).toBe("explored");
    await act(async () => host.querySelector<HTMLButtonElement>(".chat-suggestions button")!.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="대화 초기화"]')!.click());
    expect(host.querySelectorAll(".workspace-message")).toHaveLength(0);
    expect(host.querySelector<HTMLTextAreaElement>("textarea")!.value).toBe("");
    expect(host.querySelector(".chat-suggestions")?.textContent).toContain("내 목표에 뭐가 부족해?");
    expect(host.querySelector('[data-testid="graph"]')?.textContent).toContain("내 경험");
    expect(host.querySelector('[data-testid="graph"]')?.textContent).toContain("탐색한 SQL");
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("");
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-focus")).toBe("");
    await question();
    expect(send.mock.calls[1][0]).toEqual([{ role: "user", text: "내 목표에 뭐가 부족해?" }]);
  });
  it("aborts a reset stream and ignores late events even after a new conversation starts", async () => {
    let emit!: (event: ChatEvent) => void, finish!: () => void;
    const send = vi.spyOn(chatWorkspaceApi, "stream").mockImplementationOnce(async (_m, _g, _f, event) => {
      emit = event; await new Promise<void>(resolve => { finish = resolve; });
    }).mockImplementation(async (_m, _g, _f, event) => {
      event({ type: "answer", data: { ...answer, reply: "새 대화 답변" } }); event({ type: "done" });
    });
    await render(); await question();
    await act(async () => emit({ type: "answer_delta", delta: "초기화 전 답변" }));
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="대화 초기화"]')!.click());
    expect(send.mock.calls[0][4].aborted).toBe(true);
    expect(host.querySelectorAll(".workspace-message")).toHaveLength(0);
    expect(host.querySelector('[aria-label="질문 보내기"]')).not.toBeNull();
    await question();
    await act(async () => { emit({ type: "answer_delta", delta: "늦은 토큰" }); emit({ type: "answer", data: answer }); emit({ type: "done" }); finish(); });
    expect(host.textContent).toContain("새 대화 답변");
    expect(host.textContent).not.toContain("초기화 전 답변");
    expect(host.textContent).not.toContain("늦은 토큰");
    expect(host.textContent).not.toContain(answer.reply);
    expect(host.querySelectorAll(".workspace-message--assistant")).toHaveLength(1);
  });
  it("aborts an old goal's response and ignores late graph/answer events", async () => {
    let callback: (event: ChatEvent) => void = () => {};
    const send = vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_m, _g, _f, event, signal) => {
      callback = event;
      await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError"))));
    });
    await render(); await question();
    state.goal = "first"; await render();
    expect(send.mock.calls[0][4].aborted).toBe(true);
    await act(async () => callback({ type: "answer", data: answer }));
    expect(host.textContent).not.toContain(answer.reply);
    expect(chatWorkspaceApi.context).toHaveBeenLastCalledWith("first", expect.any(AbortSignal));
  });
  it("keeps the personal context error when both initial reads fail", async () => {
    vi.mocked(chatWorkspaceApi.context).mockRejectedValue(new Error("personal offline"));
    vi.spyOn(roleEvidenceGraphApi, "get").mockRejectedValue(new Error("catalog offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("내 정보를 불러오지 못했어요.");
    expect(host.querySelector('[role="alert"]')?.textContent).not.toContain("참고 그래프 일부");
  });
  it("keeps the catalog error when personal context succeeds", async () => {
    vi.spyOn(roleEvidenceGraphApi, "get").mockRejectedValue(new Error("catalog offline"));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("참고 그래프 일부를 불러오지 못했어요.");
  });
  it("renders tool activity and partial text before replacing it with one final cited answer", async()=>{
    let emit!: (event:ChatEvent)=>void, finish!: ()=>void;
    vi.spyOn(chatWorkspaceApi,"stream").mockImplementation(async(_m,_g,_f,event)=>{
      emit=event; await new Promise<void>(resolve=>{finish=resolve;});
    });
    await render();await question();
    await act(async()=>{
      emit({type:"tool",call_id:"one",name:"search_postings",label:"채용공고 검색",status:"started"});
      emit({type:"answer_delta",delta:"작성 중인 답변"});
    });
    expect(host.textContent).toContain("작성 중인 답변");expect(host.textContent).toContain("채용공고 검색");
    expect(host.querySelector('.workspace-chat-progress[role="status"]')?.textContent).toContain("답변 작성 중");
    expect(host.querySelector(".workspace-citations")).toBeNull();
    await act(async()=>emit({type:"progress",stage:"finalizing",message:"그래프 연결을 정리하고 있어요."}));
    expect(host.querySelector('.workspace-chat-progress[role="status"]')?.textContent).toContain("그래프 연결");
    expect(host.querySelector(".workspace-graph-progress")?.textContent).toContain("그래프 연결 정리 중");
    await act(async()=>emit({type:"answer",data:answer}));
    expect(host.textContent).toContain("작성 중인 답변");
    expect(host.textContent).not.toContain(answer.reply);
    expect(host.querySelector(".workspace-citations")).toBeNull();
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("");
    await act(async()=>{emit({type:"done"});finish();});
    expect(host.textContent).not.toContain("작성 중인 답변");
    expect(host.querySelectorAll(".workspace-message--assistant")).toHaveLength(1);
    expect(host.textContent).toContain(answer.reply);
    expect(host.querySelector(".workspace-chat-progress")).toBeNull();
    expect(host.querySelector(".workspace-graph-progress")).toBeNull();
    expect(host.querySelector('[aria-label="답변 중지"]')).toBeNull();
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("personal");
  });
  it.each(["missing done", "invalid frame", "invalid trailing frame"])("keeps an uncommitted answer incomplete after %s", async failure => {
    const pending = { ...answer, graph: { ...graph, nodes: [...graph.nodes,
      { id: "uncommitted", label: "확정 전 그래프", kind: "technology" as const, basis: "REFERENCE" as const }] }, suggestions: ["확정 전 제안"] };
    vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_m, _g, _f, event, signal) => {
      const events = [{ type: "answer_delta", delta: "중간 답변" }, { type: "answer", data: pending }];
      const text = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join("")
        + (failure === "invalid trailing frame" ? 'data: {"type":"done"}\n\n' : "")
        + (failure !== "missing done" ? "data: invalid JSON\n\n" : "");
      await readChatEvents(new ReadableStream<Uint8Array>({ start(controller) {
        controller.enqueue(new TextEncoder().encode(text)); controller.close();
      }}), event, signal, "sse");
    });
    await render(); await question();
    expect(host.textContent).toContain("중간 답변");
    expect(host.textContent).toContain("답변이 완료되지 않았어요.");
    expect(host.textContent).not.toContain(answer.reply);
    expect(host.textContent).not.toContain("확정 전 그래프");
    expect(host.textContent).not.toContain("확정 전 제안");
    expect(host.querySelector(".workspace-citations")).toBeNull();
    expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("");
  });
  it("labels stopped partial answers as incomplete and ignores late tokens",async()=>{
    let emit!: (event:ChatEvent)=>void;
    vi.spyOn(chatWorkspaceApi,"stream").mockImplementation(async(_m,_g,_f,event,signal)=>{
      emit=event;await new Promise<void>((_,reject)=>signal.addEventListener("abort",()=>reject(new DOMException("cancelled","AbortError"))));
    });
    await render();await question();
    await act(async()=>{emit({type:"answer_delta",delta:"중간 답변"});emit({type:"answer",data:answer});});
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="답변 중지"]')!.click());
    await act(async()=>{emit({type:"answer_delta",delta:"늦은 토큰"});emit({type:"done"});});
    expect(host.textContent).toContain("중간 답변");expect(host.textContent).toContain("답변이 완료되지 않았어요.");
    expect(host.textContent).not.toContain("늦은 토큰");expect(host.textContent).not.toContain(answer.reply);
    expect(host.querySelector(".workspace-citations")).toBeNull();
  });
  it("seeds actual posting nodes by expanding an initial posting context group",async()=>{
    vi.spyOn(roleEvidenceGraphApi,"get").mockResolvedValue({occupation_id:"ROLE_B",name:"role",nodes:[{id:"postings:onet:15-1252.00",kind:"posting_evidence",label:"추론 공고",occupation_code:"15-1252.00",detail:null,weight:6}],edges:[]});
    const expand=vi.spyOn(chatWorkspaceApi,"expand").mockResolvedValue({...graph,nodes:[{id:"posting:one",kind:"posting",label:"백엔드 채용",basis:"REFERENCE"}]});
    await render();
    expect(expand).toHaveBeenCalledWith("postings:onet:15-1252.00",0,expect.any(AbortSignal));
    expect(host.querySelector('[data-testid="graph"]')?.textContent).toContain("백엔드 채용");
  });
  it("expands an individual posting into its NCS and O*NET classifications on the canvas", async () => {
    const posting = { id: "posting:one", kind: "posting" as const, label: "백엔드 채용", basis: "REFERENCE" as const };
    vi.mocked(chatWorkspaceApi.context).mockResolvedValue({ ...evidence, graph: { ...graph, nodes: [...graph.nodes, posting] } });
    const expand = vi.spyOn(chatWorkspaceApi, "expand").mockResolvedValue({ ...graph, nodes: [posting,
      { id: "ncs:occupation:20010202", kind: "ncs_occupation", label: "응용SW엔지니어링", basis: "REFERENCE" },
      { id: "urn:jobtology:onet:occupation:15-1252.00", kind: "onet_occupation", label: "Software Developers", basis: "REFERENCE" },
    ], edges: [
      { id: "ncs-classification", source: posting.id, target: "ncs:occupation:20010202", kind: "INFERRED_POSTING_OCCUPATION", basis: "METADATA_INFERRED" },
      { id: "onet-classification", source: posting.id, target: "urn:jobtology:onet:occupation:15-1252.00", kind: "INFERRED_POSTING_OCCUPATION", basis: "METADATA_INFERRED" },
    ] });
    await render();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[data-testid="graph"] button')].find(button => button.textContent === posting.label)!.click());
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".workspace-inspector button")].find(button => button.textContent === "연결 더 보기")!.click());
    expect(expand).toHaveBeenCalledWith(posting.id, 0, expect.any(AbortSignal));
    const canvas = host.querySelector('[data-testid="graph"]');
    expect(canvas?.getAttribute("data-edges")).toContain("ncs-classification");
    expect(canvas?.getAttribute("data-edges")).toContain("onet-classification");
    expect(canvas?.textContent).toContain("Software Developers");
    expect(host.querySelector(".workspace-inspector")?.textContent).toContain("추론 직무 분류");
  });
  it("explains when a posting has no specific occupation classifications", async () => {
    const posting = { id: "posting:unclassified", kind: "posting" as const, label: "미분류 공고", basis: "REFERENCE" as const };
    vi.mocked(chatWorkspaceApi.context).mockResolvedValue({ ...evidence, graph: { ...graph, nodes: [posting] } });
    vi.spyOn(chatWorkspaceApi, "expand").mockResolvedValue({ ...graph, nodes: [posting], warnings: ["POSTING_CLASSIFICATIONS_MISSING"] });
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="graph"] button')!.click());
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>(".workspace-inspector button")].find(button => button.textContent === "연결 더 보기")!.click());
    expect(host.textContent).toContain("이 공고에는 연결할 수 있는 NCS·O*NET 세부 직무 분류가 없어요.");
  });
});
it("clears expanded or answer evidence emphasis when its window is dismissed", async () => {
  vi.spyOn(chatWorkspaceApi, "stream").mockImplementation(async (_messages, _goal, _focus, event) => { event({ type: "answer", data: answer }); event({ type: "done" }); });
  await render(); await question();
  expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("personal");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="대화창 최소화"]')!.click());
  expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="AI 대화 열기"]')!.click());
  await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "경험 근거")!.click());
  expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("personal");
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="상세정보 닫기"]')!.click());
  expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("");
});

it("does not restore automatic highlights after chat is dismissed during an answer", async () => {
  let finish!:()=>void, emit!:(event:ChatEvent)=>void;
  vi.spyOn(chatWorkspaceApi,"stream").mockImplementation((_messages,_goal,_focus,event)=>{emit=event;return new Promise<void>(resolve=>{finish=resolve;});});
  await render();await question();
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="대화창 최소화"]')!.click());
  await act(async()=>{emit({type:"answer",data:answer});emit({type:"done"});finish();});
  expect(host.querySelector('[data-testid="graph"]')?.getAttribute("data-highlighted")).toBe("");
});
