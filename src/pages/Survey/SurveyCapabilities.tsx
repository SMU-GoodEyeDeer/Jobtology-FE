import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Survey.css";
import logoIcon from "../../assets/logo.svg";
import { useSurvey } from "../../context/SurveyContext";
import { useSession } from "../../context/SessionContext";
import { capabilitiesApi } from "../../services/api";
import type { CapabilityChecklistGroup } from "../../services/types";

type LoadState = "loading" | "ready" | "unavailable";

export function SurveyCapabilities() {
  const navigate = useNavigate();
  const { data, update } = useSurvey();
  const { session, loading: sessionLoading } = useSession();
  const occupationId = data.occupationId;
  const [groups, setGroups] = useState<CapabilityChecklistGroup[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(data.capabilityItemIds));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sessionLoading && !session) navigate("/");
  }, [session, sessionLoading, navigate]);

  useEffect(() => {
    if (!occupationId) {
      navigate("/survey/3", { replace: true });
      return;
    }
    let stopped = false;
    setLoadState("loading");
    capabilitiesApi
      .checklist(occupationId)
      .then((res) => {
        if (stopped) return;
        setGroups(res.groups);
        setLoadState(res.groups.length > 0 ? "ready" : "unavailable");
      })
      .catch(() => {
        if (!stopped) setLoadState("unavailable");
      });
    return () => {
      stopped = true;
    };
  }, [occupationId, attempt, navigate]);

  function toggle(itemId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function handleNext() {
    const visible = new Set(groups.flatMap((group) => group.items.map((item) => item.item_id)));
    update({
      capabilityItemIds: [...selected].filter((id) => visible.has(id)),
      capabilityAnswered: true,
    });
    navigate("/survey/3");
  }

  function handleSkip() {
    update({ capabilityItemIds: [], capabilityAnswered: false });
    navigate("/survey/3");
  }

  return (
    <div className="survey-page">
      <header className="survey-header">
        <img src={logoIcon} alt="로고" />
        <h1>잡톨로지</h1>
      </header>

      <div className="survey-card">
        <p className="survey-step">STEP 2 / 4</p>
        <p className="survey-title">이미 해본 것을 골라주세요</p>
        <p className="survey-subtitle">
          {data.occupationName ? `${data.occupationName} 기준이에요. ` : ""}
          잘 모르겠으면 고르지 않아도 괜찮아요.
        </p>

        {loadState === "loading" && <p className="checklist-status">항목을 불러오는 중...</p>}

        {loadState === "unavailable" && (
          <div className="checklist-status">
            <p>지금은 체크 항목을 불러올 수 없어요. 건너뛰고 나중에 내 정보에서 입력할 수 있어요.</p>
            <button type="button" className="btn-prev" onClick={() => setAttempt((n) => n + 1)}>
              다시 불러오기
            </button>
          </div>
        )}

        {loadState === "ready" && (
          <div className="checklist">
            {groups.map((group) => (
              <section key={group.label} className="checklist-group">
                <p className="checklist-group-label">{group.label}</p>
                {group.items.map((item) => (
                  <label
                    key={item.item_id}
                    className={`checklist-item${selected.has(item.item_id) ? " selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.item_id)}
                      onChange={() => toggle(item.item_id)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </section>
            ))}
          </div>
        )}

        <p className="checklist-note">본인 응답으로 저장되며, 내 정보에서 언제든 수정할 수 있어요.</p>
        <button type="button" className="checklist-skip" onClick={handleSkip}>
          잘 모르겠어요, 건너뛸게요
        </button>

        <div className="survey-actions">
          <button className="btn-prev" onClick={() => navigate("/survey/1")}>
            이전
          </button>
          <button className="btn-next" onClick={handleNext} disabled={loadState !== "ready"}>
            다음{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
