import { useState } from "react";
import type { RoadmapResponse } from "../../services/types";

export function RoadmapExtras({ roadmaps, onArchive }: {
  readonly roadmaps: readonly RoadmapResponse[];
  readonly onArchive: (id: string, version: number) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  return <>
    {roadmaps.length > 0 && <section className="rm-card">
      <div className="rm-saved-header"><p className="rm-section-title">저장한 커리어 경로</p></div>
      {roadmaps.map(rm => <div key={rm.roadmap_id} className="rm-saved-card"><div className="rm-saved-top"><div>
        <span className={`rm-badge ${rm.status === "ACTIVE" ? "rm-badge--profile" : ""}`}>{rm.status}</span>
        <div className="rm-saved-title-row"><p className="rm-saved-title">{rm.title}</p><button className="rm-edit-btn" onClick={() => setEditingId(editingId === rm.roadmap_id ? null : rm.roadmap_id)}>{editingId === rm.roadmap_id ? "완료" : "편집"}</button></div>
      </div></div>{editingId === rm.roadmap_id && rm.status !== "ARCHIVED" && <div className="rm-saved-actions"><button className="rm-saved-btn rm-saved-btn--delete" onClick={() => void onArchive(rm.roadmap_id, rm.version)}>보관</button></div>}</div>)}
    </section>}
  </>;
}
