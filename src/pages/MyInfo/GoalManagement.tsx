import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useOccupations } from "../../context/OccupationsContext";
import { analysisApi, goalsApi, profileApi } from "../../services/api";
import { requiresActiveTargetedGoal } from "../../services/analysisGoal";
import { goalCalendarDate, goalDateRange, goalDeadline } from "../../services/goalDates";
import type { GoalResponse, GoalStatus, GoalUpdateRequest } from "../../services/types";

interface Props {
  readonly goals: readonly GoalResponse[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refresh: (preferredGoalId?: string) => Promise<void>;
  readonly onProfileVersionChange: (version: number) => void;
}

interface Editor {
  readonly goal: GoalResponse | null;
  readonly occupation: string;
  readonly date: string;
  readonly timezone: string;
}

const DISCOVERY = "__DISCOVERY__";
const statusLabels = { ACTIVE: "활성", ARCHIVED: "보관됨", DRAFT: "임시저장" } as const;

function shownDate(goal: GoalResponse) {
  try { return goalCalendarDate(goal.target_by, goal.timezone); }
  catch { return goal.target_by.slice(0, 10); }
}

function writeError(cause: unknown): string {
  const status = (cause as { status?: number })?.status;
  if (status === 409) return "다른 곳에서 정보가 변경됐거나 활성 목표가 이미 있어요. 목록을 확인하고 다시 저장해 주세요.";
  if (status === 422) return "목표 직무, 목표일과 시간대를 확인한 뒤 다시 저장해 주세요.";
  return "목표를 저장하지 못했어요. 입력 내용은 유지했어요. 연결을 확인하고 다시 시도해 주세요.";
}

export function GoalManagement({ goals, loading, error, refresh, onProfileVersionChange }: Props) {
  const { occupations, getName, loading: occupationsLoading, error: occupationsError, refresh: refreshOccupations } = useOccupations();
  const { hash } = useLocation();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState(false);
  const [writeFailure, setWriteFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [analysisRetry, setAnalysisRetry] = useState<string | null>(null);
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GoalResponse | null>(null);
  const [deleteFailure, setDeleteFailure] = useState<string | null>(null);
  const inFlight = useRef(false);
  const createAttempt = useRef<{ signature: string; request: GoalUpdateRequest; key: string } | null>(null);
  const active = goals.find(goal => goal.status === "ACTIVE");
  const blocked = pending || loading;

  useEffect(() => {
    if (hash === "#goals") document.getElementById("goals")?.scrollIntoView?.({ block: "start" });
  }, [hash]);

  function openEditor(goal: GoalResponse | null) {
    setDeleteTarget(null);
    createAttempt.current = null;
    setWriteFailure(null);
    setNotice(null);
    setAnalysisRequested(false);
    const timezone = goal?.timezone || "Asia/Seoul";
    setEditor({ goal, timezone,
      occupation: goal ? goal.goal_mode === "DISCOVERY" ? DISCOVERY : goal.occupation_id || "" : "",
      date: goal ? shownDate(goal) : goalCalendarDate(new Date(Date.now() + 90 * 86_400_000), timezone),
    });
  }

  function confirmDeletion(goal: GoalResponse) {
    setDeleteTarget(goal); setDeleteFailure(null);
    setEditor(null); createAttempt.current = null;
    setWriteFailure(null); setNotice(null); setAnalysisRetry(null); setAnalysisRequested(false);
  }

  useEffect(() => {
    const current = goals.find(goal => goal.goal_id === deleteTarget?.goal_id);
    if (current && (current.occupation_id !== deleteTarget?.occupation_id || current.status !== deleteTarget.status || current.target_by !== deleteTarget.target_by || current.timezone !== deleteTarget.timezone)) {
      setDeleteTarget(current);
    }
  }, [goals, deleteTarget]);

  async function deleteGoal() {
    if (!deleteTarget || inFlight.current) return;
    inFlight.current = true; setPending(true); setDeleteFailure(null);
    try {
      const profile = await profileApi.get();
      const result = await goalsApi.delete(deleteTarget.goal_id, { expected_profile_version: profile.version });
      onProfileVersionChange(result.profile_version);
      setDeleteTarget(null); setEditor(null);
      setAnalysisRetry(null); setAnalysisRequested(false);
      setNotice(`‘${getName(deleteTarget.occupation_id)}’ 목표와 관련 기록을 삭제했어요. 다른 목표는 자동으로 활성화하지 않아요.`);
      await refresh().catch(() => {});
    } catch (cause) {
      const status = (cause as { status?: number })?.status;
      if (status === 404) {
        setDeleteTarget(null);
        setNotice("이 목표는 이미 삭제됐거나 더 이상 찾을 수 없어요. 목표 목록을 다시 확인해 주세요.");
        await refresh().catch(() => {});
        try { onProfileVersionChange((await profileApi.get()).version); } catch { /* List/profile can be retried independently. */ }
      } else if (status === 409) {
        setDeleteFailure("정보가 변경됐어요. 목표 목록과 삭제할 내용을 확인한 뒤 다시 삭제해 주세요.");
        await refresh().catch(() => {});
      } else setDeleteFailure("목표를 삭제하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally { inFlight.current = false; setPending(false); }
  }

  async function requestAnalysis(goalId: string) {
    const current = await profileApi.get();
    onProfileVersionChange(current.version);
    await analysisApi.create({ goal_id: goalId, expected_profile_version: current.version, basis_type: "EDITORIAL" });
  }

  async function afterSave(goalId: string, status: GoalStatus, targeted: boolean) {
    setEditor(null);
    setAnalysisRetry(null);
    setAnalysisRequested(false);
    setNotice(status === "DRAFT" ? "목표를 임시저장했어요. 현재 활성 목표는 유지돼요." : "목표를 저장했어요.");
    await refresh(goalId).catch(() => {}); // List failure has its own retry; the write already succeeded.
    try {
      if (status === "ACTIVE" && targeted) {
        await requestAnalysis(goalId);
        setAnalysisRequested(true);
        setNotice("목표를 저장하고 새 분석을 요청했어요. 분석 화면에서 진행 상태를 확인할 수 있어요.");
      } else {
        onProfileVersionChange((await profileApi.get()).version);
      }
    } catch (cause) {
      if (requiresActiveTargetedGoal(cause)) {
        setAnalysisRetry(null);
        setNotice("목표는 저장됐어요. 분석하려면 아래 목표 목록에서 직무가 정해진 목표를 활성화해 주세요.");
        await refresh(goalId).catch(() => {});
        return;
      }
      if (status === "ACTIVE" && targeted) {
        setAnalysisRetry(goalId);
        setNotice("목표는 저장됐어요. 새 분석을 요청하지 못했으니 분석만 다시 시도해 주세요.");
      } else setNotice("목표는 저장됐어요. 최신 정보는 목록에서 다시 확인해 주세요.");
    }
  }

  async function saveEditor(event: FormEvent) {
    event.preventDefault();
    if (!editor || inFlight.current) return;
    setWriteFailure(null);
    let targetBy: string;
    try {
      targetBy = goalDeadline(editor.date, editor.timezone.trim());
      const remaining = Date.parse(targetBy) - Date.now();
      if (editor.goal?.status !== "ARCHIVED" && (remaining <= 0 || remaining > 366 * 86_400_000)) throw new Error("date range");
      if (!editor.occupation) throw new Error("occupation");
    } catch {
      setWriteFailure("직무와 올바른 시간대를 선택해 주세요. 활성·임시 목표의 목표일은 현재 시각부터 366일 이내의 미래여야 해요.");
      return;
    }
    inFlight.current = true; setPending(true); setNotice(null); setAnalysisRetry(null);
    try {
      const profile = await profileApi.get();
      const status = editor.goal?.status ?? (active ? "DRAFT" : "ACTIVE");
      const request: GoalUpdateRequest = {
        expected_profile_version: profile.version, status,
        goal_mode: editor.occupation === DISCOVERY ? "DISCOVERY" : "TARGETED",
        ...(editor.occupation !== DISCOVERY ? { occupation_id: editor.occupation } : {}),
        target_by: targetBy, timezone: editor.timezone.trim(), original_time_phrase: `${editor.date}까지`,
      };
      let result: GoalResponse;
      if (editor.goal) result = await goalsApi.update(editor.goal.goal_id, request);
      else {
        const signature = JSON.stringify({ ...request, expected_profile_version: undefined, status: undefined });
        if (createAttempt.current?.signature !== signature) createAttempt.current = { signature, request, key: crypto.randomUUID() };
        // Retry an ambiguous failed create with its original payload/key, even if its
        // committed profile bump is now visible. The server can replay it safely.
        result = await goalsApi.create(createAttempt.current.request, createAttempt.current.key);
      }
      createAttempt.current = null;
      await afterSave(result.goal_id, result.status, request.goal_mode === "TARGETED");
    } catch (cause) {
      const status = (cause as { status?: number })?.status;
      if (status === 409 || status === 422) createAttempt.current = null;
      setWriteFailure(writeError(cause));
      if (status === 409) await refresh().catch(() => {});
    } finally { inFlight.current = false; setPending(false); }
  }

  async function changeStatus(goal: GoalResponse, status: GoalStatus) {
    if (inFlight.current) return;
    setDeleteTarget(null);
    inFlight.current = true; setPending(true); setWriteFailure(null); setNotice(null); setAnalysisRetry(null);
    try {
      const profile = await profileApi.get();
      const latest = await goalsApi.get(goal.goal_id);
      const result = await goalsApi.update(goal.goal_id, {
        expected_profile_version: profile.version, goal_mode: latest.goal_mode,
        ...(latest.occupation_id ? { occupation_id: latest.occupation_id } : {}),
        target_by: latest.target_by, timezone: latest.timezone, original_time_phrase: latest.original_time_phrase, status,
      });
      await afterSave(result.goal_id, result.status, latest.goal_mode === "TARGETED");
    } catch (cause) {
      setWriteFailure(writeError(cause));
      if ((cause as { status?: number })?.status === 409) await refresh().catch(() => {});
    }
    finally { inFlight.current = false; setPending(false); }
  }

  async function retryAnalysis() {
    if (!analysisRetry || inFlight.current) return;
    inFlight.current = true; setPending(true);
    try {
      await requestAnalysis(analysisRetry);
      setAnalysisRequested(true);
      setAnalysisRetry(null); setNotice("새 분석을 요청했어요. 분석 화면에서 진행 상태를 확인해 주세요.");
    } catch (cause) {
      if (requiresActiveTargetedGoal(cause)) {
        setAnalysisRetry(null);
        setNotice("분석하려면 목표 목록에서 직무가 정해진 목표를 활성화해 주세요.");
        await refresh().catch(() => {});
      } else setNotice("목표는 저장됐어요. 분석 요청에 실패했으니 잠시 후 다시 시도해 주세요.");
    }
    finally { inFlight.current = false; setPending(false); }
  }

  let dateRange: { min: string; max: string } | undefined;
  try { if (editor) dateRange = goalDateRange(editor.timezone.trim()); } catch { /* Show field validation on save. */ }
  return <section className="mi-goals-card" id="goals" aria-labelledby="mi-goals-title" aria-busy={pending || loading}>
    <div className="mi-card-header"><h3 className="mi-card-title" id="mi-goals-title">내 목표</h3><button className="mi-save-btn" disabled={blocked || !!error} onClick={() => openEditor(null)}>목표 추가</button></div>
    <p className="mi-goal-help">활성 목표는 한 번에 하나예요.</p>
    {loading && <p role="status">목표를 불러오는 중이에요.</p>}
    {error && <div className="mi-goal-error" role="alert"><p>{error}</p><button className="mi-save-btn" disabled={blocked} onClick={() => void refresh().catch(() => {})}>목표 목록 다시 불러오기</button></div>}
    {!loading && !error && !goals.length && <p className="mi-goal-empty">아직 목표가 없어요. 목표를 추가해 주세요.</p>}
    {goals.map(goal => <div key={goal.goal_id} className="mi-goal-item">
      <div className="mi-goal-info"><div><span className="mi-goal-name">{getName(goal.occupation_id)}</span><p className="mi-goal-help">목표일 {shownDate(goal)} · {goal.timezone}</p></div><span className={`mi-goal-badge mi-goal-badge--${goal.status.toLowerCase()}`}>{statusLabels[goal.status]}</span></div>
      <div className="mi-goal-actions"><button className="mi-goal-archive-btn" disabled={blocked || !!error} onClick={() => openEditor(goal)} aria-label={`${getName(goal.occupation_id)} 목표 수정`}>수정</button>
        {goal.status === "ACTIVE" ? <button className="mi-goal-archive-btn" disabled={blocked || !!error} onClick={() => void changeStatus(goal, "ARCHIVED")}>보관</button> : Date.parse(goal.target_by) <= Date.now() || Date.parse(goal.target_by) - Date.now() > 366 * 86_400_000 ? <button className="mi-goal-archive-btn" disabled={blocked || !!error} onClick={() => openEditor(goal)}>목표일 수정 후 활성화</button> : <button className="mi-goal-archive-btn" disabled={blocked || !!error || !!active} title={active ? "현재 활성 목표를 먼저 보관해 주세요" : undefined} onClick={() => void changeStatus(goal, "ACTIVE")}>활성화</button>}
        <button className="mi-delete-btn mi-goal-delete-btn" disabled={blocked || !!error} onClick={() => confirmDeletion(goal)} aria-label={`${getName(goal.occupation_id)} 목표 삭제`}>삭제</button>
      </div>
    </div>)}
    {active && goals.some(goal => goal.status !== "ACTIVE") && <p className="mi-goal-help">다른 목표를 활성화하려면 현재 활성 목표를 먼저 보관해 주세요. 기존 로드맵과 학습 기록은 보관돼요.</p>}
    {deleteTarget && <div className="mi-delete-confirm mi-goal-delete-confirm" role="group" aria-labelledby="mi-goal-delete-title" aria-busy={pending}>
      <h4 id="mi-goal-delete-title">‘{getName(deleteTarget.occupation_id)}’ 목표를 영구 삭제할까요?</h4>
      <p>목표일 {shownDate(deleteTarget)} · {deleteTarget.timezone} · {statusLabels[deleteTarget.status]}</p>
      <p>이 목표에 연결된 로드맵, 분석 결과와 학습 진행 기록이 모두 삭제되며 복구할 수 없어요.</p>
      <p>계정, 프로필과 등록한 역량은 유지돼요. 다른 목표가 자동으로 활성화되지는 않아요.</p>
      {deleteFailure && <p className="mi-delete-error" role="alert">{deleteFailure}</p>}
      <div className="mi-account-actions"><button className="mi-save-btn" disabled={blocked} onClick={() => { setDeleteTarget(null); setDeleteFailure(null); }}>취소</button><button className="mi-delete-btn mi-delete-btn--confirm" disabled={blocked || !!error} onClick={() => void deleteGoal()}>{pending ? "삭제 중..." : "목표 영구 삭제"}</button></div>
    </div>}
    {editor && <form className="mi-goal-editor" onSubmit={event => void saveEditor(event)}>
      <h4>{editor.goal ? "목표 수정" : "새 목표"}</h4>
      {!editor.goal && active && <p className="mi-goal-help">현재 활성 목표를 유지하고 새 목표는 임시저장해요.</p>}
      {editor.goal && <p className="mi-goal-help">직무 변경 시 이전 로드맵·학습 기록을 보관하고, 목표일만 변경하면 유지해요. 직무가 있는 활성 목표는 저장 후 다시 분석해요.</p>}
      {editor.goal?.status !== "ACTIVE" && editor.goal && <p className="mi-goal-help">이 목표를 수정해도 자동으로 활성화되지는 않아요. 저장 후 ‘활성화’를 눌러 주세요.</p>}
      {editor.occupation === DISCOVERY && <p className="mi-goal-help">탐색 목표는 저장 후 직무를 선택하면 역량 분석을 시작할 수 있어요.</p>}
      <label className="mi-field"><span className="mi-label">목표 직무</span><select className="mi-input" required value={editor.occupation} disabled={blocked || occupationsLoading} onChange={event => setEditor({ ...editor, occupation: event.target.value })}><option value="" disabled>직무를 선택해 주세요</option><option value={DISCOVERY}>아직 탐색 중이에요</option>{occupations.map(occupation => <option key={occupation.occupation_id} value={occupation.occupation_id}>{occupation.name}</option>)}</select></label>
      {occupationsError && <div className="mi-goal-error" role="alert"><p>{occupationsError}</p><button className="mi-save-btn" type="button" disabled={blocked} onClick={() => void refreshOccupations().catch(() => {})}>직무 목록 다시 불러오기</button></div>}
      <div className="mi-goal-fields"><label className="mi-field"><span className="mi-label">목표일</span><input className="mi-input" type="date" required value={editor.date} min={editor.goal?.status === "ARCHIVED" ? undefined : dateRange?.min} max={editor.goal?.status === "ARCHIVED" ? undefined : dateRange?.max} disabled={blocked} onChange={event => setEditor({ ...editor, date: event.target.value })} /></label>
      <label className="mi-field"><span className="mi-label">시간대</span><input className="mi-input" required maxLength={100} placeholder="Asia/Seoul" list="mi-goal-timezones" value={editor.timezone} disabled={blocked} onChange={event => setEditor({ ...editor, timezone: event.target.value })} /><datalist id="mi-goal-timezones"><option value="Asia/Seoul" /><option value="UTC" /><option value="America/New_York" /><option value="Europe/London" /></datalist></label></div>
      <p className="mi-goal-help">선택한 시간대의 하루 끝 기준 · 활성·임시 목표는 366일 이내 · 보관 목표는 과거 날짜 유지 가능</p>
      <div className="mi-goal-actions"><button className="mi-save-btn" type="button" disabled={blocked} onClick={() => { setEditor(null); setWriteFailure(null); }}>취소</button><button className="mi-roadmap-btn mi-goal-submit" type="submit" disabled={blocked || occupationsLoading}>{pending ? "저장 중..." : !editor.goal && active ? "목표 임시저장" : "목표 저장"}</button></div>
    </form>}
    {writeFailure && <p className="mi-goal-error" role="alert">{writeFailure}</p>}
    {notice && <p className="mi-goal-notice" role="status">{notice}</p>}
    {analysisRetry && <button className="mi-save-btn" disabled={blocked} onClick={() => void retryAnalysis()}>분석 다시 요청</button>}
    {notice && analysisRequested && <Link className="mi-goal-analysis-link" to="/analysis">분석 화면으로 이동 →</Link>}
  </section>;
}
