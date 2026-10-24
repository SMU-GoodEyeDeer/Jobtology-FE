import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppSidebar } from "../../components/AppSidebar";
import { useGoals } from "../../hooks/useGoals";
import { usePanelResize } from "../../hooks/usePanelResize";
import { chatApi, roleEvidenceGraphApi } from "../../services/api";
import type { ChatMessagePayload, RoleEvidenceGraph } from "../../services/types";
import { basisLabels, chatWorkspaceApi, edgeIdentity, emptyGraph, mergeWorkspace, nodeLabels,
  type ToolEvent, type WorkspaceAnswer, type WorkspaceGraph as Graph, type WorkspaceKind } from "../../services/chatWorkspace";
import { ReplyText } from "./ReplyText";
import { WorkspaceInspector } from "./WorkspaceInspector";
import "./Chat.css";

const WorkspaceGraph = lazy(() => import("./WorkspaceGraph").then(module => ({ default: module.WorkspaceGraph })));

interface Turn { role: "user" | "assistant"; text: string; answer?: WorkspaceAnswer; streaming?: boolean; incomplete?: boolean; tools?: ToolEvent[] }
function roleGraph(value: RoleEvidenceGraph): Graph {
  return { nodes: value.nodes.map(n => ({ ...n, occupation_code: n.occupation_code ?? n.ncs_category, sourceMetadata: n, basis: n.basis ?? "REFERENCE" })),
    edges: value.edges.map(e => ({ ...e, sourceMetadata: e, id: edgeIdentity(e.source, e.kind, e.target), basis: e.basis ?? "REFERENCE" })), truncated: true, warnings: [...(value.warnings ?? [])] };
}
const warningLabels: Record<string, string> = {
  SKILL_CATALOG_UNAVAILABLE: "역량 카탈로그를 확인하지 못해 현재 스펙 반영치를 계산할 수 없어요.",
  POSTING_CONTEXT_UNAVAILABLE: "공고 연결 집계를 확인하지 못했어요.",
  FOCUSED_SOURCE_UNAVAILABLE: "선택한 항목의 최신 자료를 확인하지 못했어요.",
  NO_ANALYSIS: "아직 분석 결과가 없어요.", NO_ROADMAP: "저장된 로드맵이 없어요.",
  ANALYSIS_PROFILE_OUTDATED: "분석 이후 프로필이 바뀌었어요. 새 분석에서 반영돼요.",
  SEARCH_PLANNER_UNAVAILABLE: "추가 자료 검색을 완료하지 못했어요.",
  CATALOG_PARTIALLY_UNAVAILABLE: "일부 자료를 불러오지 못했어요.", CATALOG_UNAVAILABLE: "카탈로그 연결을 확인해 주세요.",
  TOOL_BUDGET_REACHED: "이번 답변의 탐색 범위에 도달했어요. 더 필요한 항목을 선택해 이어서 질문할 수 있어요.",
  PERSONAL_CONTEXT_UNAVAILABLE: "내 정보 일부를 확인하지 못했어요. 잠시 후 다시 질문해 주세요.",
};
export function Chat() {
  const { goals, selectedGoalId, selectedGoal, selectedGoalName, setSelectedGoalId, getGoalName, loading: goalsLoading, error: goalsError } = useGoals();
  const [graph, setGraph] = useState<Graph>(emptyGraph), initialGraph = useRef<Graph>(emptyGraph());
  const [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]), [available, setAvailable] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]), [input, setInput] = useState("");
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState("");
  const [chatOpen, setChatOpen] = useState(() => !window.matchMedia("(max-width:640px)").matches), [selected, setSelected] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set()), [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState({ ids: [] as string[], revision: 0 }), [reset, setReset] = useState(0);
  const [kinds, setKinds] = useState<WorkspaceKind[]>([]), [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState(""), [searching, setSearching] = useState(false);
  const [page, setPage] = useState<{ q?: string; node?: string; offset: number } | null>(null), [more, setMore] = useState(false);
  const [suggestions, setSuggestions] = useState(["내 목표에 뭐가 부족해?", "내 스펙은 어떻게 반영됐어?", "다음 학습 활동을 설명해줘"]);
  const epoch = useRef(0), turnController = useRef<AbortController | null>(null), searchController = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null), launcher = useRef<HTMLButtonElement>(null), end = useRef<HTMLDivElement>(null);
  const followAnswer = useRef(true);
  const resize = usePanelResize({ storageKey: "jobtology.chat.floatingWidth", initial: 400, min: 320, max: 560, direction: -1 });

  useEffect(() => { chatApi.status().then(r => setAvailable(r.available)).catch(() => setAvailable(false)); }, []);
  useEffect(() => {
    if (goalsLoading) return;
    const current = ++epoch.current, controller = new AbortController();
    initialGraph.current = emptyGraph();
    turnController.current?.abort(); searchController.current?.abort();
    setGraph(emptyGraph()); setTurns([]); setSelected(null); setHighlighted(new Set()); setHighlightedEdges(new Set());
    setInput(""); setBusy(false); setSearching(false); setError(null); setLoading(true); setWarnings([]); setPage(null); setMore(false); setKinds([]);
    setFocus(previous => ({ ids: [], revision: previous.revision + 1 }));
    Promise.allSettled([chatWorkspaceApi.context(selectedGoalId, controller.signal),
      selectedGoal?.occupation_id ? roleEvidenceGraphApi.get(selectedGoal.occupation_id, controller.signal) : Promise.resolve(null),
    ]).then(async ([personal, catalog]) => {
      if (current !== epoch.current || controller.signal.aborted) return;
      const merged = mergeWorkspace(personal.status === "fulfilled" ? personal.value.graph : emptyGraph(),
        catalog.status === "fulfilled" && catalog.value ? roleGraph(catalog.value) : emptyGraph());
      initialGraph.current = merged; setGraph(merged); setLoading(false);
      if (personal.status === "fulfilled") setWarnings([...personal.value.warnings, ...(merged.warnings ?? [])]);
      else setError("내 정보를 불러오지 못했어요. 다시 시도해 주세요.");
      if (personal.status === "fulfilled" && catalog.status === "rejected") setError("참고 그래프 일부를 불러오지 못했어요. 검색으로 다시 탐색할 수 있어요.");
      const group = merged.nodes.find(n => n.id.startsWith("postings:onet:")) ?? merged.nodes.find(n => n.kind === "posting_evidence" && n.id.startsWith("postings:"));
      if (group) {
        try {
          const postings = await chatWorkspaceApi.expand(group.id, 0, controller.signal);
          if (current !== epoch.current || controller.signal.aborted) return;
          initialGraph.current = mergeWorkspace(initialGraph.current, postings);
          setGraph(previous => mergeWorkspace(previous, postings));
          setWarnings(previous => [...new Set([...previous, ...(postings.warnings ?? [])])]);
        } catch {
          if (current === epoch.current && !controller.signal.aborted) setWarnings(previous => [...new Set([...previous, "POSTING_CONTEXT_UNAVAILABLE"])]);
        }
      }
    });
    return () => { epoch.current += 1; controller.abort(); turnController.current?.abort(); searchController.current?.abort(); };
  }, [selectedGoalId, selectedGoal?.occupation_id, goalsLoading]);
  useEffect(() => { if (followAnswer.current) end.current?.scrollIntoView?.({ behavior: "instant", block: "nearest" }); }, [turns, progress]);
  function interruptAnswer() {
    setTurns(previous => previous.map(turn => turn.streaming ? { ...turn, streaming: false, incomplete: true,
      tools: turn.tools?.map(tool => tool.status === "started" ? { ...tool, status: "failed" } : tool) } : turn));
  }
  function stopAnswer() {
    turnController.current?.abort(); setBusy(false); setProgress(""); interruptAnswer();
  }
  function selectNode(id: string | null) {
    setSelected(id);
    if (id && window.matchMedia("(max-width: 1000px)").matches) setChatOpen(false);
  }
  function showEvidence(answer: WorkspaceAnswer, sourceId?: string) {
    setGraph(previous => mergeWorkspace(previous, answer.graph));
    const source = sourceId ? answer.sources.find(s => s.id === sourceId) : null;
    const action = answer.actions.find(a => a.type === "highlight"), ids = source?.node_ids ?? action?.node_ids ?? [];
    setHighlighted(new Set(ids)); setHighlightedEdges(new Set(source?.edge_ids ?? action?.edge_ids ?? []));
    setKinds(source ? [] : answer.actions.find(a => a.type === "filter")?.kinds ?? []);
    setFocus(previous => ({ ids, revision: previous.revision + 1 }));
    if (sourceId) selectNode(ids[0] ?? null);
  }
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (!input.trim() || busy || !available || loading) return;
    const current = epoch.current, controller = new AbortController();
    turnController.current?.abort(); turnController.current = controller;
    const next = [...turns, { role: "user" as const, text: input.trim().slice(0, 2000) }];
    const history: ChatMessagePayload[] = next.filter(t => !t.incomplete && !t.streaming).slice(-20).map(t => ({ role: t.role, text: t.text.slice(0, 2000) }));
    followAnswer.current = true;
    setTurns([...next, { role: "assistant", text: "", streaming: true }].slice(-40) as Turn[]); setInput(""); setBusy(true); setError(null); setProgress("내 정보와 연결 근거를 확인하고 있어요.");
    let pendingAnswer: WorkspaceAnswer | null = null, completed = false;
    try {
      await chatWorkspaceApi.stream(history, selectedGoalId, selected ? [selected] : [], event => {
        if (epoch.current !== current || controller.signal.aborted) return;
        if (event.type === "progress") setProgress(event.message);
        if (event.type === "tool") setTurns(previous => previous.map((turn, index) => index === previous.length - 1 && turn.streaming
          ? { ...turn, tools: turn.tools?.some(tool => tool.call_id === event.call_id)
            ? turn.tools.map(tool => tool.call_id === event.call_id ? event : tool) : [...(turn.tools ?? []), event] } : turn));
        if (event.type === "answer_delta") {
          setProgress("");
          setTurns(previous => previous.map((turn, index) => index === previous.length - 1 && turn.streaming ? { ...turn, text: turn.text + event.delta } : turn));
        }
        if (event.type === "evidence") { setGraph(previous => mergeWorkspace(previous, event.data.graph)); setWarnings(event.data.warnings); }
        if (event.type === "answer") pendingAnswer = event.data;
        if (event.type === "done") completed = true;
      }, controller.signal);
      if (epoch.current !== current || controller.signal.aborted) return;
      if (!completed || !pendingAnswer) throw new Error("답변이 완료되지 않았어요.");
      const answer = pendingAnswer as WorkspaceAnswer;
      setTurns(previous => [...(previous.at(-1)?.streaming ? previous.slice(0, -1) : previous),
        { role: "assistant" as const, text: answer.reply, answer, tools: previous.at(-1)?.tools }].slice(-40));
      showEvidence(answer); setWarnings(answer.warnings);
      if (answer.suggestions.length) setSuggestions(answer.suggestions);
    } catch (cause) { if (epoch.current === current && !controller.signal.aborted) { setError((cause as Error).message); interruptAnswer(); } }
    finally { if (epoch.current === current && !controller.signal.aborted) { setBusy(false); setProgress(""); } }
  }
  async function search(q?: string, node?: string, offset = 0) {
    if ((!node && !q?.trim()) || searching || loading) return;
    const controller = new AbortController(), current = epoch.current;
    searchController.current?.abort(); searchController.current = controller; setSearching(true); setError(null);
    try {
      const found = node ? await chatWorkspaceApi.expand(node, offset, controller.signal) : await chatWorkspaceApi.search(q!.trim(), offset, controller.signal);
      if (current !== epoch.current || controller.signal.aborted) return;
      setGraph(previous => mergeWorkspace(previous, found)); setKinds([]);
      setWarnings(previous => [...new Set([...previous, ...(found.warnings ?? [])])]);
      setHighlighted(new Set(found.nodes.map(n => n.id))); setHighlightedEdges(new Set(found.edges.map(e => e.id)));
      setFocus(previous => ({ ids: found.nodes.map(n => n.id), revision: previous.revision + 1 }));
      setMore(found.truncated); setPage({ q, node, offset });
      if (!found.nodes.length) setError("연결된 자료를 찾지 못했어요. 다른 이름으로 검색해 보세요.");
    } catch (cause) { if (current === epoch.current && !controller.signal.aborted) setError((cause as Error).message); }
    finally { if (current === epoch.current && !controller.signal.aborted) setSearching(false); }
  }
  function resetGraph() {
    stopAnswer();
    searchController.current?.abort(); setSearching(false); setGraph(initialGraph.current); setKinds([]); setSelected(null);
    setHighlighted(new Set()); setHighlightedEdges(new Set()); setPage(null); setMore(false);
    setFocus(previous => ({ ids: [], revision: previous.revision + 1 })); setReset(previous => previous + 1);
  }
  const selectedNode = graph.nodes.find(n => n.id === selected);
  return <div className="chat-layout chat-workspace"><AppSidebar /><main className="chat-main">
    <header className="workspace-header"><div><p>커리어 탐색</p><h1>{selectedGoal ? selectedGoalName : "나의 연결 지도"}</h1></div>
      <label className="workspace-goal"><span className="sr-only">목표 선택</span><select value={selectedGoalId ?? ""} onChange={e => setSelectedGoalId(e.target.value || null)} disabled={goalsLoading}>
        <option value="">전체 프로필</option>{goals.map(g => <option key={g.goal_id} value={g.goal_id}>{getGoalName(g)}</option>)}
      </select></label></header>
    <section className="chat-body workspace-stage" aria-label="커리어 그래프 탐색" style={{ "--floating-width": `min(${resize.size}px, max(320px, calc(100% - 320px)))` } as CSSProperties}>
      <div className="workspace-toolbar"><form onSubmit={e => { e.preventDefault(); void search(query); }}>
        <label className="sr-only" htmlFor="catalog-search">전체 카탈로그 검색</label>
        <input id="catalog-search" placeholder="역량·직무·자격·공고 검색" value={query} maxLength={120} onChange={e => setQuery(e.target.value)} />
        <button disabled={loading || searching || query.trim().length < 2}>{searching ? "검색 중…" : "검색"}</button></form>
        <button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)}>유형 {kinds.length ? `· ${kinds.length}` : ""}</button>
        <button onClick={resetGraph}>초기화</button>
        {more && page && <button disabled={searching} onClick={() => void search(page.q, page.node, page.offset + 24)}>더 불러오기</button>}
      </div>
      {filtersOpen && <div className="workspace-filters" role="group" aria-label="표시할 노드 유형">
        {(Object.entries(nodeLabels) as [WorkspaceKind, string][]).map(([kind, label]) => <label key={kind}><input type="checkbox" checked={kinds.includes(kind)} onChange={() => setKinds(previous => previous.includes(kind) ? previous.filter(k => k !== kind) : [...previous, kind])} />{label}</label>)}
        <button onClick={() => setKinds([])}>전체 유형</button></div>}
      {loading ? <p className="workspace-loading" role="status">연결 지도를 불러오는 중…</p> : <Suspense fallback={<p className="workspace-loading">그래프를 준비하는 중…</p>}><WorkspaceGraph key={selectedGoalId ?? "account"} graph={graph} selected={selected} onSelect={selectNode}
        highlighted={highlighted} highlightedEdges={highlightedEdges} kinds={kinds} focus={focus} reset={reset} /></Suspense>}
      {selectedNode && <WorkspaceInspector node={selectedNode} graph={graph} goalId={selectedGoalId} onClose={() => { setSelected(null); requestAnimationFrame(() => document.querySelector<HTMLElement>(".workspace-node-list summary")?.focus()); }} busy={searching}
        onExpand={() => void search(undefined, selectedNode.id)} onAsk={() => { setChatOpen(true); setInput(`${selectedNode.label}에 대해 설명해줘`); requestAnimationFrame(() => inputRef.current?.focus()); }} />}
      <button ref={launcher} className="workspace-chat-launcher" aria-label="AI 대화 열기" aria-expanded={chatOpen} onClick={() => { setSelected(null); setChatOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }} hidden={chatOpen}>대화하기 <span>↗</span></button>
      <section className={`workspace-chat-float${resize.resizing ? " is-resizing" : ""}`} hidden={!chatOpen} aria-label="AI 커리어 대화">
        <div className="workspace-chat-resize" {...resize.separatorProps} aria-label="대화창 너비 조절" />
        <header><div><span className="workspace-ai-dot" />커리어 도우미</div><button onClick={() => { setChatOpen(false); requestAnimationFrame(() => launcher.current?.focus()); }} aria-label="대화창 최소화">−</button></header>
        <div className="workspace-messages" role="log" aria-label="대화 내용" onScroll={event => { const element = event.currentTarget; followAnswer.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48; }}>
          {!turns.length && <div className="workspace-chat-intro"><h2>어떤 연결이 궁금한가요?</h2><p>내 경험부터 다음 학습까지,<br />근거를 따라 함께 살펴봐요.</p></div>}
          {turns.map((turn, index) => <article key={index} aria-busy={turn.streaming || undefined} className={`workspace-message workspace-message--${turn.role}`}>
            {!!turn.tools?.length && <details className="workspace-tool-log" open={turn.streaming || undefined}><summary>자료 확인 · {turn.tools.length}</summary><ul>{turn.tools.map(tool => <li key={tool.call_id} data-status={tool.status}>
              <span aria-hidden>{tool.status === "started" ? "◌" : tool.status === "failed" ? "!" : "✓"}</span>{tool.label}<small>{tool.status === "started" ? "확인 중" : tool.status === "failed" ? "확인 실패" : "완료"}</small>
            </li>)}</ul></details>}
            <ReplyText text={turn.text} />{turn.incomplete && <p className="workspace-answer-incomplete">답변이 완료되지 않았어요.</p>}
            {turn.answer && <div className="workspace-answer-evidence">{turn.answer.explanation && <p>{turn.answer.explanation}</p>}
              <button onClick={() => showEvidence(turn.answer!)}>연결 근거 보기 ↗</button>
              <div className="workspace-citations">{turn.answer.sources.map(source => <button key={source.id} onClick={() => showEvidence(turn.answer!, source.id)} title={basisLabels[source.basis]}>{source.title}</button>)}</div>
            </div>}</article>)}
          {busy && progress && <p className="workspace-chat-progress" role="status">{progress}</p>}<div ref={end} />
        </div>
        <div className="chat-suggestions">{suggestions.map(s => <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}>{s}</button>)}</div>
        <form className="workspace-chat-input" onSubmit={e => void send(e)}><label className="sr-only" htmlFor="workspace-question">질문</label>
          <textarea id="workspace-question" ref={inputRef} value={input} onChange={e => setInput(e.target.value)} maxLength={2000} placeholder={available ? "궁금한 내용을 물어보세요" : "AI 연결을 사용할 수 없어요"}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          {busy ? <button type="button" onClick={stopAnswer} aria-label="답변 중지">■</button>
            : <button disabled={!input.trim() || !available || loading} aria-label="질문 보내기">↑</button>}
        </form>
      </section>
      <div className="workspace-notices" aria-live="polite">{(error || goalsError) && <p className="workspace-error" role="alert">{error || goalsError}<button aria-label="알림 닫기" onClick={() => setError(null)}>×</button></p>}
        {warnings.map(w => warningLabels[w] && <p key={w}>{warningLabels[w]}</p>)}
        {graph.truncated && <p>관계별 일부를 표시해요. 검색하거나 연결을 펼쳐 탐색할 수 있어요.</p>}
      </div>
    </section>
    {!goals.length && !goalsLoading && <Link className="workspace-add-goal" to="/myinfo">목표 추가하기 →</Link>}
  </main></div>;
}
