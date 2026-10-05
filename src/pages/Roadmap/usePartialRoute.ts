import { useEffect, useState } from "react";
import { proposalsApi } from "../../services/api";

export const PARTIAL_ROUTE_NOTICE =
  "목표 기간 안에 필수 역량을 모두 배우기 어려워, 기간 안에 가능한 범위의 일부 경로를 보여드려요.";

export function isPartialRoute(feasibility: string | null | undefined): boolean {
  return feasibility === "PARTIAL";
}

// Saved roadmaps do not carry feasibility, so read it from their source proposal.
export function usePartialRoute(proposalId: string | null): boolean {
  const [partial, setPartial] = useState(false);
  useEffect(() => {
    setPartial(false);
    if (!proposalId) return;
    let stopped = false;
    proposalsApi
      .get(proposalId)
      .then((proposal) => {
        if (!stopped) setPartial(isPartialRoute(proposal.feasibility));
      })
      .catch(() => {
        if (!stopped) setPartial(false);
      });
    return () => {
      stopped = true;
    };
  }, [proposalId]);
  return partial;
}
