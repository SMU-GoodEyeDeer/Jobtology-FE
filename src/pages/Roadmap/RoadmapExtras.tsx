import { useState } from "react";
import type { Neo4jPublicationResponse, RoadmapResponse } from "../../services/types";

export function RoadmapExtras({ roadmaps, publications, onArchive }: {
  readonly roadmaps: readonly RoadmapResponse[];
  readonly publications: readonly Neo4jPublicationResponse[];
  readonly onArchive: (id: string, version: number) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return <>
    {roadmaps.length > 0 && <section className="rm-card">
      <div className="rm-saved-header"><p className="rm-section-title">저장한 커리어 경로</p><p className="rm-section-sub">저장된 모든 로드맵이에요.</p></div>
      {roadmaps.map(rm => <div key={rm.roadmap_id} className="rm-saved-card"><div className="rm-saved-top"><div>
        <span className={`rm-badge ${rm.status === "ACTIVE" ? "rm-badge--profile" : ""}`}>{rm.status}</span>
        <div className="rm-saved-title-row"><p className="rm-saved-title">{rm.title}</p><button className="rm-edit-btn" onClick={() => setEditingId(editingId === rm.roadmap_id ? null : rm.roadmap_id)}>{editingId === rm.roadmap_id ? "완료" : "편집"}</button></div>
      </div></div>{editingId === rm.roadmap_id && rm.status !== "ARCHIVED" && <div className="rm-saved-actions"><button className="rm-saved-btn rm-saved-btn--delete" onClick={() => void onArchive(rm.roadmap_id, rm.version)}>보관</button></div>}</div>)}
    </section>}
    {publications.length > 0 && <section className="rm-card">
      <div className="rm-saved-header"><p className="rm-section-title">활용 가능한 학습 자료</p><p className="rm-section-sub">로드맵 경로 계획에 활용할 수 있는 자료예요.</p></div>
      {publications.map(pub => <div key={pub.publication_id} className="rm-saved-card"><div className="rm-saved-top"><div><span className={`rm-badge ${pub.source_state === "ACTIVE" ? "rm-badge--profile" : ""}`}>{pub.source_state}</span><div className="rm-saved-title-row"><p className="rm-saved-title">{pub.publication_id}</p>{pub.capabilities.editorial_analysis && <span className="rm-badge">역량 분석</span>}</div></div></div></div>)}
    </section>}
  </>;
}
