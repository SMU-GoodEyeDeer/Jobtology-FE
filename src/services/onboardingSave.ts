import { capabilitiesApi, goalsApi, profileApi } from "./api";
import type { ChatCapabilityCandidate } from "./types";

// Every onboarding answer is saved as soon as it is given, so stopping at any
// point keeps what the user already answered.

const TARGET_MONTHS = 6;

async function currentVersion(): Promise<number> {
  return (await profileApi.get()).version;
}

export async function startGoal(occupationId: string | null): Promise<void> {
  const { items } = await goalsApi.list();
  // Only one goal can be ACTIVE; re-onboarding archives the current one.
  for (const goal of items.filter((g) => g.status === "ACTIVE")) {
    await goalsApi.update(goal.goal_id, {
      expected_profile_version: await currentVersion(),
      goal_mode: goal.goal_mode,
      target_by: goal.target_by,
      timezone: goal.timezone,
      original_time_phrase: goal.original_time_phrase,
      ...(goal.occupation_id ? { occupation_id: goal.occupation_id } : {}),
      status: "ARCHIVED",
    });
  }
  const targetBy = new Date();
  targetBy.setMonth(targetBy.getMonth() + TARGET_MONTHS);
  await goalsApi.create({
    expected_profile_version: await currentVersion(),
    goal_mode: occupationId ? "TARGETED" : "DISCOVERY",
    target_by: targetBy.toISOString(),
    timezone: "Asia/Seoul",
    original_time_phrase: `${TARGET_MONTHS}개월 내`,
    ...(occupationId ? { occupation_id: occupationId } : {}),
  });
}

export async function saveProfile(major: string | null, year: number | null): Promise<boolean> {
  const profile = await profileApi.get();
  const majorRaw = major?.trim() || profile.major_raw;
  // The profile API requires a major; without one there is nothing to save yet.
  if (!majorRaw) return false;
  await profileApi.update({
    expected_profile_version: profile.version,
    major_raw: majorRaw,
    ...(year ? { year } : {}),
  });
  return true;
}

export async function saveChecklist(occupationId: string, itemIds: string[]): Promise<void> {
  const version = await currentVersion();
  await capabilitiesApi.replaceOnboarding(
    { expected_profile_version: version, occupation_id: occupationId, item_ids: itemIds },
    `onboarding-${occupationId}-v${version}`
  );
}

export async function saveChatCapability(candidate: ChatCapabilityCandidate): Promise<void> {
  await capabilitiesApi.create({
    expected_profile_version: await currentVersion(),
    category: "chat",
    raw_text: candidate.label,
    details: { source: "chat", evidence_quote: candidate.evidence_quote },
  });
}
