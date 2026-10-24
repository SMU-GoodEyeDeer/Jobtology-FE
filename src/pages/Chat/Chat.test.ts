// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatWorkspaceApi, readChatEvents, type ChatEvent, type WorkspaceAnswer, type WorkspaceEvidence } from "../../services/chatWorkspace";
import { roleEvidenceGraphApi } from "../../services/api";
import { resetWorkspaceCache } from "../../services/workspaceCache";
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
vi.mock("./WorkspaceGraph", () => ({ WorkspaceGraph: ({ graph, onSelect, highlighted }: { graph: WorkspaceEvidence["graph"]; onSelect: (id: string) => void; highlighted: Set<string> }) =>
  createElement("div", { "data-testid": "graph", "data-highlighted": [...highlighted].join(",") }, graph.nodes.map(n => createElement("button", { key: n.id, onClick: () => onSelect(n.id) }, n.label))) }));
const graph = { nodes: [{ id: "personal", label: "내 경험", kind: "capability" as const, basis: "USER_REPORTED" as const }], edges: [], truncated: false };
const evidence: WorkspaceEvidence = { goal_id: "second", occupation_id: "ROLE_B", graph, sources: [], warnings: [] };
const answer: WorkspaceAnswer = { ...evidence, reply: "저장된 경험을 확인했어요.", explanation: "본인 입력 근거예요.", sources: [{ id: "personal", title: "경험 근거", text: "경험", node_ids: ["personal"], edge_ids: [], basis: "USER_REPORTED" }],
  actions: [{ type: "highlight", node_ids: ["personal"], edge_ids: [], kinds: [] }], suggestions: [] };
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  state.goal = "second"; state.account = "account-a"; state.goalsLoading = false; state.select.mockReset(); localStorage.clear(); resetWorkspaceCache();
  vi.spyOn(chatWorkspaceApi, "context").mockResolvedValue(evidence);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function render() { await act(async () => { root.render(createElement(MemoryRouter, null, createElement(Chat))); await new Promise(r => setTimeout(r, 0)); }); }
async function question() {
  await act(async () => host.querySelector<HTMLButtonElement>(".chat-suggestions button")!.click());
  await act(async () => host.querySelector(".workspace-chat-input")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
}

describe("graph-centered chat workspace", () => {
  it("shows a graph-shaped loading state while initial data is pending", async () => {
    let resolve!: (value: WorkspaceEvidence) => void;
    vi.mocked(chatWorkspaceApi.context).mockReturnValue(new Promise(done => { resolve = done; }));
    await render();
    expect(host.querySelector('.workspace-loading[role="status"]')?.textContent).toContain("연결 지도를 준비하고 있어요");
    expect(host.querySelectorAll(".workspace-loading-map circle").length).toBeGreaterThan(1);
    await act(async () => resolve(evidence));
    expect(host.querySelector(".workspace-loading")).toBeNull();
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
});
