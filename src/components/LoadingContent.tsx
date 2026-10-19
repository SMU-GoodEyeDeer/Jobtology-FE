import type { ReactNode } from "react";
import "./LoadingContent.css";

// Keep children mounted so their data requests can finish, but reveal the page
// together instead of moving already-visible cards as each request resolves.
export function LoadingContent({ loading, label = "정보를 불러오는 중이에요", children }: {
  loading: boolean; label?: string; children: ReactNode;
}) {
  return <div className="page-data" aria-busy={loading}>
    {loading && <div className="page-skeleton" role="status">
      <p>{label}</p>
      <div className="page-skeleton-card" aria-hidden="true"><i /><i /><i /></div>
      <div className="page-skeleton-card page-skeleton-card--tall" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <i key={i} />)}
      </div>
    </div>}
    <div className="page-data-content" hidden={loading}>{children}</div>
  </div>;
}
