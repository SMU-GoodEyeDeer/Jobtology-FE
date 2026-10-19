import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../../context/SessionContext";

export function AccountSettings() {
  const { session, deleteAccount } = useSession();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function handleDelete() {
    if (!acknowledged || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch {
      setError("계정을 삭제하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      inFlight.current = false;
      setPending(false);
    }
  }

  return <section className="mi-account-card" aria-labelledby="mi-account-title">
    <h3 className="mi-card-title" id="mi-account-title">계정 설정</h3>
    <p className="mi-account-description">{session?.display_name?.trim() || "사용자"}님 · Google로 로그인</p>
    {!confirming ? <button className="mi-delete-btn" onClick={() => { setConfirming(true); setAcknowledged(false); setError(null); }}>Jobtology 계정 삭제</button> :
      <div className="mi-delete-confirm" role="group" aria-labelledby="mi-delete-title" aria-busy={pending}>
        <h4 id="mi-delete-title">Jobtology 계정을 영구 삭제할까요?</h4>
        <p>프로필, 목표, 역량, 분석 및 로드맵이 모두 삭제돼요. 삭제 후에는 복구할 수 없으며 모든 기기에서 로그아웃돼요.</p>
        <p>Google 계정은 삭제되지 않아요. 나중에 다시 로그인하면 새 Jobtology 계정이 만들어져요.</p>
        <label className="mi-delete-acknowledgement"><input type="checkbox" checked={acknowledged} disabled={pending} onChange={event => setAcknowledged(event.target.checked)} />이 Jobtology 계정과 데이터가 영구 삭제된다는 것을 확인했어요.</label>
        {error && <p className="mi-delete-error" role="alert">{error}</p>}
        <div className="mi-account-actions">
          <button className="mi-save-btn" disabled={pending} onClick={() => { setConfirming(false); setError(null); }}>취소</button>
          <button className="mi-delete-btn mi-delete-btn--confirm" disabled={!acknowledged || pending} onClick={() => void handleDelete()}>{pending ? "삭제 중..." : "Jobtology 계정 영구 삭제"}</button>
        </div>
      </div>}
  </section>;
}
