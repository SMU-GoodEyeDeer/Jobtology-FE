import type { Skill, SkillQualification } from "../../services/types";
import { examOutlook, examOutlookText, localToday, qualificationCaption, qualificationLabel, yearStart } from "../../services/skillDetail";
import { useDefinition, useExamSessions } from "./useSkillResources";
import { ExamSessions } from "./ExamSessions";

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

export function QualificationCard({ qualification }: { readonly qualification: SkillQualification }) {
  const today = localToday();
  const result = useExamSessions(qualification.code, yearStart(today));
  return (
    <div className="sd-qualification">
      <strong>{qualificationLabel(qualification)}</strong><small>{qualificationCaption(qualification)}</small>
      <small>자격 코드 {qualification.code}</small>
      {result.state === "loading" ? <DetailSkeleton /> : result.state !== "ready" ? <p className="sd-muted">수집된 시험 일정을 불러오지 못했어요. Q-Net에서 확인해 주세요.</p> : <>
        <p className="sd-muted">{examOutlookText(examOutlook(result.data.items, today))}</p>
        {!!result.data.items.length && <ExamSessions key={qualification.code} items={result.data.items} total={result.data.total} />}
        {result.data.sources?.map(source => <small key={source.source_id}>{source.source_id}{source.data_as_of ? ` · 수집 기준 ${source.data_as_of.slice(0, 10)}` : ""}</small>)}
      </>}
      <a className="sd-official-link" href="https://www.q-net.or.kr/" target="_blank" rel="noopener noreferrer">Q-Net에서 일정·응시 자격 확인 ↗</a>
      <small>수집 정보에 없는 일정이 있을 수 있어요. 응시 요건과 최종 일정은 공식 안내를 확인해 주세요.</small>
    </div>
  );
}

export function SkillQualifications({ skill }: { readonly skill: Skill }) {
  return <section className="sd-section">
    <h3>관련 국가자격</h3>
    {skill.qualifications?.length ? skill.qualifications.map(qualification => (
      <QualificationCard key={qualification.code} qualification={qualification} />
    )) : <p className="sd-empty-card">현재 데이터에서 이 역량과 연결된 국가자격이 확인되지 않았어요.</p>}
  </section>;
}
