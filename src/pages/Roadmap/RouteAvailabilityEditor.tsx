import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { RouteAvailability, RoutePreferencesResponse, WeeklyAvailability } from "../../services/types";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
export function availabilityError(windows: readonly WeeklyAvailability[]): string | null {
  for (const window of windows) if (!Number.isInteger(window.weekday) || window.weekday < 1 || window.weekday > 7 || !Number.isInteger(window.start_hour) || !Number.isInteger(window.end_hour) || window.start_hour < 0 || window.start_hour > 23 || window.end_hour < 1 || window.end_hour > 24 || window.end_hour <= window.start_hour) return "종료 시간은 시작 시간보다 늦게 선택해 주세요.";
  for (let day = 1; day <= 7; day++) {
    const sorted = windows.filter(window => window.weekday === day).sort((a, b) => a.start_hour - b.start_hour);
    if (sorted.some((window, index) => index > 0 && sorted[index - 1].end_hour > window.start_hour)) return "같은 요일의 학습 시간이 겹쳐요. 시간을 조정해 주세요.";
  }
  return null;
}

export function RouteAvailabilityEditor({ preferences, timezone, busy, onSave }: {
  readonly preferences: RoutePreferencesResponse;
  readonly timezone: string;
  readonly busy: boolean;
  readonly onSave: (availability: RouteAvailability) => Promise<boolean>;
}) {
  const [windows, setWindows] = useState<readonly WeeklyAvailability[]>(preferences.weekly_availability ?? []);
  const [dates, setDates] = useState<readonly string[]>(preferences.unavailable_dates ?? []);
  const [date, setDate] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (dirty) return;
    setWindows(preferences.weekly_availability ?? []); setDates(preferences.unavailable_dates ?? []);
  }, [preferences, dirty]);
  function edit() { setDirty(true); setError(null); setNotice(null); }
  function change(index: number, field: keyof WeeklyAvailability, value: number) { edit(); setWindows(previous => previous.map((window, current) => current === index ? { ...window, [field]: value } : window)); }
  async function save(event: FormEvent) {
    event.preventDefault();
    const invalid = availabilityError(windows);
    if (invalid) { setError(invalid); return; }
    if (dates.length > 366) { setError("학습이 어려운 날짜는 366개까지 등록할 수 있어요."); return; }
    const saved = await onSave({ weekly_availability: windows, unavailable_dates: [...dates].sort() });
    if (saved) { setDirty(false); setError(null); setNotice("학습 가능 시간을 저장했어요. 새 경로 계산에 반영돼요."); }
    else setError("시간을 저장하지 못했어요. 입력한 내용은 유지했어요. 다시 시도해 주세요.");
  }
  return <details className="rm-availability"><summary>학습 가능한 요일·시간과 쉬는 날짜</summary>
    <p className="rm-card-sub">{timezone} 기준 · 미설정 시 주당 학습 시간에 맞춰 배치 · 새 경로 계산부터 반영</p>
    <form onSubmit={event => void save(event)} aria-label="학습 가능 시간 설정"><fieldset disabled={busy}>
      <legend>반복되는 학습 시간</legend>
      {windows.map((window, index) => <div className="rm-availability-row" key={index}>
        <label>요일<select aria-label={`${index + 1}번째 학습 요일`} value={window.weekday} onChange={event => change(index, "weekday", Number(event.target.value))}>{weekdays.map((day, index) => <option key={day} value={index + 1}>{day}요일</option>)}</select></label>
        <label>시작<select aria-label={`${index + 1}번째 시작 시간`} value={window.start_hour} onChange={event => change(index, "start_hour", Number(event.target.value))}>{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label>
        <label>종료<select aria-label={`${index + 1}번째 종료 시간`} value={window.end_hour} onChange={event => change(index, "end_hour", Number(event.target.value))}>{Array.from({ length: 24 }, (_, index) => index + 1).map(hour => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}</select></label>
        <button type="button" className="rm-saved-btn" aria-label={`${index + 1}번째 학습 시간 삭제`} onClick={() => { edit(); setWindows(previous => previous.filter((_, current) => current !== index)); }}>삭제</button>
      </div>)}
      <button type="button" className="rm-saved-btn" onClick={() => { edit(); setWindows(previous => [...previous, { weekday: 1, start_hour: 19, end_hour: 21 }]); }}>학습 시간 추가</button>
      <label className="rm-unavailable-label">학습이 어려운 날짜<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <button type="button" className="rm-saved-btn" disabled={!date || dates.includes(date) || dates.length >= 366} onClick={() => { edit(); setDates(previous => [...previous, date].sort()); setDate(""); }}>쉬는 날짜 추가</button>
      {!!dates.length && <ul className="rm-unavailable-dates">{dates.map(value => <li key={value}>{value}<button type="button" aria-label={`${value} 쉬는 날짜 삭제`} onClick={() => { edit(); setDates(previous => previous.filter(date => date !== value)); }}>×</button></li>)}</ul>}
      <div className="rm-availability-actions"><button className="rm-bottom-btn" type="submit" disabled={!dirty}>{busy ? "저장 중…" : "학습 가능 시간 저장"}</button>{dirty && <button className="rm-saved-btn" type="button" onClick={() => { setDirty(false); setError(null); setNotice(null); }}>취소</button>}</div>
    </fieldset></form>
    {error && <p className="rm-card-sub" role="alert">{error}</p>}{notice && <p className="rm-card-sub" role="status">{notice}</p>}
  </details>;
}
