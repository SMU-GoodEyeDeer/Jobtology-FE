export function WorkspaceLoading({ label = "연결 지도를 준비하고 있어요" }: { label?: string }) {
  return <div className="workspace-loading" role="status">
    <svg className="workspace-loading-map" viewBox="0 0 320 180" aria-hidden="true">
      <g className="workspace-loading-links"><path d="M160 90 70 45M160 90 65 135M160 90 245 40M160 90 255 135M70 45 65 135M245 40 255 135" /></g>
      <g className="workspace-loading-nodes"><circle cx="160" cy="90" r="19" /><circle cx="70" cy="45" r="11" /><circle cx="65" cy="135" r="9" /><circle cx="245" cy="40" r="10" /><circle cx="255" cy="135" r="13" /></g>
      <circle className="workspace-loading-orbit" cx="160" cy="90" r="32" />
    </svg>
    <span>{label}</span>
  </div>;
}
