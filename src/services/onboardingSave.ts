import { goalsApi, profileApi } from "./api";

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
  const majorRaw = major?.trim() ?? profile.major_raw ?? "";
  await profileApi.update({
    expected_profile_version: profile.profile_version ?? profile.version,
    major_raw: majorRaw,
    major_concept_id: major !== null && majorRaw !== profile.major_raw ? null : profile.major_concept_id ?? null,
    year: year ?? profile.year ?? null,
    enrollment_status: profile.enrollment_status ?? null,
    expected_graduation_on: profile.expected_graduation_on ?? null,
  });
  return true;
}
