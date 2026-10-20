import { useEffect, useState } from "react";
import { proposalsApi } from "../../services/api";

export const PARTIAL_ROUTE_NOTICE =
  "목표 기간 안에 필수 역량을 모두 배우기 어려워, 기간 안에 가능한 범위의 일부 경로를 보여드려요.";

export function isPartialRoute(feasibility: string | null | undefined): boolean {
  return feasibility === "PARTIAL";
}

// Saved roadmaps do not carry feasibility, so read it from their source proposal.
export function usePartialRoute(proposalId: string | null) {
  const [result, setResult] = useState<{ id: string; partial: boolean; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!proposalId) return;
    let stopped = false;
    proposalsApi
      .get(proposalId)
      .then((proposal) => {
        if (!stopped) setResult({ id: proposalId, partial: isPartialRoute(proposal.feasibility) });
      })
      .catch(() => {
        if (!stopped) setResult(previous => ({ id: proposalId, partial: previous?.id === proposalId && previous.partial, error: "경로의 목표 기간 충족 여부를 확인하지 못했어요. 일부 역량만 포함된 경로일 수 있어요." }));
      });
    return () => {
      stopped = true;
    };
  }, [proposalId, attempt]);
  return { partial: result?.id === proposalId && result.partial, loading: !!proposalId && result?.id !== proposalId, error: result?.id === proposalId ? result.error ?? null : null, retry: () => setAttempt(value => value + 1) };
}
