import type { Skill, SkillQualification } from "../../services/types";
import { examOutlook, examOutlookText, localToday, qualificationCaption, qualificationLabel, yearStart } from "../../services/skillDetail";
import { useDefinition, useExamSessions } from "./useSkillResources";

export function DetailSkeleton() {
  return <div className="sd-skeleton" role="status" aria-label="불러오는 중"><span /><span /></div>;
}

export function SkillDefinition({ skill }: { readonly skill: Skill }) {
  const result = useDefinition(skill.ncs_base_code);
  if (result.state === "loading") return <div className="sd-definition"><DetailSkeleton /></div>;
  const data = result.state === "ready" ? result.data : null;
  const empty = result.state === "missing" || (data != null && data.item.definition == null);
  const asOf = data?.sources[0]?.data_as_of;
  return (
    <div className="sd-definition">
      {data?.item.definition ? <p><strong>{skill.name}</strong> = {data.item.definition}</p>
        : <p className="sd-muted">{empty ? "NCS에 등록된 정의가 없어요" : "정의를 불러오지 못했어요"}</p>}
      {data?.item.definition && <small>NCS 능력단위 정의{asOf ? ` · 기준일 ${asOf.slice(0, 10)}` : ""}</small>}
    </div>
  );
}

function QualificationCard({ qualification }: { readonly qualification: SkillQualification }) {
  const today = localToday();
  const result = useExamSessions(qualification.code, yearStart(today));
  return (
    <div className="sd-qualification">
      <strong>{qualificationLabel(qualification)}</strong><small>{qualificationCaption(qualification)}</small>
      {qualification.kind === "WORK_LEARNING" && <small>일학습병행 훈련을 마친 재직자만 응시할 수 있어요</small>}
      {result.state === "loading" ? <DetailSkeleton /> : <p className="sd-muted">
        {result.state === "error" || result.state === "missing" ? "일정을 불러오지 못했어요"
          : examOutlookText(examOutlook(result.data.items, today))}
      </p>}
    </div>
  );
}

export function SkillQualifications({ skill }: { readonly skill: Skill }) {
  return <section className="sd-section">
    <h3>관련 국가자격</h3>
    {skill.qualifications?.length ? skill.qualifications.map(qualification => (
      <QualificationCard key={qualification.code} qualification={qualification} />
    )) : <p className="sd-empty-card">관련 국가자격 없음 · 포트폴리오로 증명해요</p>}
  </section>;
}
