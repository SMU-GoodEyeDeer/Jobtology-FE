import { useEffect, useState } from "react";
import { catalogV2Api } from "../../services/api";
import type { Neo4jPublicationResponse, Neo4jNcsAlignmentResponse } from "../../services/types";

export function AnalysisPublications({ onLoadingChange }: { onLoadingChange?: (loading: boolean) => void }) {
  const [publications, setPublications] = useState<Neo4jPublicationResponse[]>([]);
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null);
  const [alignments, setAlignments] = useState<Neo4jNcsAlignmentResponse[]>([]);
  const [alignmentsLoading, setAlignmentsLoading] = useState(false);

  useEffect(() => {
    catalogV2Api.listPublications({ limit: 100 }).then((list) => {
      setPublications(list.filter((p) => p.capabilities.editorial_analysis));
    }).catch(console.error).finally(() => onLoadingChange?.(false));
  }, [onLoadingChange]);

  async function loadAlignments(pubId: string) {
    if (selectedPubId === pubId) {
      setSelectedPubId(null);
      setAlignments([]);
      return;
    }
    setSelectedPubId(pubId);
    setAlignmentsLoading(true);
    try {
      const data = await catalogV2Api.listAlignments(pubId, { limit: 100 });
      setAlignments(data.filter((a) => a.accepted));
    } catch {
      setAlignments([]);
    } finally {
      setAlignmentsLoading(false);
    }
  }

  if (publications.length === 0) return null;
  return <section className="an-skills-card">
    <div className="an-skills-header-row" style={{ marginBottom: 8 }}>
      <span className="an-col" style={{ fontWeight: 600 }}>NCS 연계 학습 자료</span>
      <span style={{ fontSize: 12, color: "var(--tertiary)" }}>항목을 클릭하면 연계 역량을 볼 수 있어요</span>
    </div>
    {publications.map((pub) => (
      <div key={pub.publication_id}>
        <div className="an-skill-row" style={{ cursor: "pointer" }} onClick={() => loadAlignments(pub.publication_id)}>
          <div className="an-col an-col--name">
            <span className="an-skill-name" style={{ fontSize: 13 }}>{pub.publication_id}</span>
            <span className={`an-skill-badge ${pub.capabilities.route_planning ? "an-skill-badge--required" : "an-skill-badge--preferred"}`}>
              {pub.capabilities.route_planning ? "로드맵 활용 가능" : "분석용"}
            </span>
          </div>
          <div className="an-col" style={{ color: "var(--muted)", fontSize: 12 }}>{pub.source_state}</div>
          <div className="an-col" style={{ color: "var(--info)", fontSize: 12 }}>{selectedPubId === pub.publication_id ? "▲ 접기" : "▼ 역량 보기"}</div>
        </div>
        {selectedPubId === pub.publication_id && (
          <div style={{ padding: "8px 16px 12px", background: "var(--surface-soft)", borderRadius: 8, margin: "0 0 8px" }}>
            {alignmentsLoading ? <span style={{ color: "var(--tertiary)", fontSize: 13 }}>불러오는 중...</span>
              : alignments.length === 0 ? <span style={{ color: "var(--tertiary)", fontSize: 13 }}>연계된 NCS 역량이 없어요.</span>
              : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {alignments.map((a) => <span key={a.source_enrichment_id} style={{ background: "var(--info-bg)", color: "var(--info)", borderRadius: 12, padding: "2px 10px", fontSize: 12 }}>{a.competency.name}</span>)}
              </div>}
          </div>
        )}
      </div>
    ))}
  </section>;
}
