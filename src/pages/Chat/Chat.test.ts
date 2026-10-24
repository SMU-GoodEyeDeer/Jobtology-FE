// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatWorkspaceApi, type ChatEvent, type WorkspaceAnswer, type WorkspaceEvidence } from "../../services/chatWorkspace";
import { Chat } from "./Chat";

const state = vi.hoisted(() => ({ goal: "second", select: vi.fn() }));
vi.mock("../../components/AppSidebar", () => ({ AppSidebar: () => null }));
vi.mock("../../hooks/useGoals", () => ({ useGoals: () => {
  const goals = [{ goal_id: "first", occupation_id: "ROLE_A", status: "ACTIVE" }, { goal_id: "second", occupation_id: "ROLE_B", status: "ACTIVE" }];
  return { goals, selectedGoalId: state.goal, selectedGoal: goals.find(g => g.goal_id === state.goal), selectedGoalName: state.goal,
    setSelectedGoalId: state.select, getGoalName: (g: { goal_id: string }) => g.goal_id, loading: false, error: null };
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
  state.goal = "second"; state.select.mockReset(); localStorage.clear();
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
});
