import { useId, useState } from "react";
import type { ExamDateGroup, ExamSession } from "../../services/types";
import "./ExamSessions.css";

function stageLine(label: string, dates: ExamDateGroup | null): string | null {
  if (!dates) return null;
  const period = (start: string | null, end: string | null) => [start, end].filter(Boolean).join(" ~ ");
  const registration = period(dates.registration_start, dates.registration_end);
  const exam = period(dates.exam_start, dates.exam_end);
  return [registration ? `${label} 접수 ${registration}` : "", exam ? `${label} 시험 ${exam}` : "", dates.result_date ? `${label} 발표 ${dates.result_date}` : ""].filter(Boolean).join(" · ") || null;
}

export function ExamSessions({ items, total }: { readonly items: readonly ExamSession[]; readonly total: number }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return <div className="sd-exam-sessions">
    <button className="sd-exam-toggle" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>수집된 시험 일정 {items.length}건{total > items.length ? ` / 전체 ${total}건` : ""} {open ? "접기" : "보기"}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    <div id={id} className="sd-exam-fold" data-expanded={open} aria-hidden={!open} inert={!open}>
      <div className="sd-exam-fold-inner">{items.map((item, index) => {
        const stages = [stageLine("필기", item.written), stageLine("실기", item.practical)].filter(Boolean);
        return <div className="sd-exam-session" key={`${item.year}:${item.round}:${item.category_code}:${index}`}>
          <strong>{[item.year != null ? `${item.year}년` : "", item.round != null ? `${item.round}회` : "", item.name].filter(Boolean).join(" · ") || "회차 정보 미제공"}</strong>
          {stages.length ? stages.map(line => <p key={line}>{line}</p>) : <p>세부 날짜가 제공되지 않았어요.</p>}
        </div>;
      })}</div>
    </div>
  </div>;
}
